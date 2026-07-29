import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, result } from '../lib/util.mjs';
import { collectUpserts } from './06-contratos-banco.mjs';

function key(table, columns) {
  return `${String(table).toLowerCase()}::${[...(columns || [])].map((c) => String(c).toLowerCase()).sort().join(',')}`;
}

export async function executar() {
  const file = path.join(REPORT_DIR, 'integridade-publicada.json');
  if (!fs.existsSync(file)) return [result('AVISO', 'Integridade publicada', 'Diagnóstico de integridade ainda não importado', 'Ainda não há resultado das verificações do banco publicado.', 'Execute database/auditoria/rodada_3_integridade_banco.sql e salve o JSON retornado.')];

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const allContracts = Array.isArray(parsed.contracts) ? parsed.contracts : [];
    const activeKeys = new Set(collectUpserts().map((item) => key(item.table, item.columns)));
    const contracts = allContracts.filter((item) => activeKeys.has(key(item.table_name, item.columns)));
    const obsolete = allContracts.length - contracts.length;
    const invalidConstraints = Array.isArray(parsed.invalid_constraints) ? parsed.invalid_constraints : [];
    const out = [];

    out.push(result('OK', 'Integridade publicada', 'Contratos atuais carregados', `${contracts.length} contrato(s) ainda usados pelo código foram comparados com o banco real.${obsolete ? ` ${obsolete} contrato(s) antigo(s) foram ignorados.` : ''}`));
    for (const item of contracts) {
      const title = `${item.table_name} — ${Array.isArray(item.columns) ? item.columns.join(', ') : item.columns}`;
      if (item.table_exists === false) out.push(result('ERRO', 'Integridade publicada', `${title}: tabela ausente`, 'O código usa esta tabela, mas ela não existe.', 'Confirmar projeto e migrations.', item));
      else if (item.columns_exist === false) out.push(result('ERRO', 'Integridade publicada', `${title}: coluna ausente`, `Colunas ausentes: ${(item.missing_columns ?? []).join(', ')}`, 'Corrigir o código ou a migration.', item));
      else if (item.unique_exists !== true) out.push(result('ERRO', 'Integridade publicada', `${title}: UNIQUE ausente`, `Duplicidades atuais: ${item.duplicate_groups ?? 0}.`, 'Substituir o upsert ou criar UNIQUE integral compatível.', item));
      else if (Number(item.duplicate_groups ?? 0) > 0) out.push(result('ERRO', 'Integridade publicada', `${title}: duplicidades encontradas`, `${item.duplicate_groups} grupo(s) duplicado(s).`, 'Corrigir dados antes de confiar no upsert.', item));
      else out.push(result('OK', 'Integridade publicada', `${title}: contrato válido`, 'UNIQUE confirmado e nenhuma duplicidade encontrada.'));
    }

    if (invalidConstraints.length) out.push(result('AVISO', 'Integridade publicada', 'Constraints não validadas', invalidConstraints.map((x) => `${x.table_name}.${x.constraint_name}`).join(', '), 'Investigar constraints NOT VALID.'));
    else out.push(result('OK', 'Integridade publicada', 'Constraints validadas', 'Nenhuma PK, FK, UNIQUE ou CHECK não validada foi localizada.'));
    return out;
  } catch (error) {
    return [result('ERRO', 'Integridade publicada', 'Arquivo inválido', error instanceof Error ? error.message : String(error), 'Salve somente o objeto JSON retornado pelo SQL.')];
  }
}
