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
    const teamIds = [...new Set(activeRoster.map((row: any) => row.equipe_id).filter(Boolean))]
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
        lines: playerLines,
        formations: playerFormations,
        activeChampionships: playerFormations.filter((row: any) => isActive(row.campeonato?.status)),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar seus players.' }, { status: 400 })
  }
}
