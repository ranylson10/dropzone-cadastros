import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 26 hotfix real — tipagem do plano diário', () => {
  test('plan usa o tipo completo de estrutura_planejada', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("const plan: CampeonatoFormValue['estrutura_planejada'] =")
    expect(panel).toContain('Array.isArray(phase.diario_horarios)')
    expect(panel).toContain('phase.diario_horarios')
  })
})
