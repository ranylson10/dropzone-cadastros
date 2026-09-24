import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, ROOT, result } from '../lib/util.mjs';

function collectMigrationTables() {
  const tables = new Set();
  const roots = [path.join(ROOT, 'database', 'migrations'), path.join(ROOT, 'supabase', 'migrations')];
  for (const base of roots) {
    if (!fs.existsSync(base)) continue;
    for (const file of walkSql(base)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?[\"]?([a-zA-Z0-9_]+)[\"]?/gim)) tables.add(match[1]);
    }
  }
  return tables;
}

function walkSql(base) {
  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const full = path.join(base, entry.name);
    if (entry.isDirectory()) out.push(...walkSql(full));
    else if (entry.name.endsWith('.sql')) out.push(full);
  }
  return out;
}

function duplicateIndexGroups(indexes) {
  const groups = new Map();
  for (const index of indexes) {
    const definition = String(index.definition ?? '')
      .replace(/CREATE\s+UNIQUE\s+INDEX\s+[^\s]+\s+ON/i, 'CREATE INDEX ON')
      .replace(/CREATE\s+INDEX\s+[^\s]+\s+ON/i, 'CREATE INDEX ON')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!definition) continue;
    const key = `${index.table_name ?? ''}::${definition}`;
    const names = groups.get(key) ?? [];
    names.push(index.index_name ?? definition);
    groups.set(key, names);
  }
  return [...groups.values()].filter((names) => names.length > 1);
}

export async function executar() {
  const file = path.join(REPORT_DIR, 'banco-publicado.json');
  if (!fs.existsSync(file)) {
    return [result(
      'AVISO',
      'Banco publicado',
      'Inventário do Supabase ainda não importado',
      'O robô está auditando migrations e código, mas ainda não possui o retrato do banco publicado.',
      'Execute database/auditoria/rodada_2_inventario_banco.sql no Supabase, copie apenas o valor JSON retornado e salve como relatorios-testes/banco-publicado.json.',
    )];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const tables = parsed.tables ?? [];
    const columns = parsed.columns ?? [];
    const constraints = parsed.constraints ?? [];
    const indexes = parsed.indexes ?? [];
    const policies = parsed.policies ?? [];
    const rls = parsed.rls ?? [];
    const noRls = rls.filter((item) => item.relkind === 'r' && item.rls_enabled === false);
    const publicTables = tables.filter((item) => item.table_type === 'BASE TABLE');
    const tablesWithoutPolicy = publicTables.filter((table) => !policies.some((policy) => policy.tablename === table.table_name));
    const classificationFile = path.join(ROOT, 'database', 'rls-classification.json');
    const classification = fs.existsSync(classificationFile)
      ? JSON.parse(fs.readFileSync(classificationFile, 'utf8')).tables ?? {}
      : {};
    const unclassifiedWithoutPolicy = tablesWithoutPolicy.filter((table) => !classification[table.table_name]);
    const migrationTables = collectMigrationTables();
    const staleClassifications = Object.keys(classification).filter((tableName) =>
      !tablesWithoutPolicy.some((table) => table.table_name === tableName)
      && !migrationTables.has(tableName)
    );

    const out = [
      result('OK', 'Banco publicado', 'Inventário carregado', `${publicTables.length} tabela(s), ${columns.length} coluna(s), ${constraints.length} constraint(s), ${indexes.length} índice(s), ${policies.length} policy(s).`),
    ];
    const duplicateIndexes = duplicateIndexGroups(indexes);
    if (duplicateIndexes.length) {
      out.push(result(
        'AVISO',
        'Banco publicado',
        'Índices redundantes',
        duplicateIndexes.slice(0, 20).map((names) => names.join(' + ')).join('; '),
        'Remover cópias redundantes depois de confirmar que a constraint ou índice único equivalente permanece. Migration staged: 20260908_consolidar_indices_redundantes.sql.',
      ));
    } else {
      out.push(result('OK', 'Banco publicado', 'Índices sem duplicação exata', 'Nenhuma definição de índice repetida foi localizada.'));
    }
    if (noRls.length) out.push(result('AVISO', 'Banco publicado', 'Tabelas sem RLS', noRls.map((x) => x.table_name).join(', '), 'Classificar cada tabela como pública, exclusivamente backend ou protegida; ativar RLS quando houver acesso pelo cliente.'));
    else out.push(result('OK', 'Banco publicado', 'RLS habilitado', 'Nenhuma tabela base sem RLS foi informada pelo inventário.'));

    if (unclassifiedWithoutPolicy.length) out.push(result('AVISO', 'Banco publicado', 'Tabelas sem policies não classificadas', unclassifiedWithoutPolicy.map((x) => x.table_name).join(', '), 'Classificar como acesso exclusivo por Service Role, legado controlado ou criar policies mínimas.'));
    else if (tablesWithoutPolicy.length) out.push(result('OK', 'Banco publicado', 'Tabelas sem policies classificadas', `${tablesWithoutPolicy.length} tabela(s) sem policy possuem classificação explícita em database/rls-classification.json.`));
    else out.push(result('OK', 'Banco publicado', 'Cobertura de policies', 'Todas as tabelas base possuem ao menos uma policy.'));
    if (staleClassifications.length) out.push(result('AVISO', 'Banco publicado', 'Classificações RLS desatualizadas', staleClassifications.join(', '), 'Remover entradas que já possuem policy ou não existem mais no inventário.'));
    return out;
  } catch (error) {
    return [result('ERRO', 'Banco publicado', 'Inventário inválido', error instanceof Error ? error.message : String(error), 'O arquivo deve conter somente o objeto JSON retornado pelo SQL, sem cabeçalhos de tabela ou markdown.')];
  }
}
