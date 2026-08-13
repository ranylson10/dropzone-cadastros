import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const workspacePath = path.resolve(process.cwd(), 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const source = fs.readFileSync(workspacePath, 'utf8')

test('92G - cor do texto final usa a paleta oficial do projeto', async () => {
  expect(source).toContain('PaletteColorField label="Cor do texto final" value={generationCaptionColor} palette={currentPalette}')
  expect(source.match(/PaletteColorField label="Cor do texto final"/g)?.length).toBe(2)
})

test('92G - geração continua permitindo exceção de cor livre somente pelo componente da paleta', async () => {
  expect(source).toContain("<summary>{inPalette ? 'Usar cor livre' : `Cor fora da paleta: ${normalized}`}</summary>")
  expect(source).not.toContain('<label className="post-artworks-generation-caption-color">Cor do texto<input type="color"')
})

test('92G - texto da geração continua sem alterar o template salvo', async () => {
  expect(source).toContain('Este texto entra somente na imagem gerada. O template salvo não é alterado.')
  expect(source).toContain('mode === \'edit\' ? \'\' : generationCaption')
})
