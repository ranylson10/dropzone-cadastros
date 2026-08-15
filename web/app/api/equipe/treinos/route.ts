import { NextRequest, NextResponse } from 'next/server'
import { getAccountsByUserId, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function managedTeamIds(userId: string) {
  const accounts = await getAccountsByUserId(userId)
  const controllable = await listControllableEquipes(userId, accounts)
  return controllable.map((team) => String(team.id)).filter(Boolean)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const teamIds = await managedTeamIds(user.id)
    if (!teamIds.length) return NextResponse.json({ treinos: [] })

    const { data: participacoes, error: participacoesError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,line_id,grupo_id,status')
      .in('equipe_id', teamIds)
      .eq('status', 'ativo')
    if (participacoesError) throw participacoesError

    const campeonatoIds = [...new Set((participacoes || []).map((item: any) => String(item.campeonato_id || '')).filter(Boolean))]
    if (!campeonatoIds.length) return NextResponse.json({ treinos: [] })

    const { data: campeonatos, error: campeonatosError } = await supabaseAdmin
      .from('campeonatos')
      .select('id,nome,tipo,logo_url,status,data_inicio,data_fim')
      .in('id', campeonatoIds)
    if (campeonatosError) throw campeonatosError

    const xtreinos = (campeonatos || []).filter((item: any) => String(item.tipo || '').toLowerCase() === 'xtreino')
    const xtreinoIds = new Set(xtreinos.map((item: any) => String(item.id)))
    const xtreinoParticipacoes = (participacoes || []).filter((item: any) => xtreinoIds.has(String(item.campeonato_id)))
    const participacaoIds = xtreinoParticipacoes.map((item: any) => String(item.id)).filter(Boolean)
    if (!participacaoIds.length) return NextResponse.json({ treinos: [] })

    const [resumosResult, equipesStatsResult, jogadoresStatsResult] = await Promise.all([
      supabaseAdmin
        .from('campeonato_escalacoes_resumo')
        .select('*')
        .in('campeonato_equipe_id', participacaoIds),
      supabaseAdmin
        .from('campeonato_estatisticas_equipes_detalhe')
        .select('*')
        .in('campeonato_equipe_id', participacaoIds),
      supabaseAdmin
        .from('campeonato_estatisticas_mvp_detalhe')
        .select('*')
        .in('campeonato_equipe_id', participacaoIds),
    ])
    if (resumosResult.error) throw resumosResult.error
    if (equipesStatsResult.error) throw equipesStatsResult.error
    if (jogadoresStatsResult.error) throw jogadoresStatsResult.error

    const campeonatoById = new Map(xtreinos.map((item: any) => [String(item.id), item]))
    const resumoByParticipacao = new Map((resumosResult.data || []).map((item: any) => [String(item.campeonato_equipe_id), item]))
    const teamRowsByParticipacao = new Map<string, any[]>()
    for (const row of equipesStatsResult.data || []) {
      const key = String((row as any).campeonato_equipe_id || '')
      if (!key) continue
      teamRowsByParticipacao.set(key, [...(teamRowsByParticipacao.get(key) || []), row])
    }

    const playerRowsByParticipacao = new Map<string, any[]>()
    for (const row of jogadoresStatsResult.data || []) {
      const key = String((row as any).campeonato_equipe_id || '')
      if (!key) continue
      playerRowsByParticipacao.set(key, [...(playerRowsByParticipacao.get(key) || []), row])
    }

    const treinos = xtreinoParticipacoes.map((participacao: any) => {
      const participacaoId = String(participacao.id)
      const campeonato: any = campeonatoById.get(String(participacao.campeonato_id))
      const resumo: any = resumoByParticipacao.get(participacaoId)
      const teamRows = teamRowsByParticipacao.get(participacaoId) || []
      const positions = teamRows.map((row: any) => Number(row.posicao || 0)).filter((value: number) => value > 0)
      const playerRows = playerRowsByParticipacao.get(participacaoId) || []

      const players = new Map<string, any>()
      for (const row of playerRows) {
        const key = String(row.campeonato_jogador_id || row.jogador_id || row.jogador_temporario_id || row.nick || '')
        if (!key) continue
        const current = players.get(key) || {
          campeonato_jogador_id: key,
          nick: String(row.nick || 'Jogador'),
          id_jogo: row.id_jogo || null,
          foto_url: row.foto_url || null,
          quedas: 0,
          abates: 0,
          dano: 0,
          assistencias: 0,
          revives: 0,
        }
        current.quedas += 1
        current.abates += Number(row.abates || 0)
        current.dano += Number(row.dano || 0)
        current.assistencias += Number(row.assistencias || 0)
        current.revives += Number(row.revives || 0)
        players.set(key, current)
      }

      const jogadores = [...players.values()].sort((a: any, b: any) => b.abates - a.abates || b.dano - a.dano)

      return {
        campeonato_id: String(participacao.campeonato_id),
        campeonato_equipe_id: participacaoId,
        equipe_id: String(participacao.equipe_id),
        nome: String(campeonato?.nome || resumo?.campeonato_nome || 'Xtreino'),
        logo_url: campeonato?.logo_url || null,
        status: campeonato?.status || null,
        line_nome: resumo?.line_nome || null,
        grupo_nome: resumo?.grupo_nome || null,
        fase_nome: resumo?.fase_nome || null,
        data_inicio: campeonato?.data_inicio || null,
        data_fim: campeonato?.data_fim || null,
        quedas: teamRows.length,
        booyahs: teamRows.filter((row: any) => Boolean(row.booyah)).length,
        abates: teamRows.reduce((sum: number, row: any) => sum + Number(row.abates || 0), 0),
        pontos_total: teamRows.reduce((sum: number, row: any) => sum + Number(row.pontos_total || 0), 0),
        colocacao_media: positions.length ? positions.reduce((sum: number, value: number) => sum + value, 0) / positions.length : null,
        melhor_posicao: positions.length ? Math.min(...positions) : null,
        dano: jogadores.reduce((sum: number, row: any) => sum + Number(row.dano || 0), 0),
        assistencias: jogadores.reduce((sum: number, row: any) => sum + Number(row.assistencias || 0), 0),
        revives: jogadores.reduce((sum: number, row: any) => sum + Number(row.revives || 0), 0),
        jogadores,
      }
    })

    treinos.sort((a: any, b: any) => String(b.data_inicio || b.nome).localeCompare(String(a.data_inicio || a.nome)))
    return NextResponse.json({ treinos })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar treinos da equipe.' }, { status: 400 })
  }
}
