import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 57 — fechamento integrado do sistema', () => {
  test('Liga reaproveita grupos e slots existentes sem estrutura paralela', () => {
    const teams = source('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    const structure = source('web/app/api/campeonatos/[id]/estrutura/route.ts')

    expect(teams).toContain("action: 'create_bulk'")
    expect(teams).toContain("nome: 'Liga'")
    expect(teams).toContain('grupos: data.liga.divisoes.map')
    expect(teams).toContain('Preparar agrupamentos')
    expect(structure).toContain(".from('campeonato_grupos')")
    expect(structure).toContain(".from('campeonato_slots')")
  })

  test('jogos continuam sendo a única fonte operacional das partidas', () => {
    const gamesRoute = source('web/app/api/campeonatos/[id]/jogos/route.ts')
    const gamesService = source('backend/src/campeonatos/jogos/jogos.service.ts')

    expect(gamesRoute).toContain('criarJogo')
    expect(gamesRoute).toContain('listarJogos')
    expect(gamesService).toContain(".from('campeonato_jogos')")
    expect(gamesService).toContain(".from('campeonato_jogos_grupos')")
    expect(gamesService).toContain(".from('campeonato_partidas_com_mapa')")
  })

  test('Agenda reaproveita os jogos e não exige agenda específica da Liga', () => {
    const agenda = source('backend/src/agenda/agenda.service.ts')
    const agendaRoute = source('web/app/api/agenda/route.ts')

    expect(agenda).toContain('listGamesByChampionshipIds')
    expect(agenda).toContain('function mapProjectedGame(row: any, editable = false)')
    expect(agenda).toContain('...rows.map((row) => mapProjectedGame(row')
    expect(agendaRoute).toContain('listAgenda({')
    expect(agenda).not.toContain('agenda_liga')
    expect(agendaRoute).not.toContain('calendario_liga')
  })

  test('formação da Liga preserva origem e bloqueia equipe duplicada', () => {
    const teamsApi = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    const plan = source('backend/src/campeonatos/league-season-plan.ts')

    expect(teamsApi).toContain('`liga_${requestedOrigin}`')
    expect(teamsApi).toContain('Esta equipe já ocupa uma vaga em outro agrupamento desta Liga.')
    expect(plan).toContain('Uma equipe ou line aparece em mais de uma sugestão.')
    expect(plan).toContain('teams.has(row.equipe_id) || lines.has(row.line_id)')
  })

  test('MatchResult permanece oficial e Garena é apenas enriquecimento tolerante a falha', () => {
    const matchResult = source('backend/src/campeonatos/estatisticas/matchresult.service.ts')
    const treinos = source('web/app/api/equipe/treinos/route.ts')

    expect(matchResult).toContain("origem: 'matchresult'")
    expect(matchResult).toContain('Não foi possível complementar o MatchResult com estatísticas detalhadas.')
    expect(matchResult).toContain('return { importacao_id: importacao.id, garena, reconciliacao, ...totals }')
    expect(treinos).toContain('garenaImportacoesResult.error')
    expect(treinos).toContain('armasResult.error ? []')
    expect(treinos).toContain('habilidadesResult.error ? []')
  })

  test('classificação usa serviço único e permite separar cada agrupamento', () => {
    const stats = source('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
    const statsRoute = source('web/app/api/campeonatos/[id]/estatisticas/equipes/route.ts')
    const reader = source('backend/src/campeonatos/league-season-read.ts')

    expect(statsRoute).toContain('listarEstatisticasEquipes')
    expect(statsRoute).toContain("grupoId: q.get('grupo_id')")
    expect(reader).toContain('listarEstatisticasEquipes(previous.campeonato_id, { grupoId: matches[0].id })')
    expect(stats).toContain('b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates')
    expect(stats).toContain('a.melhor_posicao ?? 999')
  })

  test('encerramento da Liga permanece indisponível até operação transacional validada', () => {
    const lifecycle = source('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(panel).toContain('<EditionLifecycleStatus championshipId={selectedChamp.id} />')
    expect(lifecycle).toContain('assertLifecycleActionSafe(action)')
    expect(lifecycle).toContain('lifecycle_write_mode:lifecycleMode()')
    expect(lifecycle).not.toContain('final_campeao_campeonato_equipe_id: isLeague ? null')
  })

  test('próxima season usa franquia e classificação anterior sem aplicar antes da confirmação', () => {
    const reader = source('backend/src/campeonatos/league-season-read.ts')
    const teamsPanel = source('web/features/campeonatos/equipes/components/LeagueSeasonPanel.tsx')

    expect(reader).toContain(".from('campeonato_edicoes')")
    expect(reader).toContain(".eq('franquia_id', edition.franquia_id)")
    expect(reader).toContain(".lt('numero_edicao', Number(edition.numero_edicao))")
    expect(teamsPanel).toContain('A classificação anterior é uma proposta.')
    expect(teamsPanel).toContain('confirmAction(')
    expect(teamsPanel).toContain("mode:'apply_league_season_suggestions',expected")
  })

  test('estrutura avançada antiga continua fora do fluxo visível', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(panel).not.toContain('CampeonatoStructureWorkspace')
    expect(panel).not.toContain('AdvancedStructureTab')
    expect(panel).toContain("rawSection === 'estrutura' || rawSection === 'estrutura_avancada' ? 'grupos'")
  })

  test('tipos principais continuam no mesmo formulário após fechamento da Liga', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("type: 'xtreino'")
    expect(form).toContain("type: 'confronto'")
    expect(form).toContain("value.tipo === 'copa'")
    expect(form).toContain("value.tipo === 'diario'")
    expect(form).toContain("value.tipo === 'liga'")
  })

  test('limpeza final mantém fontes corretas e não resta contador falso de jogadores', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(panel).not.toContain('const totalPlayers = 0')
    expect(panel).toContain('<CampeonatoJogadoresTab campeonatoId={selectedChamp.id} />')
    expect(panel).toContain('<CampeonatoEquipesTab campeonatoId={selectedChamp.id} readOnly />')
    expect(panel).toContain('<CampeonatoEstatisticasTab')
  })
})
