import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const ENV_FILES = /(^|\/)(\.env(?:\..+)?|[^/]+\.env(?:\..+)?)$/i;
const SENSITIVE_NAMES = /(SERVICE_ROLE|CLIENT_SECRET|API_KEY|WEBHOOK_TOKEN|AUTH_CODE_SECRET|PRIVATE_KEY|PASSWORD|SECRET)/i;
const PUBLIC_SENSITIVE = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|API_KEY|WEBHOOK)/i;
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.sql', '.md', '.yml', '.yaml']);

export async function executar() {
  const out = [];
  const files = walk(ROOT, { ignored: ['.git', '.next', 'node_modules', 'relatorios-testes'] });
  const envFiles = files.filter((file) => ENV_FILES.test(normalizePath(path.relative(ROOT, file))));
  for (const file of envFiles) {
    const relative = normalizePath(path.relative(ROOT, file));
    const trackedExample = relative.endsWith('.env.example');
    out.push(result(trackedExample ? 'OK' : 'AVISO', 'Segredos', `Arquivo de ambiente: ${relative}`, trackedExample ? 'Arquivo de exemplo permitido.' : 'Arquivo sensível presente na cópia local. O conteúdo não foi lido nem exibido.', trackedExample ? '' : 'Não envie este arquivo em ZIP e confirme que está ignorado pelo Git.'));
  }

  const gitignore = safeRead(path.join(ROOT, '.gitignore'));
  for (const pattern of ['.env.local', 'web/.env.local', 'node_modules', '.next']) {
    const covered = gitignore.split(/\r?\n/).some((line) => line.trim() === pattern || line.trim() === `/${pattern}` || line.trim() === `${pattern}/`);
    out.push(result(covered ? 'OK' : 'ERRO', 'Segredos', `.gitignore protege ${pattern}`, covered ? 'Proteção encontrada.' : 'Proteção ausente.', covered ? '' : `Adicione ${pattern} ao .gitignore.`));
  }

  const findings = [];
  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (ENV_FILES.test(normalizePath(file))) continue;
    const text = safeRead(file);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const publicMatch = line.match(PUBLIC_SENSITIVE);
      if (publicMatch) findings.push({ file, line: index + 1, kind: `variável pública sensível: ${publicMatch[0]}` });
      const assignment = line.match(/\b([A-Z][A-Z0-9_]{4,})\s*[:=]\s*['"]([^'"]{16,})['"]/);
      if (assignment && SENSITIVE_NAMES.test(assignment[1])) findings.push({ file, line: index + 1, kind: `possível segredo fixo em ${assignment[1]}` });
    });
  }

  if (findings.length === 0) {
    out.push(result('OK', 'Segredos', 'Segredos fixos no código', 'Nenhum padrão crítico encontrado. Valores de arquivos .env não foram exibidos.'));
  } else {
    for (const finding of findings.slice(0, 25)) {
      out.push(result('ERRO', 'Segredos', finding.kind, `${normalizePath(path.relative(ROOT, finding.file))}:${finding.line}`, 'Remova o valor do código, rotacione a chave e use variável de ambiente.'));
    }
    if (findings.length > 25) out.push(result('AVISO', 'Segredos', 'Resultados adicionais omitidos', `${findings.length - 25} ocorrência(s) adicionais.`, 'Revise o relatório JSON para detalhes.'));
  }
  return out;
}
