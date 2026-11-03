import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import ts from 'typescript'

const root = process.cwd()
const identity = 'web/styles/dropzone-identity.css'
const errors = []
function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name)
    return entry.isDirectory() ? ['node_modules', '.next', 'public'].includes(entry.name) ? [] : walk(file) : [file]
  })
}
const relative = file => path.relative(root, file).replaceAll('\\', '/')
const files = walk(path.join(root, 'web'))
const palette = /^--(?:dz-(?:coal|paper|white|ink|muted|stroke|rust|orange)|ui-(?:bg|surface(?:-soft|-raised)?|text(?:-soft|-muted)?|muted|line|accent(?:-strong)?|primary(?:-light)?|gold(?:-light)?))$/
const featurePalette = /^--(?:profile-|lh-|dz-r04-|agenda-r23-|champ-(?:ink|muted|line|surface|gold)$)/
for (const file of files.filter(file => file.endsWith('.css'))) {
  if (relative(file) === identity) continue
  postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }).walkDecls(declaration => {
    if (/\.champ-public-(?:team|player)-row\s*>\s*span(?:\s*[,\{]|$)/.test(declaration.parent.selector || '') && /background|border-radius/.test(declaration.prop)) errors.push(`${relative(file)}:${declaration.source.start.line} styles every row span as an avatar; target the avatar class`)
    if (palette.test(declaration.prop)) errors.push(`${relative(file)}:${declaration.source.start.line} redefines ${declaration.prop}; change the shared identity instead`)
    if (featurePalette.test(declaration.prop) && /#|rgba?\(|hsla?\(/.test(declaration.value)) errors.push(`${relative(file)}:${declaration.source.start.line} creates a feature palette; alias a shared token`)
  })
}

const layout = fs.readFileSync('web/app/layout.tsx', 'utf8')
const imports = [...layout.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)].map(match => match[1])
if (imports.at(-1) !== '@/styles/dropzone-identity.css') errors.push('The canonical identity must be the last global CSS import')
if (imports.some(file => /mobile-app|mobile-ui|arena-motion/.test(file))) errors.push('A retired parallel theme is imported in the root layout')

// This checks source composition, not whether every conditional branch mounts.
// Focused operational outputs intentionally retain a full-screen composition.
const exceptions = new Map([
  ['web/app/broadcast/control/[token]/page.tsx', 'remote broadcast controller'],
  ['web/app/broadcast/obs/[token]/page.tsx', 'transparent OBS output'],
  ['web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx', 'full-screen scoring workspace'],
])
const cache = new Map()
function hasSharedFrame(file, seen = new Set()) {
  if (seen.has(file)) return false
  if (cache.has(file)) return cache.get(file)
  seen.add(file)
  const code = fs.readFileSync(file, 'utf8')
  if (/<(?:AppShell|PublicAppShell|TokenFlowPage)\b/.test(code) || /\bredirect\(/.test(code)) { cache.set(file, true); return true }
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true)
  const dependencies = []
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependencies.push(node.moduleSpecifier.text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const source of dependencies) {
    const base = source.startsWith('@/') ? path.join(root, 'web', source.slice(2)) : source.startsWith('.') ? path.resolve(path.dirname(file), source) : null
    if (!base) continue
    const target = ['.tsx', '.ts', '/index.tsx', '/index.ts'].map(extension => base + extension).find(candidate => fs.existsSync(candidate))
    if (target && hasSharedFrame(target, seen)) { cache.set(file, true); return true }
  }
  return false
}
const pages = files.filter(file => path.basename(file) === 'page.tsx' && relative(file).startsWith('web/app/'))
for (const page of pages) if (!exceptions.has(relative(page)) && !hasSharedFrame(page)) errors.push(`${relative(page)} has no reachable shared frame or redirect`)
for (const [file] of exceptions) if (!fs.existsSync(file)) errors.push(`Stale frame exception: ${file}`)
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log(`Theme contract passed: shared palette owner, feature aliases, import order and ${pages.length} page sources (${exceptions.size} explicit operational outputs). Browser state coverage is checked separately.`)
