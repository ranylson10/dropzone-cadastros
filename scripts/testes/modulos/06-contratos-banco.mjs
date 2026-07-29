import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

function splitColumns(value) {
  return value.split(',').map((item) => item.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function key(table, columns) {
  return `${table.toLowerCase()}::${[...columns].map((c) => c.toLowerCase()).sort().join(',')}`;
}

function collectUniqueContracts() {
  const contracts = new Map();
  const sqlFiles = walk(ROOT).filter((file) => file.endsWith('.sql'));
  for (const file of sqlFiles) {
    const text = safeRead(file);
    const rel = normalizePath(path.relative(ROOT, file));

    const indexRe = /create\s+unique\s+index(?:\s+if\s+not\s+exists)?\s+[\w\"]+\s+on\s+(?:public\.)?[\"]?([\w]+)[\"]?\s*\(([^)]+)\)(\s+where\s+[\s\S]*?;)?/gim;
    for (const match of text.matchAll(indexRe)) {
      const cols = splitColumns(match[2]).map((c) => c.replace(/[\"']/g, '').split(/\s+/)[0]);
      const partial = Boolean(match[3]);
      if (!partial) contracts.set(key(match[1], cols), { table: match[1], columns: cols, file: rel, kind: 'unique index' });
    }

    const alterRe = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?[\"]?([\w]+)[\"]?[\s\S]{0,500}?add\s+constraint\s+[\w\"]+\s+unique\s*\(([^)]+)\)/gim;
    for (const match of text.matchAll(alterRe)) {
      const cols = splitColumns(match[2]).map((c) => c.replace(/[\"']/g, '').split(/\s+/)[0]);
      contracts.set(key(match[1], cols), { table: match[1], columns: cols, file: rel, kind: 'unique constraint' });
    }

    const tableRe = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?[\"]?([\w]+)[\"]?\s*\(([\s\S]*?)\);/gim;
    for (const tableMatch of text.matchAll(tableRe)) {
      const uniqueRe = /(?:constraint\s+[\w\"]+\s+)?unique\s*\(([^)]+)\)/gim;
      for (const uniqueMatch of tableMatch[2].matchAll(uniqueRe)) {
        const cols = splitColumns(uniqueMatch[1]).map((c) => c.replace(/[\"']/g, '').split(/\s+/)[0]);
        contracts.set(key(tableMatch[1], cols), { table: tableMatch[1], columns: cols, file: rel, kind: 'inline unique' });
      }
    }
  }
  return contracts;
}


function collectPublishedUniqueContracts() {
  const file = path.join(ROOT, 'relatorios-testes', 'banco-publicado.json');
  const contracts = new Map();
  if (!fs.existsSync(file)) return contracts;
  try {
    const inventory = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const index of inventory.indexes ?? []) {
      const definition = String(index.definition ?? '');
      if (!/create\s+unique\s+index/i.test(definition)) continue;
      if (/\swhere\s/i.test(definition)) continue;
      const match = definition.match(/on\s+(?:public\.)?[\"]?([\w]+)[\"]?\s+using\s+\w+\s*\(([^)]+)\)/i);
      if (!match) continue;
      const cols = splitColumns(match[2]).map((c) => c.replace(/[\"']/g, '').split(/\s+/)[0]);
      contracts.set(key(match[1], cols), { table: match[1], columns: cols, file: 'banco publicado', kind: 'unique index publicado' });
    }
    for (const constraint of inventory.constraints ?? []) {
      if (String(constraint.constraint_type ?? constraint.type ?? '').toUpperCase() !== 'UNIQUE') continue;
      const definition = String(constraint.definition ?? '');
      const match = definition.match(/unique\s*\(([^)]+)\)/i);
      if (!match || !constraint.table_name) continue;
      const cols = splitColumns(match[1]).map((c) => c.replace(/[\"']/g, '').split(/\s+/)[0]);
      contracts.set(key(constraint.table_name, cols), { table: constraint.table_name, columns: cols, file: 'banco publicado', kind: 'unique constraint publicada' });
    }
  } catch {}
  return contracts;
}

export function collectUpserts() {
  const sourceFiles = walk(ROOT).filter((file) => /\.(?:ts|tsx|js|mjs)$/.test(file) && !normalizePath(file).includes('/node_modules/'));
  const found = [];
  for (const file of sourceFiles) {
    const text = safeRead(file);
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes('onConflict')) continue;
      const conflict = lines.slice(i, Math.min(lines.length, i + 3)).join('\n').match(/onConflict\s*:\s*['\"]([^'\"]+)['\"]/)
        || lines.slice(Math.max(0, i - 2), i + 1).join('\n').match(/onConflict\s*:\s*['\"]([^'\"]+)['\"]/);
      if (!conflict) continue;

      let upsertLine = -1;
      for (let cursor = i; cursor >= Math.max(0, i - 80); cursor -= 1) {
        if (lines[cursor].includes('.upsert(')) { upsertLine = cursor; break; }
      }
      if (upsertLine < 0) continue;

      let table = null;
      for (let cursor = upsertLine; cursor >= Math.max(0, upsertLine - 20); cursor -= 1) {
        const match = lines[cursor].match(/\.from\(\s*['\"]([^'\"]+)['\"]\s*\)/);
        if (match) { table = match[1]; break; }
      }
      if (!table) continue;
      found.push({ table, columns: splitColumns(conflict[1]), file: normalizePath(path.relative(ROOT, file)), line: i + 1 });
    }
  }
  return found;
}

export async function executar() {
  const out = [];
  const contracts = collectUniqueContracts();
  for (const [contractKey, contract] of collectPublishedUniqueContracts()) contracts.set(contractKey, contract);
  const upserts = collectUpserts();
  if (upserts.length === 0) return [result('AVISO', 'Contratos do banco', 'Upserts com onConflict', 'Nenhum contrato foi detectado pelo scanner estático.', 'Confirme se o padrão de código mudou.')];

  let confirmed = 0;
  let uncertain = 0;
  for (const item of upserts) {
    const contract = contracts.get(key(item.table, item.columns));
    if (contract) {
      confirmed += 1;
      out.push(result('OK', 'Contratos do banco', `${item.table} — ON CONFLICT confirmado`, `${item.columns.join(', ')} | ${item.file}:${item.line} | ${contract.kind} em ${contract.file}`));
    } else {
      uncertain += 1;
      out.push(result('AVISO', 'Contratos do banco', `${item.table} — ON CONFLICT sem UNIQUE localizado`, `${item.columns.join(', ')} | usado em ${item.file}:${item.line}`, 'Confirmar no banco publicado. Índice UNIQUE parcial não serve automaticamente como alvo de ON CONFLICT comum.', { table: item.table, columns: item.columns, file: item.file, line: item.line }));
    }
  }
  out.unshift(result('OK', 'Contratos do banco', 'Mapa estático de upserts', `${upserts.length} uso(s): ${confirmed} confirmado(s) pelas migrations ou banco publicado e ${uncertain} pendente(s) de confirmação no banco.`));
  return out;
}
