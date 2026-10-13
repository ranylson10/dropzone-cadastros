import fs from 'node:fs'

const adminPath = 'web/app/admin/page.tsx'
const editorPath = 'web/features/admin/HomePageEditor.tsx'
const admin = fs.readFileSync(adminPath, 'utf8')
const editor = fs.readFileSync(editorPath, 'utf8')

const checks = [
  ['HomePageEditor existe', fs.existsSync(editorPath)],
  ['admin importa HomePageEditor', admin.includes("import { HomePageEditor } from '@/features/admin/HomePageEditor'")],
  ['tipo Tab contém home', /type Tab =[^\n]*'home'/.test(admin)],
  ['nav contém Página inicial', admin.includes("['home', 'Página inicial']")],
  ['admin renderiza HomePageEditor', admin.includes("tab === 'home' ? <HomePageEditor /> : null")],
  ['editor mantém raiz home-editor', /className="[^"]*home-editor/.test(editor)],
  ['editor usa controles canônicos', editor.includes("from '@/components/ui/Field'")],
]

console.log('Auditoria R201.3 — integração Admin > Página inicial')
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'ERRO'} ${label}`)
  if (!ok) failed++
}
if (failed) {
  console.error(`\nFalhou: ${failed} verificação(ões).`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
