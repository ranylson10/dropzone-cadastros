import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, ROOT, ensureReportDir, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const API_ROOT = path.join(ROOT, 'web', 'app', 'api');
const WRITE_METHOD_RE = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;
const READ_METHOD_RE = /export\s+async\s+function\s+GET\b/g;
const ADMIN_RE = /\bsupabaseAdmin\b|shared\/supabase-admin|SUPABASE_SERVICE_ROLE_KEY/;
const AUTH_RE = /auth\.getUser\s*\(|getCurrentUser\s*\(|requireUser\s*\(|requireAuth\s*\(|getUserFromRequest\s*\(|supabase\.auth\.getUser\s*\(|getBearerUser\s*\(|getLinkedUser\s*\(/;
const PERMISSION_RE = /denunciante_auth_user_id\s*:\s*user\.id|requireCampeonato|requireSistemaAdmin|require.*(?:Manage|Write|Permission|Access|Owner|Admin|Score|Structure)|getCampeonatoPermission\s*\(|canManage|assert.*(?:Permission|Access|Owner)|manager.*access|equipe.*access|getAccountsForUser\s*\(|getAccountsByUserId\s*\(|getCampeonatoAdminAuthUserId\s*\(|getActiveAccount\s*\(|requireUploadAccess\s*\(|fn_solicitar_saque|fn_resgatar_stream_overlay_code|dono_auth_user_id|auth_user_id\.eq/i;
const PUBLIC_RE = /\/public\/|\/webhooks?\/|\/auth\/|\/obs\/|\/stream\/public|\/vendedores\/convite|\/convites?\/|\/escala\//i;
const TOKEN_RE = /\btoken\b|authorization|bearer|x-webhook|signature|secret/i;
const ID_SCOPE_RE = /\.(?:eq|in)\(\s*['"](?:id|equipe_id|campeonato_id|produtora_id|manager_id|auth_user_id|dono_auth_user_id|token)['"]|requireUploadAccess\s*\(|fn_solicitar_saque|fn_resgatar_stream_overlay_code|getOrCreateWallet\s*\(|denunciante_auth_user_id\s*:\s*user\.id/;

function methods(source) {
  const write = [...source.matchAll(WRITE_METHOD_RE)].map((m) => m[1]);
  const read = [...source.matchAll(READ_METHOD_RE)].map(() => 'GET');
  return [...new Set([...read, ...write])];
}

export async function executar() {
  ensureReportDir();
  const files = walk(API_ROOT).filter((file) => file.endsWith('route.ts') || file.endsWith('route.js'));
  const rows = [];

  for (const file of files) {
    const source = safeRead(file);
    if (!ADMIN_RE.test(source)) continue;
    const route = normalizePath(path.relative(path.join(ROOT, 'web', 'app'), file)).replace(/\/route\.(?:ts|js)$/, '');
    const routeMethods = methods(source);
    const hasWrite = routeMethods.some((method) => method !== 'GET');
    const authEvidence = AUTH_RE.test(source);
    const permissionEvidence = PERMISSION_RE.test(source);
    const publicCandidate = PUBLIC_RE.test(route);
    const tokenEvidence = TOKEN_RE.test(source);
    const scopedEvidence = ID_SCOPE_RE.test(source);

    let classification = 'protegida';
    let severity = 'OK';
    let reason = 'Autenticação e autorização localizadas.';

    if (publicCandidate) {
      classification = 'pública/token/webhook';
      if (!tokenEvidence && hasWrite) {
        severity = 'AVISO';
        reason = 'Rota pública com escrita e sem evidência clara de token, assinatura ou segredo.';
      } else {
        reason = 'Rota pública intencional; possui evidência de token, assinatura, bearer ou validação equivalente.';
      }
    } else if (hasWrite && !authEvidence) {
      classification = 'revisar autenticação';
      severity = 'AVISO';
      reason = 'Usa Service Role em método de escrita sem evidência direta de autenticação no arquivo.';
    } else if (hasWrite && authEvidence && !permissionEvidence) {
      classification = 'revisar autorização';
      severity = 'AVISO';
      reason = 'Usuário autenticado, mas não foi localizada validação clara de dono, manager, produtora ou campeonato.';
    } else if (!hasWrite && !authEvidence && !publicCandidate) {
      classification = 'leitura administrativa';
      severity = 'AVISO';
      reason = 'Leitura com Service Role sem autenticação local; confirmar se é pública por desenho ou protegida em helper externo.';
    }

    rows.push({
      route,
      file: normalizePath(path.relative(ROOT, file)),
      methods: routeMethods,
      hasWrite,
      authEvidence,
      permissionEvidence,
      publicCandidate,
      tokenEvidence,
      scopedEvidence,
      classification,
      severity,
      reason,
    });
  }

  fs.writeFileSync(path.join(REPORT_DIR, 'matriz-service-role-rotas.json'), JSON.stringify({ generatedAt: new Date().toISOString(), routes: rows }, null, 2));
  const csv = ['rota,metodos,classificacao,autenticacao,autorizacao,token_ou_assinatura,escopo_por_id,arquivo'];
  for (const row of rows) {
    const values = [row.route, row.methods.join('|'), row.classification, row.authEvidence, row.permissionEvidence, row.tokenEvidence, row.scopedEvidence, row.file];
    csv.push(values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
  }
  fs.writeFileSync(path.join(REPORT_DIR, 'matriz-service-role-rotas.csv'), csv.join('\n'));

  const warnings = rows.filter((row) => row.severity === 'AVISO');
  const protectedCount = rows.filter((row) => row.classification === 'protegida').length;
  const publicCount = rows.filter((row) => row.classification === 'pública/token/webhook').length;
  const output = [
    result('OK', 'Service Role', 'Matriz de rotas gerada', `${rows.length} rota(s) que usam cliente administrativo. ${protectedCount} protegida(s); ${publicCount} pública(s)/token/webhook. Arquivos: relatorios-testes/matriz-service-role-rotas.json e .csv.`),
  ];

  if (warnings.length) {
    const byClass = warnings.reduce((acc, row) => { acc[row.classification] = (acc[row.classification] ?? 0) + 1; return acc; }, {});
    output.push(result(
      'AVISO',
      'Service Role',
      'Rotas que exigem revisão manual',
      `${warnings.length} rota(s): ${Object.entries(byClass).map(([key, count]) => `${key}: ${count}`).join('; ')}.`,
      'Revisar primeiro as rotas de escrita. O scanner é conservador e helpers externos podem justificar alguns casos.',
    ));
  } else {
    output.push(result('OK', 'Service Role', 'Cobertura de autenticação e autorização', 'Nenhuma rota administrativa ficou sem evidência mínima de proteção.'));
  }

  const unscopedWrites = rows.filter((row) => row.hasWrite && !row.publicCandidate && row.authEvidence && !row.scopedEvidence);
  if (unscopedWrites.length) {
    output.push(result(
      'AVISO',
      'Service Role',
      'Escritas sem escopo de entidade evidente',
      unscopedWrites.slice(0, 20).map((row) => row.route).join(', ') + (unscopedWrites.length > 20 ? ` e mais ${unscopedWrites.length - 20}` : ''),
      'Confirmar em cada rota se equipe_id, campeonato_id, produtora_id ou manager_id é validado por helper antes da escrita.',
    ));
  } else {
    output.push(result('OK', 'Service Role', 'Escopo de entidade nas escritas', 'Todas as escritas protegidas apresentaram filtro de entidade evidente no arquivo.'));
  }

  return output;
}
