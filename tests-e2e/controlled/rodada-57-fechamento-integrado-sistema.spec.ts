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
    expect(agenda).toContain('items.push(mapGameEvent(game')
    expect(agendaRoute).toContain('listAgenda({')
    expect(agenda).not.toContain('agenda_liga')
    expect(agendaRoute).not.toContain('calendario_liga')
  })

  test('formação da Liga preserva origem e bloqueia equipe duplicada', () => {
    const teamsApi = source('web/app/api/campeonatos/[id]/equipes/route.ts')

    expect(teamsApi).toContain('`liga_${requestedOrigin}`')
    expect(teamsApi).toContain('Esta equipe já ocupa uma vaga em outro agrupamento desta Liga.')
    expect(teamsApi).toContain('apareceu em mais de uma sugestão')
  })

  test('MatchResult permanece oficial e Garena é apenas enriquecimento tolerante a falha', () => {
    const matchResult = source('backend/src/campeonatos/estatisticas/matchresult.service.ts')
    const treinos = source('web/app/api/equipe/treinos/route.ts')

    expect(matchResult).toContain("origem: 'matchresult'")
    expect(matchResult).toContain('Não foi possível complementar o MatchResult com estatísticas detalhadas.')
    expect(matchResult).toContain('return { importacao_id: importacao.id, garena, ...totals }')
    expect(treinos).toContain('garenaImportacoesResult.error')
    expect(treinos).toContain('armasResult.error ? []')
    expect(treinos).toContain('habilidadesResult.error ? []')
  })

  test('classificação usa serviço único e permite separar cada agrupamento', () => {
    const stats = source('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
    const statsRoute = source('web/app/api/campeonatos/[id]/estatisticas/equipes/route.ts')
    const teamsApi = source('web/app/api/campeonatos/[id]/equipes/route.ts')

    expect(statsRoute).toContain('listarEstatisticasEquipes')
    expect(statsRoute).toContain("grupoId: q.get('grupo_id')")
    expect(teamsApi).toContain('listarEstatisticasEquipes(previousChampionshipId, { grupoId: String(group.id) })')
    expect(stats).toContain('b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates')
    expect(stats).toContain('a.melhor_posicao ?? 999')
  })

  test('encerramento da Liga valida cada agrupamento e fecha novas inscrições', () => {
    const lifecycle = source('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(panel).toContain('Encerrar campeonato')
    expect(panel).toContain('Reabrir season')
    expect(lifecycle).toContain("action === 'publish_final'")
    expect(lifecycle).toContain('listarEstatisticasEquipes(campeonatoId, { grupoId: String(group.id) })')
    expect(lifecycle).toContain('aceita_novas_inscricoes_equipes: false')
    expect(lifecycle).toContain('final_campeao_campeonato_equipe_id: isLeague ? null')
  })

  test('próxima season usa franquia e classificação anterior sem aplicar antes da confirmação', () => {
    const teamsApi = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    const teamsPanel = source('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')

    expect(teamsApi).toContain(".from('campeonato_edicoes')")
    expect(teamsApi).toContain(".eq('franquia_id', currentEdition.franquia_id)")
    expect(teamsApi).toContain(".lt('numero_edicao', Number(currentEdition.numero_edicao))")
    expect(teamsPanel).toContain('Nenhuma equipe muda de agrupamento até você confirmar.')
    expect(teamsPanel).toContain('window.confirm(')
    expect(teamsPanel).toContain('aplicarSugestoesSeasonLiga')
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
    expect(panel).toContain('<CampeonatoEquipesTab campeonatoId={selectedChamp.id} />')
    expect(panel).toContain('<CampeonatoEstatisticasTab')
  })
})
