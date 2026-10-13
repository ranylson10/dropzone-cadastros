import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
export function fixtureLoader(overrides = {}) {
  const root = process.cwd()
  overrides = { ...overrides }
  for (const [name, value] of Object.entries(overrides)) {
    if (name.startsWith('@backend/')) overrides[path.resolve(root, 'backend/src', name.slice(9)) + '.ts'] = value
    if (name.startsWith('@/')) overrides[path.resolve(root, 'web', name.slice(2)) + '.ts'] = value
  }
  const cache = new Map()
  return function load(filename) {
    const file = path.resolve(root, filename)
    if (file in overrides) return overrides[file]
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const require = specifier => {
      if (specifier in overrides) return overrides[specifier]
      const relative = specifier.startsWith('@backend/') ? path.join(root, 'backend/src', specifier.slice(9))
        : specifier.startsWith('@/') ? path.join(root, 'web', specifier.slice(2))
          : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null
      if (relative) for (const candidate of [`${relative}.ts`, path.join(relative, 'index.ts')]) if (fs.existsSync(candidate)) return load(candidate)
      return nativeRequire(specifier)
    }
    new Function('require', 'module', 'exports', output)(require, module, module.exports)
    return module.exports
  }
}
