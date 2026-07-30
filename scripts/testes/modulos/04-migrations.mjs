import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result } from '../lib/util.mjs';

function loadDownloadManifest() {
  const file = path.join(ROOT, 'database', 'downloads-manifest.json');
  if (!fs.existsSync(file)) return { files: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed.files === 'object' ? parsed : { files: {} };
  } catch {
    return { files: {}, invalid: true };
  }
}

function isClassified(manifest, file) {
  const rel = normalizePath(path.relative(ROOT, file));
  return manifest.files?.[rel]?.classification === 'legacy_manual_copy';
}

export async function executar() {
  const out = [];
  const dir = path.join(ROOT, 'database', 'migrations');
  if (!fs.existsSync(dir)) return [result('ERRO', 'Banco', 'Diretório de migrations', 'database/migrations não existe.', 'Crie o diretório e versione todas as mudanças do banco.')];

  const manifest = loadDownloadManifest();
  if (manifest.invalid) out.push(result('ERRO', 'Banco', 'Manifesto de SQLs DOWNLOAD inválido', 'database/downloads-manifest.json não contém JSON válido.', 'Corrija o manifesto antes de executar a auditoria.'));

  const sqlFiles = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
  const valid = sqlFiles.filter((name) => /^\d{8}_[a-z0-9_]+\.sql$/i.test(name));
  const invalid = sqlFiles.filter((name) => {
    if (/^\d{8}_[a-z0-9_]+\.sql$/i.test(name)) return false;
    return !isClassified(manifest, path.join(dir, name));
  });
  out.push(result(valid.length > 0 ? 'OK' : 'ERRO', 'Banco', 'Migrations versionadas', `${valid.length} migration(s) com prefixo de data.`));
  invalid.forEach((name) => out.push(result('AVISO', 'Banco', `Migration fora do padrão: ${name}`, 'O arquivo não começa com AAAAMMDD_.', 'Renomeie ou mova para uma pasta de documentação/download.')));

  const lower = new Map();
  for (const name of sqlFiles) {
    const key = name.toLowerCase();
    if (lower.has(key)) out.push(result('ERRO', 'Banco', 'Migration duplicada por nome', `${lower.get(key)} e ${name}`, 'Mantenha apenas uma migration oficial.'));
    else lower.set(key, name);
  }

  const downloadSql = [];
  const scanDirs = [path.join(ROOT, 'database'), path.join(ROOT, 'database', 'migrations')];
  for (const base of scanDirs) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) if (/^DOWNLOAD_.*\.sql$/i.test(name)) downloadSql.push(path.join(base, name));
  }
  const unclassified = downloadSql.filter((file) => !isClassified(manifest, file));
  unclassified.forEach((file) => out.push(result('AVISO', 'Banco', 'SQL de download fora do fluxo oficial', normalizePath(path.relative(ROOT, file)), 'Classifique no database/downloads-manifest.json ou mova para documentação.')));
  if (downloadSql.length > 0 && unclassified.length === 0) {
    out.push(result('OK', 'Banco', 'SQLs DOWNLOAD classificados', `${downloadSql.length} arquivo(s) legado(s) mapeado(s) para migrations oficiais e excluídos do fluxo automático.`));
  }
  return out;
}
