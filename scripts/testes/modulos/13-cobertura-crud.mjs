import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR, ROOT, ensureReportDir, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const API_ROOT = path.join(ROOT, 'web', 'app', 'api');
const METHOD_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
const EXCLUDE_RE = /\/(?:auth|webhooks?|debug|public|obs|assistant|upload|pagamentos?|payments?|paypal|health|cron|i18n|lili\/chat|reports)(?:\/|$)/i;
const ACTION_SEGMENTS = new Set([
  'aceitar','recusar','aprovar','cancelar','publicar','encerrar','reabrir','claim','redeem','signed',
  'renovar','aplicar-bonus','vincular','atual','falta','finalizar','confirmar','preview','publish',
  'from-catalog','quote','pricing-quote','control','manual','sortear','distribuir','sincronizar',
  'reprocessar','gerar','importar','exportar','resgatar','solicitar','enviar','validar','buscar',
  'capture','saque','pedidos','convite','convites','codes','sumula','vinculos','relacionamentos','escalacoes'
]);

function routeOf(file) {
  return normalizePath(path.relative(path.join(ROOT, 'web', 'app'), file)).replace(/\/route\.(?:ts|js)$/, '');
}

function lastSegment(route) {
  return route.split('/').filter(Boolean).at(-1)?.toLowerCase() ?? '';
}

function familyOf(route, routeNames) {
  const parts = route.split('/').filter(Boolean);
  while (parts.length && ACTION_SEGMENTS.has(parts.at(-1).toLowerCase())) parts.pop();

  // Rotas de item, como /jogos/[jogoId], pertencem à mesma família
  // da coleção /jogos quando essa coleção realmente existe.
  if (parts.length && /^\[[^/]+\]$/.test(parts.at(-1))) {
    const parent = parts.slice(0, -1).join('/');
    if (routeNames.has(parent)) parts.pop();
  }

  // Ações com identificador, como /control/[id], não são recursos CRUD.
  if (parts.length >= 2 && /^\[[^/]+\]$/.test(parts.at(-1)) && ACTION_SEGMENTS.has(parts.at(-2).toLowerCase())) {
    parts.splice(-2);
  }

  return parts.join('/').replace(/\/\[[^/]+\]/g, '/[id]');
}

function isTokenWorkflowRoute(route) {
  return /\/(?:convites?\/(?:equipe|grupo)|vendedores\/convite)\/\[[^/]+\]$/i.test(route);
}

function classifyFamily(item) {
  const segments = item.routes.map((route) => lastSegment(route.route));
  const actionOnly = segments.every((segment) => ACTION_SEGMENTS.has(segment));
  const immutable = /\/(?:quote|preview|confirmar|publish|finalizar|falta|atual|redeem|claim|signed|capture|saque)$/i.test(item.family)
    || /\/(?:convites?|pedidos)(?:\/\[id\])?$/i.test(item.family)
    || item.routes.every((route) => /\/(?:quote|preview|confirmar|publish|finalizar|falta|atual|redeem|claim|signed)(?:\/|$)/i.test(route.route));
  // POST em links com token representa consumo/aceite de convite, não criação de recurso.
  // Sem isso, famílias públicas como convites/equipe/[token] e vendedores/convite/[token]
  // aparecem falsamente como CRUD incompleto.
  const createRoutes = item.routes.filter((route) => route.methods.includes('POST'));
  const tokenWorkflow = createRoutes.length > 0 && createRoutes.every((route) => isTokenWorkflowRoute(route.route));
  const likelyEntity = !actionOnly && !immutable && item.creates && !tokenWorkflow;
  return { actionOnly, immutable, tokenWorkflow, likelyEntity };
}

export async function executar() {
  ensureReportDir();
  const files = walk(API_ROOT).filter((file) => /route\.(?:ts|js)$/.test(file));
  const routes = files.map((file) => {
    const source = safeRead(file);
    return {
      route: routeOf(file),
      file: normalizePath(path.relative(ROOT, file)),
      methods: [...new Set([...source.matchAll(METHOD_RE)].map((match) => match[1]))],
    };
  });

  const routeNames = new Set(routes.map((route) => route.route));
  const byFamily = new Map();
  for (const route of routes) {
    const family = familyOf(route.route, routeNames);
    const item = byFamily.get(family) ?? { family, routes: [], methods: new Set() };
    item.routes.push(route);
    route.methods.forEach((method) => item.methods.add(method));
    byFamily.set(family, item);
  }

  const families = [...byFamily.values()].map((item) => {
    const base = {
      family: item.family,
      methods: [...item.methods].sort(),
      routes: item.routes,
      excluded: EXCLUDE_RE.test(item.family),
      creates: item.methods.has('POST'),
      updates: item.methods.has('PUT') || item.methods.has('PATCH'),
      deletes: item.methods.has('DELETE'),
    };
    return { ...base, ...classifyFamily(base) };
  });

  const review = families.filter((item) =>
    item.family !== 'api' && item.family !== 'api/broadcast' && !item.excluded && item.likelyEntity && item.creates && (!item.updates || !item.deletes)
  );

  const priority = review.map((item) => ({
    ...item,
    missing: [!item.updates ? 'editar' : null, !item.deletes ? 'excluir/arquivar/cancelar' : null].filter(Boolean),
    priority: !item.updates && !item.deletes ? 'alta' : 'media',
  })).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'alta' ? -1 : 1));

  fs.writeFileSync(path.join(REPORT_DIR, 'matriz-cobertura-crud.json'), JSON.stringify({ generatedAt: new Date().toISOString(), families, priority }, null, 2));

  const csv = ['familia,metodos,cria,edita,exclui,acao,imutavel,fluxo_token,candidato_revisao,prioridade,faltando,rotas'];
  for (const item of families) {
    const p = priority.find((candidate) => candidate.family === item.family);
    const values = [item.family, item.methods.join('|'), item.creates, item.updates, item.deletes, item.actionOnly, item.immutable, item.tokenWorkflow, Boolean(p), p?.priority ?? '', p?.missing?.join('|') ?? '', item.routes.map((route) => route.route).join('|')];
    csv.push(values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
  }
  fs.writeFileSync(path.join(REPORT_DIR, 'matriz-cobertura-crud.csv'), csv.join('\n'));

  const output = [result('OK', 'Cobertura CRUD', 'Matriz de recursos gerada', `${families.length} família(s) de API analisada(s). Ações operacionais, fluxos por token e endpoints imutáveis foram separados de recursos editáveis.`)];
  if (priority.length) {
    output.push(result(
      'AVISO',
      'Cobertura CRUD',
      'Recursos que merecem revisão funcional',
      priority.slice(0, 20).map((item) => `${item.family} [${item.priority}; falta ${item.missing.join(' e ')}]`).join(', ') + (priority.length > 20 ? ` e mais ${priority.length - 20}` : ''),
      'Validar na interface se o recurso precisa editar, excluir, arquivar, cancelar ou restaurar. Endpoints de ação já foram removidos desta lista.',
    ));
  } else {
    output.push(result('OK', 'Cobertura CRUD', 'Ciclo de manutenção coberto', 'Nenhum recurso editável com criação ficou sem operação de manutenção evidente.'));
  }
  return output;
}
