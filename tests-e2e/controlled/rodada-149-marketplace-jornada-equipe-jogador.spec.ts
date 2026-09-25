import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const route = read('web/app/api/me/competicoes/route.ts')
const directory = read('web/features/directory/components/DirectoryListClient.tsx')
const directoryPage = read('web/features/directory/components/DirectoryPage.tsx')
const directoryCss = read('web/features/directory/components/championship-directory.css')
const publicView = read('web/features/directory/components/ChampionshipPublicView.tsx')
const publicCss = read('web/features/directory/components/championship-public.css')
const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
const player = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
const globals = read('web/app/globals.css')

test.describe('Rodada 149 — marketplace e jornada de equipe/jogador', () => {
  test('rota privada centraliza a jornada competitiva do usuário', () => {
    expect(exists('web/app/api/me/competicoes/route.ts')).toBeTruthy()
    expect(route).toContain('const user = await getBearerUser(req)')
    expect(route).toContain('getAccountsByUserId(user.id)')
    expect(route).toContain('listControllableEquipes(user.id, accounts)')
    expect(route).toContain('return NextResponse.json({ team, player, purchases }')
  })

  test('jornada reúne equipe jogador e compras sem exibir reservas pendentes expiradas', () => {
    expect(route).toContain("from('campeonato_escalacoes_resumo')")
    expect(route).toContain("from('campeonato_jogadores')")
    expect(route).toContain("from('sistema_compras_vaga')")
    expect(route).toContain("if (status !== 'pendente') return true")
    expect(route).toContain('expiresAt > now')
  })

  test('marketplace usa a jornada real para identificar Meus campeonatos', () => {
    expect(directory).toContain("fetch('/api/me/competicoes'")
    expect(directory).toContain('setParticipatingChampionshipIds(participating)')
    expect(directory).toContain('setPurchaseByChampionship(purchases)')
    expect(directory).toContain('setFollowHrefByChampionship(followHrefs)')
    expect(directory).toContain('perfil=equipe&perfil_id=${encodeURIComponent(teamId)}&section=campeonatos')
    expect(directory).toContain('perfil=jogador&perfil_id=${encodeURIComponent(playerId)}&section=competicoes')
    expect(directory).toContain('setMyChampionshipIds(new Set<string>([...participating, ...purchases.keys()]))')
  })

  test('marketplace permite entrar por vagas Meus e ordenação comercial', () => {
    expect(directory).toContain("params.get('vagas') === '1'")
    expect(directory).toContain("params.get('meus') === '1'")
    expect(directory).toContain('Maior premiação')
    expect(directory).toContain('Menor preço')
    expect(directory).toContain('Mais vagas')
    expect(directory).toContain("sortMode === 'prize'")
  })

  test('cards trocam compra por acompanhar ou concluir entrada quando necessário', () => {
    expect(directory).toContain('Você já participa')
    expect(directory).toContain('Vaga comprada · falta concluir entrada')
    expect(directory).toContain('>Acompanhar <ChevronRight')
    expect(directory).toContain('>Concluir entrada <ChevronRight')
    expect(directory).toContain("price > 0 ? 'Comprar vaga' : 'Ver inscrição'")
  })

  test('página pública explica o caminho da vaga ao resultado', () => {
    expect(publicView).toContain('Da vaga ao resultado')
    expect(publicView).toContain('<strong>Garanta a vaga</strong>')
    expect(publicView).toContain('<strong>Monte a escalação</strong>')
    expect(publicView).toContain('<strong>Acompanhe a agenda</strong>')
    expect(publicView).toContain('<strong>Veja resultados</strong>')
  })

  test('painel da equipe mostra compras ainda não concluídas', () => {
    expect(team).toContain("fetch('/api/me/competicoes'")
    expect(team).toContain('pendingPurchasedVacancies')
    expect(team).toContain('Vagas compradas para concluir')
    expect(team).toContain('Concluir entrada')
  })

  test('painel da equipe encadeia vaga escalação agenda e resultados', () => {
    expect(team).toContain('className="team-competition-journey"')
    expect(team).toContain('<b>Vaga</b><small>confirmada</small>')
    expect(team).toContain('<b>Escalação</b>')
    expect(team).toContain('<b>Agenda</b>')
    expect(team).toContain('<b>Resultados</b>')
    expect(team).toContain('?aba=estatisticas')
  })

  test('jogador ganha área própria de competições', () => {
    expect(player).toContain("'resumo' | 'competicoes' | 'equipe' | 'desempenho' | 'perfil'")
    expect(player).toContain("setTab('competicoes')}>Competições</button>")
    expect(player).toContain('className="player-competitions-workspace"')
    expect(player).toContain('Minhas competições')
  })

  test('jogador acessa agenda resultados e campeonato sem procurar ferramentas internas', () => {
    expect(player).toContain('entry.agenda_href')
    expect(player).toContain('entry.resultados_href')
    expect(player).toContain('entry.campeonato_href')
    expect(player).toContain('className="player-competition-journey"')
  })

  test('marketplace apresenta propósito comercial antes da grade', () => {
    expect(directoryPage).toContain('MARKETPLACE DROPZONE')
    expect(directoryPage).toContain('Compare vagas, preço, premiação e próxima data.')
    expect(directoryCss).toContain('.directory-market-sort')
  })

  test('jornada permanece utilizável no mobile e não mistura captura ao vivo do Engine', () => {
    expect(publicCss).toContain('display:flex;overflow-x:auto;scroll-snap-type:x proximity')
    expect(globals).toContain('body .team-competition-journey{display:flex;overflow-x:auto')
    expect(globals).toContain('body .player-competition-journey{display:flex;overflow-x:auto')
    expect(route).not.toContain('dpz_engine_resultados')
    expect(route).not.toContain('/api/desktop/')
  })
})
