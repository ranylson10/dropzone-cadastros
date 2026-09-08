import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureReportDir, normalizePath, REPORT_DIR, result, safeRead, walk } from '../lib/util.mjs';

const API_ROOT = path.join(ROOT, 'web', 'app', 'api');
const CLASSIFICATION_FILE = path.join(ROOT, 'database', 'api-route-security-classification.json');
const METHOD_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
const WRITE_METHODS = new Set(['POST','PUT','PATCH','DELETE']);
const AUTH_EVIDENCE = /(require(?:Auth|User|Admin|SystemAdmin|Campeonato|Produtora|Equipe|Manager)|getBearerUser|getServerAuth|getCurrentUser|getAuthenticatedUser|getCampeonatoPermission|auth\.getUser\s*\(|supabase\.auth\.getUser\s*\()/i;
const SCOPE_EVIDENCE = /(campeonato_id|campeonatoId|equipe_id|equipeId|produtora_id|produtoraId|manager_id|managerId|user_id|userId|auth_user_id)/i;
const TOKEN_ROUTE = /\[(?:token|tokenId)\]/i;
const PUBLIC_ROUTE = /\/api\/(?:ping|rank|campeonatos\/busca|equipes\/busca-publica|dropzone\/public|convites\/|vendedores\/convite|stream\/live|broadcast\/obs|webhooks\/)/i;
const DEBUG_ROUTE = /\/api\/debug(?:\/|$)/i;
const PUBLIC_WRITE_DECISIONS = new Set(['public-auth-flow', 'public-oauth-flow', 'public-cost-controlled']);

function routeOf(file) {
  return '/' + normalizePath(path.relative(path.join(ROOT, 'web', 'app'), file)).replace(/\/route\.(?:ts|js)$/, '');
}

export async function executar() {
  ensureReportDir();
  let manual = { routes: {} };
  try { manual = JSON.parse(fs.readFileSync(CLASSIFICATION_FILE, 'utf8')); } catch {}
  const manualRoutes = manual?.routes && typeof manual.routes === 'object' ? manual.routes : {};
  const files = walk(API_ROOT).filter((file) => /route\.(?:ts|js)$/.test(file));
  const rows = [];
  const writeWithoutAuth = [];
  const protectedWithoutScope = [];
  const debugUnsafe = [];

  for (const file of files) {
    const src = safeRead(file);
    const route = routeOf(file);
    const methods = [...new Set([...src.matchAll(METHOD_RE)].map((m) => m[1]))];
    const hasWrite = methods.some((m) => WRITE_METHODS.has(m));
    const publicCandidate = PUBLIC_ROUTE.test(route) || TOKEN_ROUTE.test(route);
    const authEvidence = AUTH_EVIDENCE.test(src);
    const scopeEvidence = SCOPE_EVIDENCE.test(src);
    const serviceRole = /(SUPABASE_SERVICE_ROLE_KEY|createAdminClient|createServiceRole|adminSupabase|getAdminSupabase)/i.test(src);
    const productionGuard = /(blockDebugRouteInProduction|NODE_ENV\s*!==?\s*['"]production['"]|NODE_ENV\s*===?\s*['"]production['"]|notFound\s*\(|status\s*:\s*404)/i.test(src);

    const manualDecision = manualRoutes[route];
    const reviewedPublicWrite = Boolean(PUBLIC_WRITE_DECISIONS.has(manualDecision?.decision) && manualDecision?.reason);
    const row = { route, file: normalizePath(path.relative(ROOT, file)), methods, hasWrite, publicCandidate, authEvidence, scopeEvidence, serviceRole, productionGuard, manualDecision: manualDecision || null };
    rows.push(row);

    if (hasWrite && !publicCandidate && !authEvidence && !reviewedPublicWrite) writeWithoutAuth.push(row);
    if (hasWrite && authEvidence && serviceRole && !scopeEvidence) protectedWithoutScope.push(row);
    if (DEBUG_ROUTE.test(route) && !productionGuard) debugUnsafe.push(row);
  }

  fs.writeFileSync(path.join(REPORT_DIR, 'matriz-rotas-seguranca.json'), JSON.stringify({ generatedAt: new Date().toISOString(), routes: rows }, null, 2));

  out: {
    // label block only to keep declarations together
  }
  const output = [];
  output.push(result('OK', 'Rotas', 'Inventário de API', `${rows.length} rota(s) de API analisada(s); ${rows.filter(r => r.hasWrite).length} com escrita. Relatório: relatorios-testes/matriz-rotas-seguranca.json.`));

  const missingManualRoutes = Object.keys(manualRoutes).filter((route) => !rows.some((row) => row.route === route));
  const invalidManualRoutes = Object.entries(manualRoutes)
    .filter(([, item]) => !item || typeof item !== 'object' || !PUBLIC_WRITE_DECISIONS.has(item.decision) || !item.reason)
    .map(([route]) => route);
  output.push(result(
    missingManualRoutes.length || invalidManualRoutes.length ? 'AVISO' : 'OK',
    'Segurança de rotas',
    'Decisões públicas revisadas',
    missingManualRoutes.length || invalidManualRoutes.length
      ? [missingManualRoutes.length ? `Rotas inexistentes: ${missingManualRoutes.join(', ')}` : '', invalidManualRoutes.length ? `Entradas inválidas: ${invalidManualRoutes.join(', ')}` : ''].filter(Boolean).join('. ')
      : `${Object.keys(manualRoutes).length} endpoint(s) público(s) de escrita possuem decisão e justificativa explícitas.`,
    missingManualRoutes.length || invalidManualRoutes.length ? 'Corrigir database/api-route-security-classification.json.' : '',
  ));

  output.push(result(
    writeWithoutAuth.length ? 'AVISO' : 'OK',
    'Segurança de rotas',
    'Escritas privadas com autenticação',
    writeWithoutAuth.length ? writeWithoutAuth.slice(0,25).map(r => `${r.route} [${r.methods.join(',')}]`).join('; ') : 'Nenhuma rota privada de escrita ficou sem evidência mínima de autenticação.',
    writeWithoutAuth.length ? 'Revisar junto da matriz Service Role. Este scanner é conservador: helpers indiretos e endpoints públicos intencionais podem gerar falso positivo.' : '',
  ));

  output.push(result(
    protectedWithoutScope.length ? 'AVISO' : 'OK',
    'Segurança de rotas',
    'Service role com escopo de entidade',
    protectedWithoutScope.length ? protectedWithoutScope.slice(0,25).map(r => r.route).join('; ') : 'As escritas com cliente administrativo possuem evidência de escopo por usuário/equipe/campeonato/produtora/manager.',
    protectedWithoutScope.length ? 'Confirmar manualmente que o helper de autorização valida a entidade antes da escrita; service role ignora RLS.' : '',
  ));

  output.push(result(
    debugUnsafe.length ? 'ERRO' : 'OK',
    'Segurança de rotas',
    'Rotas debug em produção',
    debugUnsafe.length
      ? debugUnsafe.map(r => r.route).join('; ')
      : rows.some((row) => DEBUG_ROUTE.test(row.route))
        ? 'Rotas /api/debug possuem bloqueio de produção/404 detectável.'
        : 'Nenhuma rota /api/debug faz parte do pacote da aplicação.',
    debugUnsafe.length ? 'Bloqueie explicitamente em production ou remova a rota.' : '',
  ));

  const noMethods = rows.filter((r) => r.methods.length === 0);
  output.push(result(
    noMethods.length ? 'AVISO' : 'OK',
    'Rotas',
    'Handlers exportados',
    noMethods.length ? noMethods.map(r => r.route).join('; ') : 'Todas as rotas possuem ao menos um método HTTP exportado.',
    noMethods.length ? 'Verifique se são rotas incompletas ou se exportam handlers por alias não reconhecido.' : '',
  ));

  return output;
}
