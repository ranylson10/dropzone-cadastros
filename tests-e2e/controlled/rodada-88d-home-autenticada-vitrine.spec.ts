import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88D — home autenticada com vitrine de vagas', () => {
  test('cards de vagas seguem estilo comercial com banner e sinais de venda', async () => {
    const component = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const css = read('web/features/home/authenticated-home.css')

    expect(component).toContain('VacancyCard')
    expect(component).toContain('authenticated-home-vacancies-surface')
    expect(component).toContain('Ver catálogo completo')

    expect(css).toContain('.authenticated-home-vacancies-surface')
    expect(css).toContain('.authenticated-home-vacancy-skeleton')
  })
})
