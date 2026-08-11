import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88A — fluxo enxuto do campeonato', () => {
  test('painel da produtora abre em visão geral e guarda ferramentas avançadas', () => {
    const tabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(tabs).toContain("| 'visao'")
    expect(tabs).toContain("{ id: 'visao', label: 'Visão geral' }")
    expect(tabs).toContain("{ id: 'estatisticas', label: 'Pontuação' }")
    expect(panel).toContain("useState<ProducerTab>('visao')")
    expect(panel).toContain("const mainTabs: ProducerTab[] = ['visao', 'equipes', 'grupos', 'jogos', 'estatisticas', 'stream']")
    expect(panel).toContain('Mais ferramentas')
    expect(panel).toContain('champ-subtabs-primary')
    expect(panel).toContain('champ-subtabs-more')
  })

  test('visão geral oferece atalhos e checklist operacional', () => {
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const css = read('web/app/globals.css')

    expect(panel).toContain('Monte e opere o campeonato por etapas.')
    expect(panel).toContain('Grupos e fases')
    expect(panel).toContain('Adicionar equipes')
    expect(panel).toContain('Criar jogo')
    expect(panel).toContain('Abrir pontuador')
    expect(panel).toContain('Gerar link')
    expect(panel).toContain('Vendas')
    expect(panel).toContain('Checklist operacional')
    expect(panel).toContain('O que falta para rodar?')
    expect(panel).toContain('operationalChecklist')
    expect(css).toContain('.champ-overview-checklist')
  })

  test('jogos têm criação contextual por fase/grupo e acesso direto ao pontuador', () => {
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const css = read('web/app/globals.css')

    expect(panel).toContain('function startCreateGame')
    expect(panel).toContain('phaseId: phase.id')
    expect(panel).toContain('groupIds: [group.id]')
    expect(panel).toContain('Criar jogo rápido:')
    expect(panel).toContain('window.open(`/campeonatos/${selectedChamp.id}/pontuador/${gameRow.id}`')
    expect(css).toContain('.game-quick-group-row')
    expect(css).toContain('.champ-overview-flow')
  })

  test('mobile seleciona campeonato na mesma tela e nomes do hub são mais claros', () => {
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(panel).not.toContain("section=equipes")
    expect(panel).not.toContain("window.matchMedia('(max-width: 760px)'")
    expect(panel).toContain('setTab(\'visao\')')
    expect(panel).toContain('Equipe interna')
    expect(panel).toMatch(/P(?:á|Ã¡)gina de vagas/)
  })
})
