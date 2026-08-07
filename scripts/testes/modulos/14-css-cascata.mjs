import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const CSS_ROOTS = [path.join(ROOT, 'web', 'app'), path.join(ROOT, 'web', 'features')];
const DUPLICATE_SELECTOR_BASELINE = new Map([
  ['web/app/directory-hero.css', new Set([
    '.directory-rank-toolbar',
  ])],
  ['web/app/globals.css', new Set([
    '.producer-layout-ref',
    '.public-home-hero',
    '.detail-hero-ref',
    '.champ-public-nav',
    '.producer-layout-ref .detail-hero-ref',
    '.public-home-hero h1',
    '.producer-layout-ref .championship-nav-card',
    '.producer-layout-ref .championship-list',
    '.directory-toolbar',
    '.directory-list-row',
    '.champ-public-nav-btn',
    '.champ-public-panel',
    '.champ-public-info-grid',
    '.page-authenticated',
    '.home-card-grid',
    '.category-grid',
    '.home-how',
    '.lili-hub-tabs',
    '.lili-hub-tabs button',
    '.home-stat-strip',
    '.category-grid button',
    '.detail-stats-ref',
    '.directory-page-body',
    '.directory-profile-banner-inner',
    '.champ-public-banner .directory-profile-banner-inner',
    '.directory-list-row:hover',
    '.directory-page.page-authenticated',
    '.directory-profile-page.page-authenticated',
    '.directory-list',
    '.directory-hero-banner',
    '.directory-rank-hero',
    '.directory-hero-inner',
    '.directory-list-media',
    '.directory-result-count',
    '.directory-list-meta',
    '.champ-public-info-card',
    '.page-authenticated .shell',
    '.page-authenticated .account-strip',
    '.producer-layout-ref .championship-detail-card',
    '.system-modal-backdrop',
    '.system-modal',
    '.champ-public-nav-label',
    '.detail-logo-ref',
    '.public-home-alert',
    '.featured-championship',
    '.lili-games-head',
    '.lili-game-maps',
    '.lili-language-switch button',
    '.lili-profile-trigger',
    '.lili-language-switch',
    '.lili-hub-toolbar',
    '.producer-layout-ref .detail-logo-ref',
    '.public-home-header',
    '.public-home-access',
    '.public-home-search',
    '.home-stat-strip div',
    '.home-stat-strip b',
    '.home-stat-strip span',
    '.public-home-section',
    '.home-champ-media',
    '.home-champ-card',
  ])],
  ['web/app/header.css', new Set([
    '.app-admin-chip',
    '.app-profile-trigger',
  ])],
  ['web/app/vagas/vagas.css', new Set([
    '.vacancy-register',
    '.vacancies-hero',
    '.vacancy-banner',
    '.vacancy-next-date',
    '.vacancies-toolbar',
    '.vacancy-card',
    '.vacancies-page',
    '.vacancy-card-body',
    '.vacancy-persuasion',
    '.vacancies-grid',
    '.vacancies-hero h1',
    '.vacancy-groups',
    '.vacancy-groups span',
    '.vacancies-hero-count',
    '.vacancy-meta span',
  ])],
  ['web/features/agenda/agenda.css', new Set([
    '.agenda-month-nav',
  ])],
  ['web/features/campeonatos/rulebook/rulebook.css', new Set([
    '.rulebook-viewer-body',
    '.rulebook-toc',
  ])],
]);

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripKeyframes(text) {
  return text.replace(/@(?:-\w+-)?keyframes\s+[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
}

function braceBalance(text) {
  const clean = stripComments(text);
  let depth = 0;
  let minDepth = 0;
  for (const ch of clean) {
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      minDepth = Math.min(minDepth, depth);
    }
  }
  return { depth, minDepth };
}

function selectors(text) {
  const clean = stripKeyframes(stripComments(text));
  const out = [];
  const re = /(^|\})([^@{}][^{}]*)\{/gms;
  let match;
  while ((match = re.exec(clean))) {
    const raw = match[2].trim();
    if (!raw || raw.startsWith('@')) continue;
    for (const selector of raw.split(',')) {
      const normalized = selector.replace(/\s+/g, ' ').trim();
      if (normalized) out.push(normalized);
    }
  }
  return out;
}

function countMatches(text, re) {
  return [...text.matchAll(re)].length;
}

function countUnexpectedImportant(text, rel) {
  if (rel.endsWith('rulebook.css')) return 0;

  let currentSelector = '';
  let count = 0;
  for (const line of stripComments(text).split(/\r?\n/)) {
    const beforeBrace = line.includes('{') ? line.slice(0, line.indexOf('{')).trim() : '';
    if (beforeBrace && !beforeBrace.startsWith('@')) currentSelector = beforeBrace;
    if (!/!important\b/.test(line)) continue;
    if (rel.endsWith('stream.css') && currentSelector.includes('stream-editor-scroll-lock')) continue;
    count += countMatches(line, /!important\b/g);
  }
  return count;
}

function repeatedSelectors(text) {
  const list = selectors(text);
  const counts = new Map();
  for (const selector of list) {
    const normalized = selector.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 4)
    .sort((a,b) => b[1] - a[1]);
}

const INTENTIONAL_SCROLL_RE = /(table|sheet|editor|canvas|stream|agenda-month|agenda-week|calendar|toolbar|tabs|groups|nav|list|grid|workspace|scroller|overflow)/i;

function overflowRiskRules(text) {
  const clean = stripKeyframes(stripComments(text));
  const out = [];
  const re = /([^@{}][^{}]*)\{([^{}]*)\}/gms;
  let match;
  while ((match = re.exec(clean))) {
    const selector = match[1].replace(/\s+/g, ' ').trim();
    const body = match[2];
    if (!/min-width\s*:\s*(?:[5-9]\d{2}|\d{4,})px/gi.test(body)) continue;
    if (/max-width\s*:|width\s*:\s*min\(|min-width\s*:\s*min\(/i.test(body)) continue;
    if (INTENTIONAL_SCROLL_RE.test(selector)) continue;
    out.push(selector);
  }
  return out;
}

export async function executar() {
  const out = [];
  const files = CSS_ROOTS.flatMap((root) => walk(root).filter((file) => file.endsWith('.css')));

  const malformed = [];
  const duplicateHeavy = [];
  const importantFiles = [];
  const overflowRisks = [];

  for (const file of files) {
    const rel = normalizePath(path.relative(ROOT, file));
    const src = safeRead(file);
    const balance = braceBalance(src);
    if (balance.depth !== 0 || balance.minDepth < 0) {
      malformed.push(`${rel} (saldo ${balance.depth}, mínimo ${balance.minDepth})`);
    }

    const repeated = repeatedSelectors(src);
    const baseline = DUPLICATE_SELECTOR_BASELINE.get(rel) || new Set();
    const unexpectedRepeated = repeated.filter(([selector]) => !baseline.has(selector));
    if (unexpectedRepeated.length) duplicateHeavy.push({ rel, repeated: unexpectedRepeated.slice(0, 8) });

    const importantCount = countUnexpectedImportant(src, rel);
    if (importantCount) importantFiles.push(`${rel}: ${importantCount}`);

    const risky = overflowRiskRules(src);
    if (risky.length) overflowRisks.push(`${rel}: ${risky.slice(0, 6).join(', ')}`);
  }

  out.push(result(
    malformed.length ? 'ERRO' : 'OK',
    'CSS',
    'Sintaxe estrutural das folhas',
    malformed.length ? malformed.join('; ') : `${files.length} arquivo(s) CSS com chaves balanceadas.`,
    malformed.length ? 'Corrija chaves extras/ausentes antes de buildar. Esse erro já causou falha de Turbopack anteriormente.' : '',
  ));

  out.push(result(
    importantFiles.length ? 'AVISO' : 'OK',
    'CSS',
    'Uso de !important',
    importantFiles.length ? importantFiles.join('; ') : 'Nenhum !important encontrado.',
    importantFiles.length ? 'Revisar usos porque podem bloquear ajustes responsivos e gerar guerra de especificidade.' : '',
  ));

  if (duplicateHeavy.length) {
    out.push(result(
      'AVISO',
      'CSS',
      'Seletores repetidos em excesso',
      duplicateHeavy.slice(0, 8).map((item) => `${item.rel}: ${item.repeated.map(([s,c]) => `${s}×${c}`).join(', ')}`).join(' | '),
      'Consolidar seletores repetidos quando possível. Duplicação elevada aumenta o risco de uma regra antiga vencer a correção nova.',
    ));
  } else {
    out.push(result('OK', 'CSS', 'Seletores repetidos em excesso', 'Nenhum seletor apareceu 4 ou mais vezes na mesma folha.'));
  }

  out.push(result(
    overflowRisks.length ? 'AVISO' : 'OK',
    'CSS',
    'Risco de rolagem horizontal',
    overflowRisks.length ? overflowRisks.slice(0, 20).join('; ') : 'Nenhuma combinação relevante de min-width grande com overflow-x encontrada.',
    overflowRisks.length ? 'Validar essas telas no Playwright mobile; tabelas e editores podem ter scroll intencional, mas páginas públicas não devem cortar conteúdo.' : '',
  ));

  const viewFile = path.join(ROOT, 'web', 'features', 'directory', 'components', 'ChampionshipPublicView.tsx');
  const view = safeRead(viewFile);
  const cssImportOk = view.includes("import './championship-public.css'") || view.includes('import "./championship-public.css"');
  const importAfterVagas = view.indexOf('championship-public.css') > view.indexOf('vagas.css');
  out.push(result(
    cssImportOk && importAfterVagas ? 'OK' : 'ERRO',
    'CSS',
    'CSS específico do campeonato público',
    cssImportOk && importAfterVagas
      ? 'championship-public.css está importado depois de vagas.css, preservando a camada específica da tela.'
      : 'Importação ausente ou em ordem insegura.',
    cssImportOk && importAfterVagas ? '' : 'Importe championship-public.css depois das folhas genéricas usadas pelo componente.',
  ));

  const publicCss = safeRead(path.join(ROOT, 'web', 'features', 'directory', 'components', 'championship-public.css'));
  const mobileOwnList = /champ-stats-mobile-list/.test(publicCss) && /champ-stats-mobile-row/.test(publicCss);
  out.push(result(
    mobileOwnList ? 'OK' : 'AVISO',
    'CSS',
    'Estatísticas públicas mobile isoladas',
    mobileOwnList ? 'A versão mobile possui estrutura/lista própria e não depende da largura da tabela desktop.' : 'Não foi localizada a estrutura mobile própria esperada.',
    mobileOwnList ? '' : 'Manter uma estrutura mobile separada reduz conflitos com min-width e table-layout das tabelas desktop.',
  ));

  return out;
}
