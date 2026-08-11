import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const controlPath = path.join(root, 'web/app/broadcast/control/[token]/page.tsx')
const cssPath = path.join(root, 'web/features/broadcast/broadcast.css')

const read = (file: string) => fs.readFileSync(file, 'utf8')

test('88Q controlador recebe o token OBS já fornecido pela mesma sessão', () => {
  const source = read(controlPath)
  expect(source).toContain("const [obsToken, setObsToken] = useState('')")
  expect(source).toContain("setObsToken(String(json.session?.obs_token || ''))")
  expect(source).toContain("`/broadcast/obs/${encodeURIComponent(obsToken)}`")
})

test('88Q prévia usa a rota oficial do Browser Source e não cria endpoint paralelo', () => {
  const source = read(controlPath)
  expect(source).toContain('aria-label="Prévia da saída OBS"')
  expect(source).toContain('src={obsPreviewUrl}')
  expect(source).not.toContain('/api/broadcast/preview')
  expect(source).not.toContain('/broadcast/preview/')
})

test('88Q deixa claro que prévia não representa conexão real do OBS', () => {
  const source = read(controlPath)
  expect(source).toContain('não um status de conexão do OBS')
  expect(source).not.toContain('OBS conectado')
  expect(source).not.toContain('OBS online')
})

test('88Q prévia é opt-in para não duplicar renderização sem necessidade', () => {
  const source = read(controlPath)
  expect(source).toContain('const [previewOpen, setPreviewOpen] = useState(false)')
  expect(source).toContain('previewOpen && obsPreviewUrl')
  expect(source).toContain("previewOpen ? 'Ocultar prévia' : 'Ver prévia'")
})

test('88Q oferece abertura direta da saída oficial sem expor novo token', () => {
  const source = read(controlPath)
  expect(source).toContain('href={obsPreviewUrl}')
  expect(source).toContain('Abrir saída')
  expect(source).not.toContain('controller_token')
})

test('88Q possui layout responsivo próprio sem restaurar CSS legado', () => {
  const css = read(cssPath)
  expect(css).toContain('.broadcast-output-preview')
  expect(css).toContain('.broadcast-output-preview-frame')
  expect(css).toContain('aspect-ratio: 16 / 9')
  expect(css).toContain('@media (max-width: 680px)')
  expect(css).not.toContain('.broadcast-control-grid')
  expect(css).not.toContain('.broadcast-control-card')
})
