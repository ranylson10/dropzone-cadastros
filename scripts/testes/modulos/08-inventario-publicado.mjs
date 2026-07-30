import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, ROOT, result } from '../lib/util.mjs';

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
    const staleClassifications = Object.keys(classification).filter((tableName) => !tablesWithoutPolicy.some((table) => table.table_name === tableName));

    const out = [
      result('OK', 'Banco publicado', 'Inventário carregado', `${publicTables.length} tabela(s), ${columns.length} coluna(s), ${constraints.length} constraint(s), ${indexes.length} índice(s), ${policies.length} policy(s).`),
    ];
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
