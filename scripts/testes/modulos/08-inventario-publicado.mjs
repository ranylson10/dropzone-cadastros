import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, result } from '../lib/util.mjs';

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

    const out = [
      result('OK', 'Banco publicado', 'Inventário carregado', `${publicTables.length} tabela(s), ${columns.length} coluna(s), ${constraints.length} constraint(s), ${indexes.length} índice(s), ${policies.length} policy(s).`),
    ];
    if (noRls.length) out.push(result('AVISO', 'Banco publicado', 'Tabelas sem RLS', noRls.map((x) => x.table_name).join(', '), 'Classificar cada tabela como pública, exclusivamente backend ou protegida; ativar RLS quando houver acesso pelo cliente.'));
    else out.push(result('OK', 'Banco publicado', 'RLS habilitado', 'Nenhuma tabela base sem RLS foi informada pelo inventário.'));

    if (tablesWithoutPolicy.length) out.push(result('AVISO', 'Banco publicado', 'Tabelas sem policies', tablesWithoutPolicy.map((x) => x.table_name).join(', '), 'Confirmar se são tabelas exclusivamente acessadas por Service Role. Caso contrário, criar policies mínimas.'));
    else out.push(result('OK', 'Banco publicado', 'Cobertura de policies', 'Todas as tabelas base possuem ao menos uma policy.'));
    return out;
  } catch (error) {
    return [result('ERRO', 'Banco publicado', 'Inventário inválido', error instanceof Error ? error.message : String(error), 'O arquivo deve conter somente o objeto JSON retornado pelo SQL, sem cabeçalhos de tabela ou markdown.')];
  }
}
