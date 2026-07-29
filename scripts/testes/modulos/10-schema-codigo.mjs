import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

function collectCodeTables() {
  const refs = new Map();
  const files = walk(ROOT).filter((file) => /\.(?:ts|tsx|js|mjs)$/.test(file) && !normalizePath(file).includes('/node_modules/'));
  for (const file of files) {
    const text = safeRead(file);
    const rel = normalizePath(path.relative(ROOT, file));
    for (const match of text.matchAll(/\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) {
      const table = match[1];
      if (!refs.has(table)) refs.set(table, new Set());
      refs.get(table).add(rel);
    }
  }
  return refs;
}

export async function executar() {
  const file = path.join(REPORT_DIR, 'banco-publicado.json');
  if (!fs.existsSync(file)) {
    return [result('AVISO', 'Schema versus código', 'Comparação aguardando inventário', 'Não é possível provar se todas as tabelas usadas no código existem sem banco-publicado.json.', 'Importe o inventário da Rodada 2.')];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const dbTables = new Set((parsed.tables ?? []).map((x) => x.table_name));
    const refs = collectCodeTables();
    const absent = [...refs.keys()].filter((name) => !dbTables.has(name)).sort();
    const used = [...refs.keys()].filter((name) => dbTables.has(name));
    const out = [result('OK', 'Schema versus código', 'Tabelas referenciadas', `${used.length} tabela(s)/view(s) usadas no código foram localizadas no banco publicado.`)];
    for (const table of absent) {
      out.push(result(
        'ERRO',
        'Schema versus código',
        `Tabela/view ausente: ${table}`,
        `Referenciada em: ${[...refs.get(table)].slice(0, 6).join(', ')}`,
        'Confirmar se é nome legado, migration não aplicada ou conexão com projeto incorreto.',
        { table, files: [...refs.get(table)] },
      ));
    }
    if (!absent.length) out.push(result('OK', 'Schema versus código', 'Cobertura do schema', 'Nenhuma tabela/view referenciada pelo Supabase client está ausente no inventário publicado.'));
    return out;
  } catch (error) {
    return [result('ERRO', 'Schema versus código', 'Falha ao comparar', error instanceof Error ? error.message : String(error), 'Verifique banco-publicado.json.')];
  }
}
