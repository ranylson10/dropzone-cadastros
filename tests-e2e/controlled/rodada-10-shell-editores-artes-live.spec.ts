import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 10 — shell dos editores de artes e live', () => {
  test('editor de artes usa a fundação escura e dourada sem alterar a lógica do workspace', () => {
    const css = read('web/features/campeonatos/artes-postagem/post-artworks.css')
    const source = read('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
    expect(css).toContain('.post-artworks-page{min-height:100vh;background:var(--ui-bg,#0c0d0f)')
    expect(css).toContain('.post-artworks-primary{background:var(--ui-primary,#c9b766)')
    expect(css).toContain('border-left-color:var(--ui-primary,#c9b766)')
    expect(css).not.toContain('.post-artworks-preview{position:relative;background-size:100% 100%;background-position:center;background-repeat:no-repeat;box-shadow:')
    expect(source).toContain('Salvar template')
    expect(source).toContain('Baixar imagem')
  })

  test('workspace de transmissão remove textura e glass do cabeçalho', () => {
    const css = read('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('background: var(--ui-bg, #0c0d0f);')
    expect(css).toContain('border-bottom: 1px solid rgba(245, 243, 237, .07);')
    expect(css).not.toContain('background: color-mix(in srgb, var(--surface) 94%, transparent);')
    expect(css).not.toContain('backdrop-filter: blur(10px);')
  })

  test('abas principais da transmissão seguem destaque dourado', () => {
    const css = read('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('.stream-package-header-tabs button.active{background:var(--ui-primary,#c9b766);color:#111214}')
  })

  test('mantém editor, planilha e pacote de transmissão conectados', () => {
    const source = read('web/features/campeonatos/stream/components/StreamWorkspace.tsx')
    expect(source).toContain('<StreamPackageEditor campeonatoId={props.campeonatoId} />')
    expect(source).toContain('<StreamSpreadsheetPanel')
    expect(source).toContain('triggerLabel="Dados"')
    expect(source).toContain('Transmissão ao vivo')
  })
})
