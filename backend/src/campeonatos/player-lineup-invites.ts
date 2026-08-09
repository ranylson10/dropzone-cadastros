import { assertLineupWindowOpen, assertPlayerNotInAnotherTeam } from './lineup-window'
import { supabaseAdmin } from '../shared/supabase-admin'

export async function loadActiveLineupLink(token: string) {
  const clean = String(token || '').trim()
  if (!clean) throw new Error('Token de escalação não informado.')
  const { data, error } = await supabaseAdmin
    .from('campeonato_links_inscricao')
    .select('*')
    .eq('token', clean)
    .eq('tipo', 'escalacao_line')
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Link de escalação inválido ou inativo.')
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Este link expirou.')
  return data
}

export async function joinLineupByToken(params: {
  token: string
  accounts: any[]
  body?: Record<string, unknown> | null
}) {
  const link = await loadActiveLineupLink(params.token)
  const profile = params.accounts.find((item) => item.profile_type === 'jogador')
  const account = profile?.data || null
  if (!account) throw new Error('Seu login ainda não possui um perfil de jogador.')

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id')
    .eq('campeonato_equipe_id', link.campeonato_equipe_id)
    .eq('jogador_id', account.id)
    .eq('status', 'ativo')
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return { already_registered: true, id: existing.id, jogador: account, link }

  const { count: activePlayers, error: countError } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_equipe_id', link.campeonato_equipe_id)
    .eq('status', 'ativo')
  if (countError) throw countError
  if (Number(activePlayers || 0) >= Number(link.limite_jogadores || 0)) {
    throw new Error('Esta escalação já atingiu o limite de jogadores.')
  }

  const { data: participation, error: participationError } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,equipe_id,line_id,grupo_id')
    .eq('id', link.campeonato_equipe_id)
    .single()
  if (participationError) throw participationError
  await assertLineupWindowOpen(participation.campeonato_id, participation.grupo_id)

  const body = params.body || {}
  const nick = String(body.nick || account.nome || account.username || '').trim()
  const idJogo = String(body.id_jogo || account.id_jogo || '').trim()
  const funcao = String(body.funcao || account.funcao || 'support')
  if (!nick || !idJogo) throw new Error('Complete nick e ID de jogo no perfil do jogador.')
  await assertPlayerNotInAnotherTeam(participation.campeonato_id, { jogadorId: account.id, idJogo }, participation.id)

  const { data: inserted, error } = await supabaseAdmin
    .from('campeonato_jogadores')
    .insert({
      campeonato_id: participation.campeonato_id,
      equipe_id: participation.equipe_id,
      jogador_id: account.id,
      nick,
      foto_url: account.avatar_url || null,
      id_jogo: idJogo,
      funcao,
      localidade: account.localidade || null,
      campeonato_equipe_id: participation.id,
      line_id: participation.line_id,
      origem: 'link',
      link_inscricao_id: link.id,
      status: 'ativo',
    })
    .select('*')
    .single()
  if (error) throw error

  return { inscricao: inserted, jogador: account, link }
}
