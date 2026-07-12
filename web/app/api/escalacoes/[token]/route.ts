import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function tokenFrom(ctx: any) {
  const params = await ctx.params
  return String(params?.token || '').trim().toUpperCase()
}

async function loadLink(token: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_links_inscricao')
    .select('*')
    .eq('token', token)
    .eq('tipo', 'escalacao_line')
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Link de escalação inválido ou inativo.')
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Este link expirou.')
  return data
}

async function optionalPlayer(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'jogador')
    return { autenticado: true, jogador: account?.data || null }
  } catch {
    return { autenticado: false, jogador: null }
  }
}

export async function GET(req: NextRequest, ctx: any) {
  try {
    const link = await loadLink(await tokenFrom(ctx))
    const auth = await optionalPlayer(req)
    const [{ data: summary, error: summaryError }, { data: players, error: playersError }] = await Promise.all([
      supabaseAdmin.from('campeonato_escalacoes_resumo').select('*').eq('campeonato_equipe_id', link.campeonato_equipe_id).maybeSingle(),
      supabaseAdmin.from('campeonato_jogadores').select('id,jogador_id,nick,foto_url,id_jogo,funcao,slot_numero,capitao,status').eq('campeonato_equipe_id', link.campeonato_equipe_id).eq('status', 'ativo').order('slot_numero'),
    ])
    if (summaryError) throw summaryError
    if (playersError) throw playersError
    if (!summary) throw new Error('Escalação não encontrada.')

    const playerProfile = auth.jogador
    const existing = playerProfile
      ? (players || []).find((player: any) => player.jogador_id === playerProfile.id) || null
      : null

    return NextResponse.json({
      ...summary,
      autenticado: auth.autenticado,
      jogador: auth.jogador,
      ja_inscrito: Boolean(existing),
      inscricao_atual: existing,
      link: {
        token: link.token,
        titulo: link.titulo,
        descricao: link.descricao,
        limite_jogadores: link.limite_jogadores,
        expira_em: link.expira_em,
      },
      jogadores: players || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao abrir escalação.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const user = await getBearerUser(req)
    const link = await loadLink(await tokenFrom(ctx))
    const accounts = await getAccountsForUser(user)
    const profile = accounts.find((item) => item.profile_type === 'jogador')
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
    if (existing) return NextResponse.json({ already_registered: true, id: existing.id })

    const body = await req.json().catch(() => ({}))
    const { data: participation, error: participationError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,line_id')
      .eq('id', link.campeonato_equipe_id)
      .single()
    if (participationError) throw participationError

    const nick = String(body.nick || account.nome || account.username || '').trim()
    const idJogo = String(body.id_jogo || account.id_jogo || '').trim()
    const funcao = String(body.funcao || account.funcao || 'support')
    if (!nick || !idJogo) throw new Error('Complete nick e ID de jogo no perfil do jogador.')

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
    return NextResponse.json({ inscricao: inserted })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao entrar na escalação.' }, { status: 400 })
  }
}
