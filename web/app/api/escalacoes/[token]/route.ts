import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { resolveLineupWindow } from '@backend/campeonatos/lineup-window'
import { joinLineupByToken, loadActiveLineupLink } from '@backend/campeonatos/player-lineup-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function tokenFrom(ctx: any) {
  const params = await ctx.params
  return String(params?.token || '').trim()
}

const loadLink = loadActiveLineupLink


function mapJogadorProfile(account: any) {
  if (!account) return null
  const row = account.data || account
  return {
    id: account.id || row.id,
    username: account.username || row.username || null,
    nome: account.name || row.nome || row.nome_exibido || row.username || null,
    avatar_url: row.avatar_url || row.foto_url || null,
    id_jogo: row.id_jogo || null,
    funcao: row.funcao || null,
  }
}

async function optionalPlayer(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'jogador') || null
    return {
      autenticado: true,
      // null = logado sem perfil de jogo → UI manda pro formulário de criação
      jogador: mapJogadorProfile(account),
    }
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

    const window = await resolveLineupWindow(summary.campeonato_id, summary.grupo_id)

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
      prazo_escalacao: window,
      jogadores: players || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao abrir escalação.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))
    const result = await joinLineupByToken({
      token: await tokenFrom(ctx),
      accounts,
      body,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao entrar na escalação.' }, { status: 400 })
  }
}
