import fs from 'node:fs'
import path from 'node:path'
import { ROOT, normalizePath, safeRead } from './util.mjs'

/** Follow audited domain services so thin HTTP adapters remain visible to scanners. */
export function backendServiceEvidence(routeSource, routeFile) {
  const sources = [{ source: routeSource, file: routeFile }]
  const files = new Set()
  const domains = ['dropzone/entities', 'lili', 'directory', 'ranking', 'campeonatos/team-search', 'campeonatos/estatisticas', 'campeonatos/invites', 'campeonatos/participacao-sync', 'campeonatos/manager-invite-service', 'campeonatos/manager-champ-invites', 'campeonatos/structure-group-transport', 'campeonatos/campeonato-permissions'].map(domain => path.resolve(ROOT, 'backend/src', domain))
  for (let index = 0; index < sources.length; index++) {
    const current = sources[index]
    const imports = /(?:\bfrom\s*|\bimport\s*\()(['"])([^'"]+)\1/g
    for (const match of current.source.matchAll(imports)) {
      const specifier = match[2]
      const base = specifier.startsWith('@backend/') ? path.resolve(ROOT, 'backend/src', specifier.slice(9))
        : specifier.startsWith('.') ? path.resolve(path.dirname(current.file), specifier) : null
      if (!base || !domains.some(domain => base.startsWith(domain + path.sep) || base === domain)) continue
      const file = [`${base}.ts`, path.join(base, 'index.ts')].find(candidate => fs.existsSync(candidate))
      if (!file || files.has(file)) continue
      files.add(file)
      sources.push({ source: safeRead(file), file })
    }
  }
  return { source: sources.map(item => item.source).join('\n'), files: [...files].map(file => normalizePath(path.relative(ROOT, file))) }
}
