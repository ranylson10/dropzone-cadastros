import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const producerPanel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const producerTabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
const financePanel = read('web/features/produtoras/components/ProducerFinancePanel.tsx')
const styles = read('web/app/globals.css')

test.describe('Rodada 147 — workspace e operação simplificados', () => {
  test('workspace da produtora passa a ter cinco áreas principais', () => {
    expect(producerPanel).toContain("type ProducerSection = 'visao' | 'campeonatos' | 'financeiro' | 'equipe' | 'configuracoes'")
    expect(producerPanel).toContain('<span>Visão geral</span>')
    expect(producerPanel).toContain('<span>Campeonatos</span>')
    expect(producerPanel).toContain('<span>Financeiro</span>')
    expect(producerPanel).toContain('<span>Equipe</span>')
    expect(producerPanel).toContain('<span>Configurações</span>')
  })

  test('visão geral é a entrada padrão do workspace', () => {
    expect(producerPanel).toContain("useState<ProducerSection>('visao')")
    expect(producerPanel).toContain('aria-label="Visão geral da produtora"')
    expect(producerPanel).toContain('Organize campeonatos sem navegar por tabelas internas.')
  })

  test('dashboard da produtora mostra indicadores operacionais sem inventar receita', () => {
    expect(producerPanel).toContain('producerApprovedChampionships')
    expect(producerPanel).toContain('producerPendingChampionships')
    expect(producerPanel).toContain('producerGamesCount')
    expect(producerPanel).toContain('producerTeamsCount')
    expect(producerPanel).toContain('Total no workspace')
  })

  test('financeiro da produtora separa carteira de gestão por campeonato', () => {
    expect(producerPanel).toContain('<ProducerFinancePanel')
    expect(producerPanel).toContain('Resumo gerencial')
    expect(financePanel).toContain('Carteira é saldo. Aqui ficam desempenho, custos, metas e projeções.')
    expect(financePanel).toContain('href="/carteira"')
  })

  test('equipe interna e cadastros provisórios ficam na mesma área de equipe', () => {
    expect(producerPanel).toContain("type ProducerTeamView = 'membros' | 'provisorias'")
    expect(producerPanel).toContain('Equipe interna')
    expect(producerPanel).toContain('Cadastros provisórios')
    expect(producerPanel).toContain('<ProducerMembersPanel producerId={props.account.id} />')
    expect(producerPanel).toContain('<ProvisionalTeamsPanel producerId={props.account.id} uploadPublicFile={props.uploadPublicFile} />')
  })

  test('configurações reforçam workspace privado e página do marketplace', () => {
    expect(producerPanel).toContain('Somente membros convidados')
    expect(producerPanel).toContain('Novas produtoras continuam sendo liberadas exclusivamente pela Central DropZone.')
    expect(producerPanel).toContain('Página pública de campeonatos')
    expect(producerPanel).toContain('producerCatalogLink')
  })

  test('campeonato fica com cinco áreas principais', () => {
    expect(producerTabs).toContain("| 'visao'")
    expect(producerTabs).toContain("| 'participantes'")
    expect(producerTabs).toContain("| 'operacao'")
    expect(producerTabs).toContain("| 'resultados'")
    expect(producerTabs).toContain("| 'financeiro'")
    expect(producerTabs).not.toContain("| 'estrutura'")
    expect(producerTabs).not.toContain("| 'jogos'\n  | 'resultados'\n  | 'mais'")
  })

  test('estrutura jogos regras e calls ficam escondidos dentro de operação', () => {
    expect(producerTabs).toContain("{ id: 'operacao', label: 'Operação', defaultTab: 'grupos', tabs: ['grupos', 'jogos', 'regulamento', 'calls'] }")
    expect(producerTabs).toContain("{ id: 'grupos', label: 'Estrutura' }")
    expect(producerTabs).toContain("{ id: 'jogos', label: 'Jogos e quedas' }")
    expect(producerTabs).toContain("{ id: 'regulamento', label: 'Regras' }")
  })

  test('participantes reúne equipes jogadores e inscrições', () => {
    expect(producerTabs).toContain("{ id: 'participantes', label: 'Participantes', defaultTab: 'equipes', tabs: ['equipes', 'jogadores', 'links'] }")
    expect(producerTabs).toContain("{ id: 'links', label: 'Inscrições' }")
  })

  test('visão do campeonato apresenta fluxo operacional guiado', () => {
    expect(producerPanel).toContain('Um campeonato, cinco áreas.')
    expect(producerPanel).toContain('<strong>Participantes</strong>')
    expect(producerPanel).toContain('<strong>Estrutura</strong>')
    expect(producerPanel).toContain('<strong>Jogos e quedas</strong>')
    expect(producerPanel).toContain('<strong>Resultados</strong>')
    expect(producerPanel).toContain('<strong>Financeiro</strong>')
    expect(producerPanel).toContain('Classificação, MVP e estatísticas')
  })

  test('áreas sensíveis continuam condicionadas às permissões da R146', () => {
    expect(producerPanel).toContain("if (item.id === 'operacao') return canOperateWorkspace || canScoreWorkspace")
    expect(producerPanel).toContain("if (item.id === 'financeiro') return canFinanceWorkspace || canCommercialWorkspace")
    expect(producerPanel).toContain("item.id !== 'financeiro' || canFinanceWorkspace")
    expect(producerPanel).toContain("item.id !== 'vendedores' || canCommercialWorkspace")
  })

  test('desktop e mobile usam cinco áreas sem espremer navegação', () => {
    expect(styles).toContain('.producer-hub-nav.producer-hub-nav-primary{grid-template-columns:repeat(5,minmax(0,1fr))')
    expect(styles).toContain('.producer-layout-ref .champ-workspace-nav{grid-template-columns:repeat(5,minmax(0,1fr))')
    expect(styles).toContain('.producer-hub-nav.producer-hub-nav-primary{display:flex;grid-template-columns:none;overflow-x:auto')
    expect(styles).toContain('.producer-dashboard-kpis{grid-template-columns:1fr 1fr}')
    expect(styles).toContain('.champ-operation-pipeline{grid-template-columns:1fr}')
  })
})
