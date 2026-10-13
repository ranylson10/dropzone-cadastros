import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'web/components/ui/Button.tsx',
  'web/components/ui/IconButton.tsx',
  'web/components/ui/Surface.tsx',
  'web/components/ui/Badge.tsx',
  'web/components/ui/SectionHeader.tsx',
  'web/components/ui/EmptyState.tsx',
  'web/components/ui/Field.tsx',
  'web/components/ui/index.ts',
  'web/styles/ui-foundation.css',
]

let failed = false
console.log('Auditoria R196 — fundação de UI compartilhada')
for (const file of required) {
  const full = path.join(root, file)
  const ok = fs.existsSync(full) && fs.statSync(full).size > 0
  console.log(`${ok ? 'OK ' : 'ERRO'} ${file}`)
  failed ||= !ok
}

const layout = fs.readFileSync(path.join(root, 'web/app/layout.tsx'), 'utf8')
const modal = fs.readFileSync(path.join(root, 'web/components/layout/SystemModal.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/styles/ui-foundation.css'), 'utf8')

const checks = [
  ['layout importa ui-foundation.css', layout.includes("@/styles/ui-foundation.css")],
  ['SystemModal delega para Dialog compartilhado', modal.includes("import { Dialog } from '@/components/ui'") && modal.includes('<Dialog')],
  ['tokens compartilhados presentes', css.includes('--dz-ui-surface:') && css.includes('--dz-ui-accent:')],
  ['button compartilhado estilizado', css.includes('.dz-ui-button--primary')],
  ['field compartilhado estilizado', css.includes('.dz-ui-control')],
]
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK ' : 'ERRO'} ${label}`)
  failed ||= !ok
}

if (failed) process.exit(1)
console.log('OK: fundação R196 íntegra e adoção atual via Dialog compartilhado confirmada.')
