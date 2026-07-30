import fs from 'node:fs';
import path from 'node:path';
import { ensureReportDir, REPORT_DIR, ROOT } from './lib/util.mjs';
import { executar as ambiente } from './modulos/01-ambiente.mjs';
import { executar as segredos } from './modulos/02-segredos.mjs';
import { executar as estrutura } from './modulos/03-residuos-estrutura.mjs';
import { executar as migrations } from './modulos/04-migrations.mjs';
import { executar as qualidade } from './modulos/05-qualidade.mjs';
import { executar as contratosBanco } from './modulos/06-contratos-banco.mjs';
import { executar as debugDownloads } from './modulos/07-debug-downloads.mjs';
import { executar as inventarioPublicado } from './modulos/08-inventario-publicado.mjs';
import { executar as integridadePublicada } from './modulos/09-integridade-publicada.mjs';
import { executar as schemaCodigo } from './modulos/10-schema-codigo.mjs';
import { executar as matrizRls } from './modulos/11-matriz-rls.mjs';
import { executar as serviceRolePermissoes } from './modulos/12-service-role-permissoes.mjs';
import { executar as coberturaCrud } from './modulos/13-cobertura-crud.mjs';

const full = process.argv.includes('--full');
const skipQuality = process.argv.includes('--skip-quality');
const startedAt = new Date();
const modules = [
  ['Ambiente', ambiente],
  ['Segredos', segredos],
  ['Estrutura', estrutura],
  ['Migrations', migrations],
  ['Contratos do banco', contratosBanco],
  ['Debug e SQLs auxiliares', debugDownloads],
  ['Banco publicado', inventarioPublicado],
  ['Integridade publicada', integridadePublicada],
  ['Schema versus código', schemaCodigo],
  ['Matriz RLS', matrizRls],
  ['Service Role e permissões', serviceRolePermissoes],
  ['Cobertura CRUD', coberturaCrud],
  ...(!skipQuality ? [['Qualidade', () => qualidade({ full })]] : []),
];
const results = [];

console.log(`\nDROPZONE — AUDITORIA ${full ? 'COMPLETA' : 'RÁPIDA'}${skipQuality ? ' (QUALIDADE JÁ VALIDADA PELO ORQUESTRADOR)' : ''}\n`);
for (const [name, fn] of modules) {
  process.stdout.write(`Testando ${name}... `);
  try {
    const moduleResults = await fn();
    results.push(...moduleResults);
    console.log('concluído');
  } catch (error) {
    results.push({ status: 'ERRO', area: name, title: 'Falha interna do teste', details: error instanceof Error ? error.message : String(error), recommendation: 'Corrija o módulo do robô antes de confiar neste resultado.' });
    console.log('falhou');
  }
}

const order = { ERRO: 0, AVISO: 1, OK: 2 };
results.sort((a,b) => order[a.status] - order[b.status] || a.area.localeCompare(b.area));
const counts = { OK: 0, AVISO: 0, ERRO: 0 };
results.forEach((item) => { counts[item.status] += 1; });
const finishedAt = new Date();
const payload = {
  project: 'DropZone',
  mode: full ? 'completo' : 'rapido',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt - startedAt,
  summary: counts,
  results,
};

ensureReportDir();
fs.writeFileSync(path.join(REPORT_DIR, 'ultimo-relatorio.json'), JSON.stringify(payload, null, 2));
const lines = [
  'DROPZONE — RELATÓRIO DE AUDITORIA',
  `Modo: ${payload.mode}`,
  `Data: ${finishedAt.toLocaleString('pt-BR')}`,
  `Resumo: ${counts.OK} OK | ${counts.AVISO} AVISO(S) | ${counts.ERRO} ERRO(S)`,
  '',
];
for (const item of results) {
  lines.push(`[${item.status}] ${item.area} — ${item.title}`);
  if (item.details) lines.push(`  Detalhes: ${item.details}`);
  if (item.recommendation) lines.push(`  Recomendação: ${item.recommendation}`);
  lines.push('');
}
fs.writeFileSync(path.join(REPORT_DIR, 'ultimo-relatorio.txt'), lines.join('\n'));
fs.writeFileSync(path.join(REPORT_DIR, 'falhas-encontradas.txt'), results.filter((item) => item.status !== 'OK').map((item) => `[${item.status}] ${item.area} — ${item.title}\n${item.details || ''}\n${item.recommendation || ''}\n`).join('\n'));

console.log(`\nResultado: ${counts.OK} OK | ${counts.AVISO} AVISO(S) | ${counts.ERRO} ERRO(S)`);
console.log(`Relatório: ${path.relative(ROOT, path.join(REPORT_DIR, 'ultimo-relatorio.txt'))}`);
process.exitCode = counts.ERRO > 0 ? 1 : 0;
