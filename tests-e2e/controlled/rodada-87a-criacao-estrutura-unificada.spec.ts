import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87A — criação guiada e estrutura unificada', () => {
  test('formulário usa etapas, temporada e revisão antes da criação', () => {
    const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(source).toContain("{ id: 'identity', label: 'Identidade' }")
    expect(source).toContain("{ id: 'season', label: 'Temporada' }")
    expect(source).toContain("{ id: 'format', label: 'Formato' }")
    expect(source).toContain("{ id: 'operation', label: 'Operação' }")
    expect(source).toContain("{ id: 'review', label: 'Revisão' }")
    expect(source).toContain('Nome histórico da competição')
    expect(source).toContain('Season / temporada')
    expect(source).toContain('Revisão da criação')
  })

  test('página da produtora consolida grupos e estrutura avançada em Estrutura', () => {
    const tabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const workspace = read('web/features/campeonatos/estrutura-avancada/CampeonatoStructureWorkspace.tsx')
    expect(tabs).toContain("{ id: 'estrutura', label: 'Estrutura' }")
    expect(tabs).not.toContain("id: 'estrutura_avancada'")
    expect(tabs).not.toContain("id: 'grupos'")
    expect(panel).toContain('CampeonatoStructureWorkspace')
    expect(workspace).toContain('Planejamento competitivo')
    expect(workspace).toContain('Fases, grupos e slots')
    expect(workspace).toContain('sem distribuição automática')
  })
})
