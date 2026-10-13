import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checks = []
let failures = 0

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}
function ok(label, condition, detail = '') {
  checks.push({ label, condition, detail })
  if (!condition) failures++
  console.log(`${condition ? 'OK  ' : 'ERRO'} ${label}${detail ? ` — ${detail}` : ''}`)
}
function filesUnder(dir) {
  const out = []
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(full)
    }
  }
  walk(path.join(root, dir))
  return out
}

const dialog = read('web/components/ui/Dialog.tsx')
const systemModal = read('web/components/layout/SystemModal.tsx')
const provider = read('web/components/feedback/FeedbackProvider.tsx')
const controller = read('web/components/feedback/feedback-controller.ts')
const layout = read('web/app/layout.tsx') + read('web/components/layout/ApplicationRuntime.tsx')
const css = read('web/styles/feedback.css')
const uiIndex = read('web/components/ui/index.ts')

ok('existe Dialog canônico', fs.existsSync(path.join(root, 'web/components/ui/Dialog.tsx')))
ok('Dialog usa portal no document.body', dialog.includes('createPortal') && dialog.includes('document.body'))
ok('Dialog controla Escape e foco', dialog.includes("event.key === 'Escape'") && dialog.includes("event.key !== 'Tab'"))
ok('Dialog bloqueia scroll com contador compartilhado', dialog.includes('modalLockCount') && dialog.includes('lockBodyScroll'))
ok('UI barrel exporta Dialog', uiIndex.includes("export * from './Dialog'"))
ok('SystemModal virou adapter do Dialog', systemModal.includes('<Dialog') && !systemModal.includes('system-modal-backdrop'))
ok('existe FeedbackProvider global', fs.existsSync(path.join(root, 'web/components/feedback/FeedbackProvider.tsx')))
ok('layout monta FeedbackProvider', layout.includes('<FeedbackProvider>') && layout.includes("@/components/feedback/FeedbackProvider"))
ok('layout carrega CSS global de feedback', layout.includes("@/styles/feedback.css"))
ok('provider expõe raiz runtime auditável', provider.includes('data-dz-feedback-root'))
ok('controller possui fila de confirmações', controller.includes('queue: FeedbackRequest[]') && controller.includes('confirmAction'))
ok('controller possui prompt compartilhado', controller.includes('promptAction'))
ok('controller possui aviso compartilhado', controller.includes('noticeAction'))
ok('feedback usa controles oficiais', provider.includes('Button, Dialog, Field, Input'))
ok('feedback possui estilo responsivo próprio', css.includes('@media (max-width: 640px)'))
ok('existe StatusMessage compartilhado', fs.existsSync(path.join(root, 'web/components/feedback/StatusMessage.tsx')))

const sourceFiles = filesUnder('web').filter((file) => /\.(tsx?|jsx?)$/.test(file))
const nativeDialogRegex = /\bwindow\.(?:confirm|prompt|alert)\s*\(/g
const nativeHits = []
let migratedCalls = 0
const migratedFiles = new Set()
for (const full of sourceFiles) {
  const source = fs.readFileSync(full, 'utf8')
  const relative = path.relative(root, full).split(path.sep).join('/')
  const matches = source.match(nativeDialogRegex)
  if (matches?.length) nativeHits.push(`${relative} (${matches.length})`)
  const count = relative === 'web/components/feedback/feedback-controller.ts' ? 0 : (source.match(/\b(?:confirmAction|promptAction)\s*\(/g) || []).length
  if (count) {
    migratedCalls += count
    migratedFiles.add(relative)
  }
}
ok('nenhum confirm/prompt/alert nativo permanece no web', nativeHits.length === 0, nativeHits.join(', '))
ok('migração cobre as 53 ações existentes', migratedCalls >= 53, `${migratedCalls} chamadas em ${migratedFiles.size} arquivos`)
ok('migração cobre todos os 22 módulos que tinham diálogo nativo', migratedFiles.size >= 22, `${migratedFiles.size} arquivos`)

if (failures) {
  console.error(`\nFalhou: ${failures} verificação(ões).`)
  process.exit(1)
}
console.log(`\nOK: ${checks.length}/${checks.length} verificações passaram. ${migratedCalls} ações usam o feedback global em ${migratedFiles.size} arquivos.`)
