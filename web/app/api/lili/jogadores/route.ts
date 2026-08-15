import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function isActive(value: unknown) {
  return !['inativo', 'deletado', 'removido', 'cancelado', 'encerrado'].includes(String(value || 'ativo').toLowerCase())
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const playerAccounts = accounts.filter((item: any) => item.profile_type === 'jogador')
    const requestedId = String(req.nextUrl.searchParams.get('id') || '').trim()

    if (!requestedId) {
      return NextResponse.json({
        items: playerAccounts.map((item: any) => ({
          id: item.id,
          nick: item.data?.nick || item.name || item.username || 'Jogador',
          username: item.username || null,
          avatar_url: item.data?.avatar_url || item.data?.foto_url || null,
          id_jogo: item.data?.id_jogo || null,
          funcao: item.data?.funcao || null,
          localidade: item.data?.localidade || null,
          status: item.status || 'ativo',
        })),
      })
    }

    const account: any = playerAccounts.find((item: any) => String(item.id) === requestedId)
    if (!account) throw new Error('Você não tem acesso a este perfil de jogador.')
    const player = account.data || {}

    const { data: rosterRows, error: rosterError } = await supabaseAdmin
      .from('equipe_jogadores')
      .select('*')
      .eq('jogador_auth_user_id', user.id)
      .order('created_at', { ascending: false })
    if (rosterError) throw rosterError

    const activeRoster = (rosterRows || []).filter((row: any) => isActive(row.status))
    const teamIds = [...new Set((rosterRows || []).map((row: any) => row.equipe_id).filter(Boolean))]
    const rosterIds = activeRoster.map((row: any) => row.id)

    const [{ data: teams, error: teamsError }, { data: lineMemberships, error: lineMembershipError }] = await Promise.all([
      teamIds.length
        ? supabaseAdmin.from('equipes').select('*').in('id', teamIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      rosterIds.length
        ? supabaseAdmin.from('equipe_line_jogadores').select('*').in('equipe_jogador_id', rosterIds).eq('status', 'ativo')
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
    if (teamsError) throw teamsError
    if (lineMembershipError) throw lineMembershipError

    const lineIds = [...new Set((lineMemberships || []).map((row: any) => row.line_id).filter(Boolean))]
    const [{ data: lines, error: linesError }, { data: formations, error: formationsError }] = await Promise.all([
      lineIds.length
        ? supabaseAdmin.from('equipe_lines').select('*').in('id', lineIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      rosterIds.length
        ? supabaseAdmin.from('campeonato_jogadores').select('*').in('equipe_jogador_id', rosterIds).eq('status', 'ativo')
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
    if (linesError) throw linesError
    if (formationsError) throw formationsError

    const participationIds = [...new Set((formations || []).map((row: any) => row.campeonato_equipe_id).filter(Boolean))]
    const championshipIds = [...new Set((formations || []).map((row: any) => row.campeonato_id).filter(Boolean))]
    const [{ data: participations, error: participationError }, { data: championships, error: championshipError }] = await Promise.all([
      participationIds.length
        ? supabaseAdmin.from('campeonato_equipes').select('*').in('id', participationIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      championshipIds.length
        ? supabaseAdmin.from('campeonatos').select('*').in('id', championshipIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
    if (participationError) throw participationError
    if (championshipError) throw championshipError

    const groupIds = [...new Set((participations || []).map((row: any) => row.grupo_id).filter(Boolean))]
    const { data: groups, error: groupsError } = groupIds.length
      ? await supabaseAdmin.from('campeonato_grupos').select('*').in('id', groupIds)
      : { data: [] as any[], error: null }
    if (groupsError) throw groupsError

    const teamMap = new Map((teams || []).map((row: any) => [row.id, row]))
    const rosterMap = new Map(activeRoster.map((row: any) => [row.id, row]))
    const lineMap = new Map((lines || []).map((row: any) => [row.id, row]))
    const participationMap = new Map((participations || []).map((row: any) => [row.id, row]))
    const championshipMap = new Map((championships || []).map((row: any) => [row.id, row]))
    const groupMap = new Map((groups || []).map((row: any) => [row.id, row]))

    const memberships = activeRoster.map((row: any) => ({ ...row, equipe: teamMap.get(row.equipe_id) || null }))
    const teamHistory = (rosterRows || []).map((row: any) => ({ ...row, equipe: teamMap.get(row.equipe_id) || null }))
    const playerLines = (lineMemberships || []).map((membership: any) => ({
      ...membership,
      line: lineMap.get(membership.line_id) || null,
      elenco: rosterMap.get(membership.equipe_jogador_id) || null,
      equipe: teamMap.get(membership.equipe_id) || null,
    }))
    const playerFormations = (formations || []).map((formation: any) => {
      const participation: any = participationMap.get(formation.campeonato_equipe_id) || null
      return {
        ...formation,
        participacao: participation,
        campeonato: championshipMap.get(formation.campeonato_id) || null,
        grupo: participation?.grupo_id ? groupMap.get(participation.grupo_id) || null : null,
        line: formation.line_id ? lineMap.get(formation.line_id) || null : null,
        equipe: formation.equipe_id ? teamMap.get(formation.equipe_id) || null : null,
      }
    })

    const { data: statRows, error: statsError } = await supabaseAdmin
      .from('campeonato_estatisticas_mvp_detalhe')
      .select('*')
      .eq('jogador_id', account.id)
      .limit(10000)
    if (statsError && !['42P01', '42703', 'PGRST205', 'PGRST204'].includes(statsError.code || '')) throw statsError

    const playerStatRows = statRows || []
    const statChampionshipIds = [...new Set(playerStatRows.map((row: any) => row.campeonato_id).filter(Boolean))]
    const missingChampionshipIds = statChampionshipIds.filter((id: any) => !championshipMap.has(id))
    if (missingChampionshipIds.length) {
      const { data: historicalChampionships, error: historicalChampionshipError } = await supabaseAdmin
        .from('campeonatos')
        .select('id,nome,tipo,logo_url,banner_url,status')
        .in('id', missingChampionshipIds)
      if (historicalChampionshipError) throw historicalChampionshipError
      for (const championship of historicalChampionships || []) championshipMap.set(championship.id, championship)
    }

    const statsParticipationIds = [...new Set(playerStatRows.map((row: any) => row.campeonato_equipe_id).filter(Boolean))]
    const { data: teamStatRows, error: teamStatsError } = statsParticipationIds.length
      ? await supabaseAdmin
          .from('campeonato_estatisticas_equipes_detalhe')
          .select('*')
          .in('campeonato_equipe_id', statsParticipationIds)
          .limit(10000)
      : { data: [] as any[], error: null }
    if (teamStatsError && !['42P01', '42703', 'PGRST205', 'PGRST204'].includes(teamStatsError.code || '')) throw teamStatsError

    const teamResultMap = new Map<string, any>()
    for (const row of teamStatRows || []) {
      const key = `${row.campeonato_equipe_id || ''}:${row.partida_id || row.numero_partida || ''}`
      teamResultMap.set(key, row)
    }

    const statisticsByChampionshipMap = new Map<string, any>()
    const matchHistory = playerStatRows.map((row: any) => {
      const championship: any = championshipMap.get(row.campeonato_id) || null
      const teamResult = teamResultMap.get(`${row.campeonato_equipe_id || ''}:${row.partida_id || row.numero_partida || ''}`) || null
      const current = statisticsByChampionshipMap.get(String(row.campeonato_id)) || {
        campeonato_id: row.campeonato_id,
        campeonato: championship,
        partidas: 0,
        abates: 0,
        dano: 0,
        assistencias: 0,
        revives: 0,
        booyahs: 0,
        melhor_posicao: null,
      }
      current.partidas += 1
      current.abates += Number(row.abates || 0)
      current.dano += Number(row.dano || 0)
      current.assistencias += Number(row.assistencias || 0)
      current.revives += Number(row.revives || 0)
      if (teamResult?.booyah || Number(teamResult?.posicao || 0) === 1) current.booyahs += 1
      const position = Number(teamResult?.posicao || 0)
      if (position > 0) current.melhor_posicao = current.melhor_posicao === null ? position : Math.min(current.melhor_posicao, position)
      statisticsByChampionshipMap.set(String(row.campeonato_id), current)
      return {
        resultado_id: row.resultado_id || null,
        campeonato_id: row.campeonato_id,
        campeonato: championship,
        jogo_id: row.jogo_id || null,
        partida_id: row.partida_id || null,
        numero_partida: row.numero_partida || null,
        mapa_codigo: row.mapa_codigo || null,
        mapa_nome: row.mapa_nome || null,
        mapa_imagem_url: row.mapa_imagem_url || null,
        equipe_id: row.equipe_id || null,
        line_id: row.line_id || null,
        abates: Number(row.abates || 0),
        dano: Number(row.dano || 0),
        assistencias: Number(row.assistencias || 0),
        revives: Number(row.revives || 0),
        posicao: position || null,
        booyah: Boolean(teamResult?.booyah || position === 1),
        updated_at: row.updated_at || null,
      }
    }).sort((a: any, b: any) => {
      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0
      if (bDate !== aDate) return bDate - aDate
      return Number(b.numero_partida || 0) - Number(a.numero_partida || 0)
    })

    const statisticsByChampionship = [...statisticsByChampionshipMap.values()]
      .map((row: any) => ({ ...row, kd: row.partidas ? row.abates / row.partidas : 0 }))
      .sort((a: any, b: any) => b.partidas - a.partidas || b.abates - a.abates)

    const statistics = statisticsByChampionship.reduce((total: any, row: any) => ({
      partidas: total.partidas + row.partidas,
      abates: total.abates + row.abates,
      dano: total.dano + row.dano,
      assistencias: total.assistencias + row.assistencias,
      revives: total.revives + row.revives,
      booyahs: total.booyahs + row.booyahs,
    }), { partidas: 0, abates: 0, dano: 0, assistencias: 0, revives: 0, booyahs: 0 })

    // Telemetria privada do próprio jogador. O account acima já foi validado contra
    // os perfis pertencentes ao usuário autenticado, portanto não aceitamos jogador_id arbitrário.
    const formationIds = (formations || []).map((row: any) => String(row.id || '')).filter(Boolean)
    const garenaRowsById = new Map<string, any>()

    const { data: garenaByPlayer, error: garenaByPlayerError } = await supabaseAdmin
      .from('garena_matchstats_jogadores')
      .select('id,importacao_id,player_id,campeonato_jogador_id,jogador_id,campeonato_equipe_id,nick_snapshot,posicao_equipe,abates,assistencias,dano,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,precisao_percentual,taxa_headshot_kill_percentual,precisao_headshot_percentual,revives,membros_revividos,membros_resgatados,granadas_usadas,abates_granada,dano_granada,gel_usado,gel_destruido,kits_medicos')
      .eq('jogador_id', account.id)
      .limit(10000)
    if (garenaByPlayerError && !['42P01', '42703', 'PGRST205', 'PGRST204'].includes(garenaByPlayerError.code || '')) throw garenaByPlayerError
    for (const row of garenaByPlayer || []) garenaRowsById.set(String(row.id), row)

    if (formationIds.length) {
      const { data: garenaByFormation, error: garenaByFormationError } = await supabaseAdmin
        .from('garena_matchstats_jogadores')
        .select('id,importacao_id,player_id,campeonato_jogador_id,jogador_id,campeonato_equipe_id,nick_snapshot,posicao_equipe,abates,assistencias,dano,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,precisao_percentual,taxa_headshot_kill_percentual,precisao_headshot_percentual,revives,membros_revividos,membros_resgatados,granadas_usadas,abates_granada,dano_granada,gel_usado,gel_destruido,kits_medicos')
        .in('campeonato_jogador_id', formationIds)
        .limit(10000)
      if (garenaByFormationError && !['42P01', '42703', 'PGRST205', 'PGRST204'].includes(garenaByFormationError.code || '')) throw garenaByFormationError
      for (const row of garenaByFormation || []) garenaRowsById.set(String(row.id), row)
    }

    const garenaRows = [...garenaRowsById.values()]
    const garenaImportIds = [...new Set(garenaRows.map((row: any) => row.importacao_id).filter(Boolean))]
    const garenaRowIds = garenaRows.map((row: any) => row.id).filter(Boolean)
    const [garenaImportsResult, garenaWeaponsResult, garenaSkillsResult] = await Promise.all([
      garenaImportIds.length
        ? supabaseAdmin.from('garena_matchstats_importacoes').select('id,campeonato_id,partida_id,status,concluida_em').in('id', garenaImportIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      garenaRowIds.length
        ? supabaseAdmin.from('garena_matchstats_armas').select('jogador_matchstats_id,ordem,weapon_id,arma,abates,dano,headshots,precisao_percentual,precisao_headshot_percentual').in('jogador_matchstats_id', garenaRowIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      garenaRowIds.length
        ? supabaseAdmin.from('garena_matchstats_habilidades').select('jogador_matchstats_id,tipo,ordem,skill_id,personagem,habilidade,usos,informacao,pick_times,pick_rate').in('jogador_matchstats_id', garenaRowIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
    if (garenaImportsResult.error) throw garenaImportsResult.error
    if (garenaWeaponsResult.error) throw garenaWeaponsResult.error
    if (garenaSkillsResult.error) throw garenaSkillsResult.error

    const importMap = new Map((garenaImportsResult.data || []).map((row: any) => [String(row.id), row]))
    const weaponsMap = new Map<string, any[]>()
    for (const row of garenaWeaponsResult.data || []) {
      const key = String(row.jogador_matchstats_id || '')
      weaponsMap.set(key, [...(weaponsMap.get(key) || []), row])
    }
    const skillsMap = new Map<string, any[]>()
    for (const row of garenaSkillsResult.data || []) {
      const key = String(row.jogador_matchstats_id || '')
      skillsMap.set(key, [...(skillsMap.get(key) || []), row])
    }
    const telemetryMap = new Map<string, any>()
    for (const row of garenaRows) {
      const imp: any = importMap.get(String(row.importacao_id || ''))
      const key = `${imp?.campeonato_id || ''}:${imp?.partida_id || ''}`
      if (!imp?.campeonato_id || !imp?.partida_id) continue
      telemetryMap.set(key, {
        ...row,
        armas: (weaponsMap.get(String(row.id)) || []).sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0)),
        habilidades: (skillsMap.get(String(row.id)) || []).sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0)),
      })
    }

    const enrichedMatchHistory = matchHistory.map((row: any) => ({
      ...row,
      telemetria: telemetryMap.get(`${row.campeonato_id || ''}:${row.partida_id || ''}`) || null,
    }))

    return NextResponse.json({
      player: {
        id: account.id,
        nick: player.nick || account.name || account.username || 'Jogador',
        username: account.username || null,
        avatar_url: player.avatar_url || player.foto_url || null,
        banner_url: player.banner_url || null,
        id_jogo: player.id_jogo || null,
        funcao: player.funcao || null,
        localidade: player.localidade || null,
        bio: player.bio || null,
        status: account.status || player.status || 'ativo',
      },
      overview: {
        teams: memberships,
        teamHistory,
        lines: playerLines,
        formations: playerFormations,
        activeChampionships: playerFormations.filter((row: any) => isActive(row.campeonato?.status)),
        statistics,
        statisticsByChampionship,
        matchHistory: enrichedMatchHistory,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar seus players.' }, { status: 400 })
  }
}
