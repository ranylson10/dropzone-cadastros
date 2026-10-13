import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const webRoot = path.join(root, 'web')
const canonical = path.join(webRoot, 'components', 'ui', 'Field.tsx')
const failures = []
const oks = []

function ok(label, condition, detail = '') {
  if (condition) {
    oks.push(label)
    console.log(`OK  ${label}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.error(`ERRO ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && full.endsWith('.tsx')) out.push(full)
  }
  return out
}

const files = walk(webRoot)
let rawControls = 0
let canonicalUsages = 0
let filesUsingCanonical = 0
const offenders = []

for (const file of files) {
  if (path.resolve(file) === path.resolve(canonical)) continue
  const source = fs.readFileSync(file, 'utf8')
  const raw = [...source.matchAll(/<(input|select|textarea)(?=[\s/>])/g)]
  if (raw.length) {
    rawControls += raw.length
    offenders.push(`${path.relative(root, file)} (${raw.length})`)
  }
  const uses = [...source.matchAll(/<Ui(Input|Select|Textarea)(?=[\s/>])/g)].length
  canonicalUsages += uses
  if (uses) filesUsingCanonical += 1
}

const canonicalSource = fs.readFileSync(canonical, 'utf8')
const css = fs.readFileSync(path.join(webRoot, 'styles', 'ui-foundation.css'), 'utf8')

console.log('Auditoria R201 — migração completa de controles de formulário')
ok('nenhum <input>/<select>/<textarea> direto fora do primitive canônico', rawControls === 0, offenders.join(', '))
ok('migração cobre pelo menos 600 usos reais', canonicalUsages >= 600, `encontrados ${canonicalUsages}`)
ok('migração cobre dezenas de arquivos reais', filesUsingCanonical >= 50, `encontrados ${filesUsingCanonical}`)
ok('Input canônico encaminha ref', /forwardRef<HTMLInputElement/.test(canonicalSource))
ok('Select canônico encaminha ref', /forwardRef<HTMLSelectElement/.test(canonicalSource))
ok('Textarea canônico encaminha ref', /forwardRef<HTMLTextAreaElement/.test(canonicalSource))
ok('Input canônico marca data-dz-control', /data-dz-control="input"/.test(canonicalSource))
ok('Select canônico marca data-dz-control', /data-dz-control="select"/.test(canonicalSource))
ok('Textarea canônico marca data-dz-control', /data-dz-control="textarea"/.test(canonicalSource))
ok('tipos checkbox/radio/file/color/range/hidden preservam comportamento nativo', /checkbox/.test(canonicalSource) && /radio/.test(canonicalSource) && /file/.test(canonicalSource) && /color/.test(canonicalSource) && /range/.test(canonicalSource) && /hidden/.test(canonicalSource))
ok('CSS possui tratamento neutro para controles nativos especiais', css.includes('.dz-ui-native-control'))

if (failures.length) {
  console.error(`\nFalhou: ${failures.length} verificação(ões).`)
  process.exit(1)
}
console.log(`OK: ${oks.length}/${oks.length} verificações passaram. ${canonicalUsages} controles migrados em ${filesUsingCanonical} arquivos.`)
