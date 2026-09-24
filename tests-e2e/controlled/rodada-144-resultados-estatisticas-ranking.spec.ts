import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const producerStats = read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
const publicChamp = read('web/features/directory/components/ChampionshipPublicView.tsx')
const rankHub = read('web/components/lili/LiliRankHub.tsx')
const rankPage = read('web/app/rank/page.tsx')
const rankStyles = read('web/app/system.css')
const publicStyles = read('web/features/directory/components/championship-public.css')
const producerStyles = read('web/features/campeonatos/estatisticas/campeonato-estatisticas.css')

test.describe('Rodada 144 — resultados, estatísticas e ranking', () => {
  test('painel da produtora mostra andamento real dos resultados', () => {
    expect(producerStats).toContain('finalizedDrops')
    expect(producerStats).toContain('pendingDrops')
    expect(producerStats).toContain('quedas finalizadas')
    expect(producerStats).toContain('Finalize as quedas restantes para fechar a classificação.')
    expect(producerStats).toContain('Todos os resultados cadastrados estão finalizados.')
  })

  test('entrada do pontuador vira ação orientada a resultado sem mudar contrato interno', () => {
    expect(producerStats).toContain('Lançar resultados')
    expect(producerStats).toContain("tab === 'pontuador'")
    expect(producerStats).toContain(`/campeonatos/${'${props.campeonatoId}'}/pontuador/${'${filters.jogo_id}'}`)
  })

  test('média de kills por queda não é mais apresentada como KD', () => {
    expect(producerStats).toContain('killsPerDropValue')
    expect(producerStats).toContain('<small>K/Q</small>')
    expect(publicChamp).toContain('killsPerDropLabel')
    expect(publicChamp).toContain('<th>K/Q</th>')
    expect(publicChamp).toContain('K/Q {killsPerDropLabel(row)}')
    expect(producerStats).not.toContain('<small>K.D</small>')
    expect(publicChamp).not.toContain('<th>K.D</th>')
  })

  test('campeonato público exibe líder MVP e recorte atual antes da tabela', () => {
    expect(publicChamp).toContain('champ-public-stats-summary')
    expect(publicChamp).toContain('<small>Líder</small>')
    expect(publicChamp).toContain('<small>MVP</small>')
    expect(publicChamp).toContain('<small>Recorte</small>')
    expect(publicChamp).toContain('scopeLabel')
  })

  test('campeonato público comunica atraso configurado de publicação', () => {
    expect(publicChamp).toContain('setPublication(teamData.publicacao || playerData.publicacao || championData?.publicacao || null)')
    expect(publicChamp).toContain('Publicação imediata')
    expect(publicChamp).toContain('Publicação com ${minutes} min de atraso')
    expect(publicChamp).toContain('Dados oficiais publicados')
  })

  test('estado vazio público explica que o resultado ainda não foi publicado', () => {
    expect(publicChamp).toContain('A organização ainda não publicou classificação neste recorte.')
    expect(publicChamp).toContain('A organização ainda não publicou MVP neste recorte.')
  })

  test('ranking pode ser pesquisado sem nova chamada ao servidor', () => {
    expect(rankHub).toContain("const [search, setSearch] = useState('')")
    expect(rankHub).toContain('const rows = useMemo(() =>')
    expect(rankHub).toContain('Buscar ${modeLabel.toLocaleLowerCase')
    expect(rankHub).toContain('Tente outro nome, tag ou ID.')
  })

  test('ranking distingue score DropZone de pontos do campeonato', () => {
    expect(rankHub).toContain('Score DZ')
    expect(rankHub).toContain('score DropZone')
    expect(rankHub).toContain('Pontos do campeonato e score DropZone são medidas diferentes.')
    expect(rankPage).toContain('score competitivo separado dos pontos de cada torneio')
  })

  test('ranking mostra data de atualização e metodologia', () => {
    expect(rankHub).toContain('updated_at: payload.updated_at')
    expect(rankHub).toContain('Como funciona')
    expect(rankHub).toContain('desempenho oficial')
    expect(rankHub).toContain('influência limitada')
  })

  test('detalhes do ranking priorizam métricas principais e recolhem avançadas', () => {
    expect(rankHub).toContain('primaryMetrics(mode, selectedRow)')
    expect(rankHub).toContain('advancedMetrics(mode, selectedRow)')
    expect(rankHub).toContain('directory-rank-detail-advanced')
    expect(rankHub).toContain('Mais estatísticas')
  })

  test('ranking leva ao perfil completo quando há identidade pública', () => {
    expect(rankHub).toContain("return `/jogadores/${row.jogador_id}`")
    expect(rankHub).toContain("return `/equipes/${row.equipe_id}`")
    expect(rankHub).toContain("return `/campeonatos/${row.campeonato_id}`")
    expect(rankHub).toContain('Abrir perfil completo')
  })

  test('desktop e mobile recebem estilos próprios sem dependência nova ou SQL', () => {
    expect(publicStyles).toContain('.champ-public-stats-summary')
    expect(publicStyles).toContain('grid-template-columns:1fr')
    expect(producerStyles).toContain('.champ-stats-result-status')
    expect(rankStyles).toContain('.directory-rank-context')
    expect(rankStyles).toContain('.directory-rank-search')
    expect(rankStyles).toContain('.directory-rank-profile-link')
    expect(rankHub).not.toContain('supabase.')
  })
})
