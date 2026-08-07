import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const MIGRATIONS = path.join(ROOT, 'database', 'migrations');

export async function executar() {
  const out = [];
  const files = walk(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort();
  const all = files.map((file) => ({ rel: normalizePath(path.relative(ROOT, file)), src: safeRead(file) }));
  const joined = all.map(x => x.src).join('\n');

  const serviceRoleGrants = all.filter(({src}) => /grant\s+.+\s+to\s+service_role/i.test(src));
  const anonDanger = all.filter(({src}) => /grant\s+(?:all|insert|update|delete|truncate|references|trigger)[^;]*\s+to\s+anon/i.test(src));
  const securityDefiner = all.filter(({src}) => /security\s+definer/i.test(src));
  const fixedSearchPath = securityDefiner.filter(({src}) => /set\s+search_path\s*=|set\s+search_path\s+to/i.test(src));
  const disableRls = all.filter(({src}) => /disable\s+row\s+level\s+security/i.test(src));

  out.push(result(
    anonDanger.length ? 'ERRO' : 'OK',
    'Banco / Segurança',
    'Privilégios perigosos para anon',
    anonDanger.length ? anonDanger.map(x => x.rel).join('; ') : 'Nenhum GRANT amplo de escrita para anon localizado nas migrations.',
    anonDanger.length ? 'Remova privilégios amplos de anon e prefira policies RLS específicas.' : '',
  ));

  out.push(result(
    disableRls.length ? 'AVISO' : 'OK',
    'Banco / Segurança',
    'RLS explicitamente desabilitado',
    disableRls.length ? disableRls.map(x => x.rel).join('; ') : 'Nenhuma migration desabilita RLS explicitamente.',
    disableRls.length ? 'Confirme se cada desativação é intencional e limitada a tabela pública não sensível.' : '',
  ));

  if (securityDefiner.length) {
    const missingSearchPath = securityDefiner.filter(({src}) => !(/set\s+search_path\s*=|set\s+search_path\s+to/i.test(src)));
    out.push(result(
      missingSearchPath.length ? 'AVISO' : 'OK',
      'Banco / Segurança',
      'Funções SECURITY DEFINER com search_path',
      missingSearchPath.length
        ? `${missingSearchPath.length}/${securityDefiner.length} migration(s) com SECURITY DEFINER não mostram search_path fixo no mesmo arquivo: ${missingSearchPath.slice(0,15).map(x => x.rel).join('; ')}`
        : `${securityDefiner.length} migration(s) com SECURITY DEFINER possuem search_path fixo detectável.`,
      missingSearchPath.length ? 'Revisar as funções SECURITY DEFINER. Fixar search_path reduz risco de object shadowing.' : '',
    ));
  } else {
    out.push(result('OK', 'Banco / Segurança', 'Funções SECURITY DEFINER', 'Nenhuma ocorrência encontrada nas migrations.'));
  }

  const rlsEnabledCount = (joined.match(/enable\s+row\s+level\s+security/gi) || []).length;
  const policyCount = (joined.match(/create\s+policy\b/gi) || []).length;
  out.push(result('OK', 'Banco / Segurança', 'Cobertura RLS versionada', `${rlsEnabledCount} comando(s) ENABLE RLS e ${policyCount} CREATE POLICY localizado(s) nas migrations. A efetividade final será comprovada pelo inventário do banco publicado.`));

  out.push(result(
    serviceRoleGrants.length ? 'OK' : 'AVISO',
    'Banco / Segurança',
    'Privilégios service_role versionados',
    serviceRoleGrants.length ? `${serviceRoleGrants.length} migration(s) contêm grants explícitos para service_role.` : 'Nenhum grant explícito para service_role localizado; isso pode ser normal dependendo do padrão Supabase.',
    serviceRoleGrants.length ? '' : 'Confirmar privilégios efetivos no banco publicado; não é erro por si só.',
  ));

  return out;
}
