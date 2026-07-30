import fs from 'node:fs';
import path from 'node:path';
import { ROOT, formatBytes, normalizePath, result, walk } from '../lib/util.mjs';

const RESIDUE_NAMES = new Set(['.next', 'node_modules', '.turbo', 'coverage', 'dist', 'build']);

function findDirs(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (RESIDUE_NAMES.has(entry.name)) found.push(full);
    if (!RESIDUE_NAMES.has(entry.name)) findDirs(full, found);
  }
  return found;
}

export async function executar() {
  const out = [];
  const residues = findDirs(ROOT);
  if (residues.length === 0) out.push(result('OK', 'Estrutura', 'Resíduos pesados', 'Nenhuma pasta de build/dependência encontrada na árvore auditada.'));
  else residues.forEach((dir) => out.push(result('AVISO', 'Estrutura', `Resíduo local: ${normalizePath(path.relative(ROOT, dir))}`, 'A pasta pode tornar ZIPs, buscas e cópias muito pesados.', 'Não inclua em entregas; limpe antes de compactar.')));

  const files = walk(ROOT, { ignored: ['.git', '.next', 'node_modules', 'relatorios-testes'] });
  const large = files.map((file) => ({ file, size: fs.statSync(file).size })).filter((item) => item.size >= 5 * 1024 * 1024).sort((a,b) => b.size-a.size);
  if (large.length === 0) out.push(result('OK', 'Estrutura', 'Arquivos grandes', 'Nenhum arquivo-fonte acima de 5 MB.'));
  else large.slice(0, 20).forEach(({ file, size }) => out.push(result('AVISO', 'Estrutura', `Arquivo grande: ${normalizePath(path.relative(ROOT, file))}`, formatBytes(size), 'Confirme se o arquivo precisa estar no repositório ou mova-o para Storage.')));

  const debugRoutes = files.filter((file) => normalizePath(path.relative(ROOT, file)).includes('web/app/api/debug/'));
  if (debugRoutes.length === 0) {
    out.push(result('OK', 'Segurança', 'Rotas de debug', 'Nenhuma rota /api/debug encontrada.'));
  } else {
    const unsafe = [];
    const protectedRoutes = [];

    for (const file of debugRoutes) {
      const source = fs.readFileSync(file, 'utf8');
      const disabled = /status\s*:\s*404/.test(source) && /Endpoint desabilitado|Nao encontrado|Não encontrado/i.test(source);
      const productionBlocked = /blockDebugRouteInProduction\s*\(/.test(source);
      const adminProtected = /requireSystemAdmin\s*\(/.test(source);

      if (disabled || (productionBlocked && adminProtected)) protectedRoutes.push(file);
      else unsafe.push(file);
    }

    if (unsafe.length === 0) {
      out.push(result('OK', 'Segurança', 'Rotas de debug controladas', `${protectedRoutes.length} rota(s) desabilitada(s) ou bloqueada(s) em produção com exigência de administrador.`));
    } else {
      unsafe.forEach((file) => out.push(result('AVISO', 'Segurança', 'Rota de debug sem proteção comprovada', normalizePath(path.relative(ROOT, file)), 'Desabilite com 404 ou combine bloqueio em produção com autenticação de administrador.')));
    }
  }

  return out;
}
