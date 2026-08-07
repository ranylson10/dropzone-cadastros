import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88D — home autenticada com vitrine de vagas', () => {
  test('cards de vagas seguem estilo comercial com banner e sinais de venda', async () => {
    const component = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const css = read('web/features/home/authenticated-home.css')

    expect(component).toContain('banner_url?: string | null')
    expect(component).toContain('authenticated-home-vacancy-media')
    expect(component).toContain('authenticated-home-vacancy-badges')
    expect(component).toContain('vacancyRatio')
    expect(component).toContain('Garantir vaga')

    expect(css).toContain('.authenticated-home-vacancy-media')
    expect(css).toContain('background-size:cover')
    expect(css).toContain('.authenticated-home-vacancy-badges')
    expect(css).toContain('.authenticated-home-vacancy-line')
    expect(css).toContain('grid-template-columns:128px minmax(0,1fr)')
  })
})
