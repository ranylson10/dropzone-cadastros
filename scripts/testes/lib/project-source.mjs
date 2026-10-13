import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

export function readProjectSource(root, relative) {
  const file = path.resolve(root, relative)
  const source = fs.readFileSync(file, 'utf8')
  // Inspect the implementation behind thin Next pages, rather than checking
  // only whether a string happens to be present in a routing adapter.
  const forwarded = source.match(/export\s*\{\s*default\s*\}\s*from\s*['"]@\/([^'"]+)['"]/)
  return forwarded ? source + '\n' + readProjectSource(root, `web/${forwarded[1]}.tsx`) : source
}

export function hasResponsiveCss(source, selector) {
  let found = false
  postcss.parse(source).walkAtRules('media', media => {
    if (!/max-width\s*:/.test(media.params)) return
    media.walkRules(rule => { if (rule.selector.includes(selector)) found = true })
  })
  return found
}
