import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const CSS_ROOTS = [path.join(ROOT, 'web', 'app'), path.join(ROOT, 'web', 'features')];

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
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
  const clean = stripComments(text);
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

    const list = selectors(src);
    const counts = new Map();
    for (const selector of list) counts.set(selector, (counts.get(selector) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, count]) => count >= 4).sort((a,b) => b[1] - a[1]);
    if (repeated.length) duplicateHeavy.push({ rel, repeated: repeated.slice(0, 8) });

    const importantCount = countMatches(src, /!important\b/g);
    if (importantCount) importantFiles.push(`${rel}: ${importantCount}`);

    const riskCount = countMatches(src, /min-width\s*:\s*(?:[5-9]\d{2}|\d{4,})px/gi);
    const overflowCount = countMatches(src, /overflow-x\s*:\s*(?:auto|scroll)/gi);
    if (riskCount && overflowCount) overflowRisks.push(`${rel}: ${riskCount} min-width grande(s), ${overflowCount} overflow-x`);
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
