import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

const checks = []
function check(label, pass) {
  checks.push({ label, pass: Boolean(pass) })
  console.log(`${pass ? 'OK ' : 'ERRO'} ${label}`)
}

console.log('Auditoria R200 — fundação compartilhada de formulários')

const fieldFile = 'web/components/ui/Field.tsx'
const formFile = 'web/components/ui/Form.tsx'
const indexFile = 'web/components/ui/index.ts'
const cssFile = 'web/styles/ui-foundation.css'
const adapterFile = 'web/features/dropzone/components/form-fields.tsx'
const profileFile = 'web/components/forms/ProfileEditForm.tsx'
const playerFile = 'web/components/dropzone/forms/PlayerRegistrationForm.tsx'
const whatsappFile = 'web/components/forms/WhatsappPhoneField.tsx'
const inviteFile = 'web/app/i/[token]/page.tsx'

for (const file of [fieldFile, formFile, indexFile, cssFile, adapterFile, profileFile, playerFile, whatsappFile, inviteFile]) {
  check(`existe ${file}`, exists(file))
}

const field = read(fieldFile)
const form = read(formFile)
const index = read(indexFile)
const css = read(cssFile)
const adapter = read(adapterFile)
const profile = read(profileFile)
const player = read(playerFile)
const whatsapp = read(whatsappFile)
const invite = read(inviteFile)

check('Field canônico mantém compatibilidade .field', field.includes("'field'") && field.includes("'dz-ui-field'"))
check('Field canônico expõe erro/hint', field.includes('dz-ui-field__error') && field.includes('dz-ui-field__hint'))
check('Input/Select/Textarea canônicos usam dz-ui-control', /function Input/.test(field) && /function Select/.test(field) && /function Textarea/.test(field) && field.includes('dz-ui-control'))
check('FormGrid compartilhado existe', form.includes('export function FormGrid') && form.includes('data-dz-form-grid'))
check('FormActions compartilhado existe', form.includes('export function FormActions'))
check('FormMessage compartilhado existe', form.includes('export function FormMessage'))
check('FormSection compartilhado existe', form.includes('export function FormSection'))
check('barrel UI exporta Form', index.includes("export * from './Form'"))
check('adapter legado reexporta Field canônico', adapter.includes("export { Field } from '@/components/ui'"))
check('adapter legado não declara outro Field', !/export function Field\s*\(/.test(adapter))
check('LocationSearch usa Input compartilhado', adapter.includes('<Input') && adapter.includes("import { Field, Input } from '@/components/ui'"))
check('ProfileEditForm usa primitives compartilhados', profile.includes('FormGrid') && profile.includes('FormMessage') && profile.includes('<Input') && profile.includes('<Textarea') && profile.includes('<Button'))
check('ProfileEditForm não importa Field do adapter legado', !profile.includes('Field, UploadField'))
check('PlayerRegistrationForm usa Field/Input/Select/FormGrid compartilhados', player.includes("from '@/components/ui'") && player.includes('<FormGrid') && player.includes('<Input') && player.includes('<Select'))
check('WhatsappPhoneField usa Input/Select compartilhados', whatsapp.includes("from '@/components/ui'") && whatsapp.includes('<Input') && whatsapp.includes('<Select'))
check('inscrição pública não mantém Field local', invite.includes("import { Field } from '@/components/ui'") && !/function Field\s*\(/.test(invite))
check('CSS possui grid compartilhado', css.includes('.dz-form-grid') && css.includes('.dz-form-grid--2'))
check('CSS possui mensagens compartilhadas', css.includes('.dz-form-message--success') && css.includes('.dz-form-message--error'))
check('CSS possui responsividade de formulários', css.includes('@media (max-width: 760px)') && css.includes('.dz-form-actions > *'))

// A partir da R200 só deve existir uma declaração real de Field em TSX: a canônica.
const declarations = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.isFile() && full.endsWith('.tsx')) {
      const source = fs.readFileSync(full, 'utf8')
      if (/(?:export\s+)?function\s+Field\s*\(/.test(source)) declarations.push(path.relative(root, full).replaceAll('\\', '/'))
    }
  }
}
walk(path.join(root, 'web'))
check(`há uma única implementação de Field (${declarations.join(', ') || 'nenhuma'})`, declarations.length === 1 && declarations[0] === fieldFile)

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.error(`ERRO: ${failed.length}/${checks.length} verificações falharam.`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
