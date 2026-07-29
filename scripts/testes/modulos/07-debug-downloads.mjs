import fs from 'node:fs';
import path from 'node:path';
import { ROOT, fileHash, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

function auditDebugRoutes() {
  const out = [];
  const base = path.join(ROOT, 'web', 'app', 'api', 'debug');
  if (!fs.existsSync(base)) return [result('OK', 'Segurança', 'Rotas de debug', 'Nenhuma rota /api/debug encontrada.')];
  const routes = walk(base).filter((file) => file.endsWith('route.ts'));
  for (const file of routes) {
    const text = safeRead(file);
    const rel = normalizePath(path.relative(ROOT, file));
    const disabled = /status:\s*404/.test(text) && /Endpoint desabilitado/i.test(text);
    const productionBlock = /blockDebugRouteInProduction\s*\(/.test(text);
    const adminGuard = /requireSystemAdmin\s*\(/.test(text);
    const rawToken = /select\([^)]*\btoken\b/i.test(text) || /token_hash|access_token|refresh_token/i.test(text);

    if (disabled) {
      out.push(result('OK', 'Segurança', `Debug desabilitado: ${rel}`, 'A rota responde 404 explicitamente.'));
    } else if (productionBlock && adminGuard && !rawToken) {
      out.push(result('OK', 'Segurança', `Debug protegido: ${rel}`, 'Bloqueada em produção e protegida por administrador do sistema.'));
    } else {
      const missing = [!productionBlock && 'bloqueio em produção', !adminGuard && 'autorização de administrador', rawToken && 'remoção de token/segredo da resposta'].filter(Boolean).join('; ');
      out.push(result('ERRO', 'Segurança', `Debug inseguro: ${rel}`, `Falta: ${missing}.`, 'Remover a rota ou aplicar bloqueio de produção + requireSystemAdmin e nunca retornar tokens brutos.'));
    }
  }
  return out;
}

function auditDownloads() {
  const out = [];
  const files = walk(path.join(ROOT, 'database')).filter((file) => /DOWNLOAD_.*\.sql$/i.test(path.basename(file)));
  const byName = new Map();
  for (const file of files) {
    const name = path.basename(file).toLowerCase();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }

  for (const [name, group] of byName) {
    if (group.length > 1) {
      const hashes = new Set(group.map(fileHash));
      out.push(result(
        hashes.size === 1 ? 'AVISO' : 'ERRO',
        'Banco',
        `SQL DOWNLOAD duplicado: ${name}`,
        group.map((file) => normalizePath(path.relative(ROOT, file))).join(' | '),
        hashes.size === 1 ? 'Mover a cópia de documentação para database/downloads e manter apenas uma fonte.' : 'Os arquivos têm o mesmo nome, mas conteúdos diferentes. Comparar manualmente antes de qualquer remoção.',
      ));
    } else {
      out.push(result('AVISO', 'Banco', `SQL DOWNLOAD isolado: ${name}`, normalizePath(path.relative(ROOT, group[0])), 'Classificar como migration oficial, script operacional ou documentação. Não executar automaticamente.'));
    }
  }
  if (files.length === 0) out.push(result('OK', 'Banco', 'SQLs DOWNLOAD', 'Nenhum arquivo DOWNLOAD_*.sql encontrado.'));
  return out;
}

export async function executar() {
  return [...auditDebugRoutes(), ...auditDownloads()];
}
