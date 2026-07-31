import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

test.describe('Estrutura avançada — escolha manual de grupos', () => {
  test('banco registra configuração e histórico sem distribuição automática', async () => {
    const migration = fs.readFileSync(path.join(root, 'database/migrations/20260731_campeonatos_escolha_manual_grupos.sql'), 'utf8')
    expect(migration).toContain('campeonato_grupo_escolha_configuracoes')
    expect(migration).toContain('campeonato_grupo_escolha_historico')
    expect(migration).toContain("origem in ('administrador','equipe')")
    expect(migration).not.toContain('distribuicao_automatica')
  })

  test('API oferece escolha pela equipe e alocação manual pelo administrador', async () => {
    const adminRoute = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts'), 'utf8')
    const teamRoute = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/escolha-grupo/route.ts'), 'utf8')
    const component = fs.readFileSync(path.join(root, 'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'), 'utf8')
    expect(adminRoute).toContain("action === 'assign_group_manual'")
    expect(adminRoute).toContain("action === 'save_group_choice_config'")
    expect(teamRoute).toContain('A escolha de grupos não está aberta')
    expect(teamRoute).toContain('A última vaga deste grupo acabou de ser ocupada')
    expect(component).toContain('Nenhum grupo é distribuído automaticamente')
    expect(component).toContain('Escolha pelas equipes')
  })
})
