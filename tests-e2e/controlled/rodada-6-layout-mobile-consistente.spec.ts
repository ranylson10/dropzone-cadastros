import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 6 — largura mobile consistente entre home e campeonatos', () => {
  test('diretório antigo não volta a competir dentro do globals', () => {
    const globals = read('web/app/globals.css')
    expect(globals).not.toContain('Diretório de campeonatos em formato de cards comerciais')
    expect(globals).not.toContain('.directory-champ-card-grid{ width:min(1240px,calc(100% - 32px))')
  })

  test('campeonatos usa somente a folha consolidada e mantém ações rápidas', () => {
    const css = read('web/features/directory/components/championship-directory.css')
    expect(css).toContain('.directory-champ-wish,.directory-champ-cart-icon')
    expect(css).toContain('.directory-champ-quick-actions')
    expect(css).not.toContain('.directory-champ-card:before')
  })

  test('mobile respeita dez pixels de respiro lateral', () => {
    const css = read('web/features/directory/components/championship-directory.css')
    expect(css).toContain('.directory-champ-card-grid{grid-template-columns:1fr;gap:7px;width:calc(100% - 20px)}')
    expect(css).toContain('.champ-directory-tools{grid-template-columns:minmax(0,1fr) auto auto;width:calc(100% - 20px)')
    expect(css).toContain('.directory-market-filters{width:calc(100% - 20px)')
    expect(css).toContain('left:10px;right:10px')
  })
})
