import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panelFile = path.join(root, 'web/features/dropzone/panels/equipe/EquipePanel.tsx')
const dashboardFile = path.join(root, 'web/features/dropzone/panels/equipe/TeamAnalyticsDashboard.tsx')
const apiFile = path.join(root, 'web/app/api/equipe/dashboard/route.ts')
const homeFile = path.join(root, 'web/features/dropzone/DropZoneHome.tsx')
const cssFile = path.join(root, 'web/app/globals.css')
const lineupsApiFile = path.join(root, 'web/app/api/equipe/escalacoes/route.ts')
const trainingsApiFile = path.join(root, 'web/app/api/equipe/treinos/route.ts')

test.describe('Dashboard analítico da equipe', () => {
  test('abre Dashboard como primeira aba e mantém Campeonatos separado', () => {
    const source = fs.readFileSync(panelFile, 'utf8')
    expect(source).toContain("useState<'dashboard' | 'campeonatos'")
    expect(source).toContain("('dashboard')")
    expect(source).toContain('>Dashboard</button>')
    expect(source).toContain('>Campeonatos</button>')
    expect(source).toContain('<TeamAnalyticsDashboard')
  })

  test('consulta somente a equipe ativa autorizada e usa as views competitivas reais', () => {
    const api = fs.readFileSync(apiFile, 'utf8')
    const home = fs.readFileSync(homeFile, 'utf8')
    expect(home).toContain('activeTeamId=')
    expect(api).toContain("await requireEquipeAccess(user.id, accounts, equipeId, 'ver')")
    expect(api).toContain("from('campeonato_estatisticas_equipes_detalhe')")
    expect(api).toContain("from('campeonato_estatisticas_mvp_detalhe')")
    expect(api).toContain("from('campeonato_configuracoes')")
    expect(api).toContain("from('campeonato_partidas')")
  })

  test('isola campeonatos, treinos, lines e jogadores na equipe ativa', () => {
    const panel = fs.readFileSync(panelFile, 'utf8')
    const lineupsApi = fs.readFileSync(lineupsApiFile, 'utf8')
    const trainingsApi = fs.readFileSync(trainingsApiFile, 'utf8')
    expect(panel).toContain('row.ref_id === props.activeTeamId')
    expect(panel).toContain('/api/equipe/escalacoes?equipe_id=')
    expect(panel).toContain('/api/equipe/treinos?equipe_id=')
    expect(lineupsApi).toContain("req.nextUrl.searchParams.get('equipe_id')")
    expect(trainingsApi).toContain("req.nextUrl.searchParams.get('equipe_id')")
    expect(lineupsApi).toContain("Sem permissão nesta equipe.")
    expect(trainingsApi).toContain("Sem permissão nesta equipe.")
  })

  test('oferece filtros reais de período, evento, line e mapa', () => {
    const dashboard = fs.readFileSync(dashboardFile, 'utf8')
    expect(dashboard).toContain('Mês atual')
    expect(dashboard).toContain('Ano atual')
    expect(dashboard).toContain('Todo histórico')
    expect(dashboard).toContain('setEventId')
    expect(dashboard).toContain('setLineId')
    expect(dashboard).toContain('setMapCode')
  })

  test('mostra evolução, mapas, eventos, jogadores, lines e premiações sem mock visual', () => {
    const dashboard = fs.readFileSync(dashboardFile, 'utf8')
    expect(dashboard).toContain('Pontos e abates ao longo do tempo')
    expect(dashboard).toContain('Onde a equipe rende melhor')
    expect(dashboard).toContain('Desempenho por campeonato')
    expect(dashboard).toContain('Desempenho individual')
    expect(dashboard).toContain('Comparativo interno')
    expect(dashboard).toContain('Valores atualmente em disputa')
    expect(dashboard).toContain('Nenhum resultado registrado neste recorte.')
  })

  test('possui layout responsivo próprio sem duplicar seletores antigos da equipe', () => {
    const css = fs.readFileSync(cssFile, 'utf8')
    expect(css).toContain('.team-analytics-dashboard')
    expect(css).toContain('.team-analytics-kpis')
    expect(css).toContain('.team-analytics-grid')
    expect(css).toContain('.team-analytics-line-chart')
    expect(css).toContain('@media(max-width:720px)')
  })
})
