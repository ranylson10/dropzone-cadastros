import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87A — criação guiada e estrutura unificada', () => {
  test('formulário usa etapas próprias por formato e revisão antes da criação', () => {
    const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(source).toContain('const wizardPages:')
    expect(source).toContain("value.tipo === 'copa'")
    expect(source).toContain("value.tipo === 'diario'")
    expect(source).toContain("{ id: 'format' as const, label: 'Fases e grupos' }")
    expect(source).toContain("{ id: 'operation', label: 'Vagas e prêmio' }")
    expect(source).toContain("{ id: 'review', label: 'Revisão' }")
    expect(source).toContain('Nome histórico da competição')
    expect(source).toContain('Season / temporada')
    expect(source).toContain('Revisão da criação')
  })

  test('página da produtora centraliza fases, grupos e slots em Grupos e fases', () => {
    const tabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const workspace = read('web/features/campeonatos/estrutura-avancada/CampeonatoStructureWorkspace.tsx')

    expect(tabs).toContain("{ id: 'grupos', label: 'Grupos e slots' }")
    expect(tabs).not.toContain("id: 'estrutura_avancada'")
    expect(panel).toContain("rawSection === 'estrutura' || rawSection === 'estrutura_avancada' ? 'grupos'")
    expect(panel).toContain("tab === 'grupos'")
    expect(panel).toContain('CampeonatoEstruturaTab')
    expect(workspace).toContain('Planejamento competitivo')
    expect(workspace).toContain('Fases, grupos e slots')
    expect(workspace).toContain('sem distribuição automática')
  })
})
