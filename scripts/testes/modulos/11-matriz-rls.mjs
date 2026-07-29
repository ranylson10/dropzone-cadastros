import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

function collectRefs() {
  const refs = new Map();
  const files = walk(ROOT).filter((file) => {
    const normalized = normalizePath(file);
    return /\.(?:ts|tsx|js|mjs)$/.test(file)
      && !normalized.includes('/node_modules/')
      && !normalized.includes('/scripts/');
  });
  for (const file of files) {
    const text = safeRead(file);
    const rel = normalizePath(path.relative(ROOT, file));
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const match of lines[i].matchAll(/\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) {
        const table = match[1];
        const window = lines.slice(Math.max(0, i - 3), i + 2).join('\n');
        const admin = /supabaseAdmin\s*\.from|admin\s*\.from/.test(window);
        const serverFile = rel.startsWith('backend/') || rel.includes('/app/api/') || rel.includes('/features/lili/');
        const kind = admin ? 'service_role' : serverFile ? 'server_auth' : 'client_or_unknown';
        if (!refs.has(table)) refs.set(table, []);
        refs.get(table).push({ file: rel, line: i + 1, kind });
      }
    }
  }
  return refs;
}

export async function executar() {
  const file = path.join(REPORT_DIR, 'banco-publicado.json');
  if (!fs.existsSync(file)) return [result('AVISO', 'Matriz RLS', 'Inventário ausente', 'Não foi possível classificar tabelas sem policies.', 'Importe banco-publicado.json.')];

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const policies = Array.isArray(parsed.policies) ? parsed.policies : [];
    const baseTables = (parsed.tables || []).filter((item) => item.table_type === 'BASE TABLE');
    const noPolicy = baseTables.filter((table) => !policies.some((policy) => policy.tablename === table.table_name));
    const refs = collectRefs();
    const matrix = noPolicy.map((table) => {
      const usages = refs.get(table.table_name) || [];
      const kinds = new Set(usages.map((usage) => usage.kind));
      let classification = 'sem_uso_localizado';
      let recommendation = 'Confirmar se a tabela é legado, operacional por SQL ou usada por função/RPC.';
      if (kinds.has('client_or_unknown')) {
        classification = 'requer_revisao_prioritaria';
        recommendation = 'Há referência possivelmente executada pelo cliente; criar policies mínimas ou mover a operação ao backend.';
      } else if (kinds.has('server_auth')) {
        classification = 'backend_autenticado';
        recommendation = 'Confirmar se o cliente Supabase do servidor usa sessão do usuário e quais operações precisam de policy.';
      } else if (kinds.has('service_role')) {
        classification = 'somente_service_role_candidato';
        recommendation = 'Pode permanecer sem policy se todas as operações forem exclusivamente por Service Role e houver autorização antes da consulta.';
      }
      return { table_name: table.table_name, classification, recommendation, usages: usages.slice(0, 20) };
    });

    fs.writeFileSync(path.join(REPORT_DIR, 'matriz-rls-sem-policies.json'), JSON.stringify({ generated_at: new Date().toISOString(), tables: matrix }, null, 2));
    const priority = matrix.filter((item) => item.classification === 'requer_revisao_prioritaria');
    const serverAuth = matrix.filter((item) => item.classification === 'backend_autenticado');
    const serviceOnly = matrix.filter((item) => item.classification === 'somente_service_role_candidato');
    const unused = matrix.filter((item) => item.classification === 'sem_uso_localizado');
    const out = [result('OK', 'Matriz RLS', 'Classificação gerada', `${matrix.length} tabela(s) sem policy classificadas. Arquivo: relatorios-testes/matriz-rls-sem-policies.json.`)];
    if (priority.length) out.push(result('ERRO', 'Matriz RLS', 'Acesso possivelmente direto sem policy', priority.map((item) => item.table_name).join(', '), 'Auditar imediatamente estas referências.'));
    else out.push(result('OK', 'Matriz RLS', 'Nenhum acesso direto evidente', 'O scanner não encontrou uso claramente client-side nas tabelas sem policy.'));
    if (serverAuth.length) out.push(result('AVISO', 'Matriz RLS', 'Backend com sessão exige revisão', serverAuth.map((item) => item.table_name).join(', '), 'Confirmar se as consultas usam sessão do usuário e criar policies quando necessário.'));
    if (serviceOnly.length) out.push(result('OK', 'Matriz RLS', 'Candidatas a Service Role', `${serviceOnly.length} tabela(s) aparecem apenas em operações administrativas do servidor.`));
    if (unused.length) out.push(result('AVISO', 'Matriz RLS', 'Sem uso localizado no código', unused.map((item) => item.table_name).join(', '), 'Confirmar uso por RPC, trigger, SQL operacional ou remover legado após validação.'));
    return out;
  } catch (error) {
    return [result('ERRO', 'Matriz RLS', 'Falha ao gerar matriz', error instanceof Error ? error.message : String(error), 'Verifique banco-publicado.json e o scanner.')];
  }
}
