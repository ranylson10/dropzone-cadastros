import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { saveTeamPlayer } from '@backend/equipes/player-roster'

function activeStatus(value: unknown) {
  return !['finalizado', 'cancelado', 'encerrado', 'inativo'].includes(String(value || '').toLowerCase())
}

async function convite(token: string) {
  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('id,equipe_id,line_id,campeonato_equipe_id,status,usado,expira_em,equipes:equipe_id(id,nome,tag,logo_url),line:line_id(id,nome,tag),participacao:campeonato_equipe_id(id,campeonato_id,line_id,grupo_id,status,campeonato:campeonato_id(id,nome,logo_url,status,jogadores_por_equipe,reservas))')
    .eq('token', token)
    .eq('tipo', 'convite_jogador_equipe')
    .maybeSingle()
  if (error) throw error
  if (!data || data.status !== 'ativo' || data.usado || (data.expira_em && new Date(data.expira_em).getTime() < Date.now())) {
    throw new Error('Convite inválido, usado ou expirado.')
  }
  return data as any
}

async function ensureLineMembership(equipeId: string, lineId: string, equipeJogadorId: string, userId: string) {
  const { data: existing, error: readError } = await supabaseAdmin
    .from('equipe_line_jogadores')
    .select('id')
    .eq('line_id', lineId)
    .eq('equipe_jogador_id', equipeJogadorId)
    .maybeSingle()
  if (readError) throw readError
  const payload = {
    equipe_id: equipeId,
    line_id: lineId,
    equipe_jogador_id: equipeJogadorId,
    status: 'ativo',
    adicionado_por: userId,
    removido_por: null,
    removido_em: null,
    updated_at: new Date().toISOString(),
  }
  const write = existing
    ? await supabaseAdmin.from('equipe_line_jogadores').update(payload).eq('id', existing.id)
    : await supabaseAdmin.from('equipe_line_jogadores').insert(payload)
  if (write.error) throw write.error
}

async function tryAddFormation(item: any, equipeJogador: any, jogador: any, userId: string) {
  const participation = item.participacao
  if (!participation || !item.campeonato_equipe_id || !item.line_id) return { added: false, reason: null }

  const championship = participation.campeonato || {}
  if (!activeStatus(championship.status) || !activeStatus(participation.status)) {
    return { added: false, reason: 'A formação do campeonato está encerrada.' }
  }

  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('campeonato_regras_escalacao')
    .select('*')
    .eq('campeonato_id', participation.campeonato_id)
  if (rulesError) throw rulesError
  const rule = (rules || []).find((row: any) => row.grupo_id && row.grupo_id === participation.grupo_id)
    || (rules || []).find((row: any) => !row.grupo_id)
    || null
  const deadline = rule?.encerra_em || rule?.substituicao_encerra_em || null
  if (deadline && new Date(deadline).getTime() <= Date.now()) {
    return { added: false, reason: 'O prazo de alteração da formação encerrou.' }
  }

  const maxPlayers = Math.max(1, Number(rule?.vagas_por_equipe || championship.jogadores_por_equipe || 4) + Number(championship.reservas || 0))
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id,equipe_jogador_id,ordem_formacao')
    .eq('campeonato_equipe_id', item.campeonato_equipe_id)
    .eq('status', 'ativo')
    .order('ordem_formacao')
  if (existingError) throw existingError
  if ((existing || []).some((row: any) => row.equipe_jogador_id === equipeJogador.id)) return { added: true, reason: null }
  if ((existing || []).length >= maxPlayers) return { added: false, reason: `A formação já atingiu o limite de ${maxPlayers} jogadores.` }

  const payload = {
    campeonato_id: participation.campeonato_id,
    equipe_id: item.equipe_id,
    jogador_id: jogador.id,
    nick: equipeJogador.nick || jogador.nome || 'Jogador',
    foto_url: equipeJogador.foto_url || jogador.avatar_url || null,
    id_jogo: equipeJogador.id_jogo || jogador.id_jogo || 'pendente',
    funcao: equipeJogador.funcao || jogador.funcao || 'support',
    localidade: equipeJogador.localidade || jogador.localidade || null,
    campeonato_equipe_id: item.campeonato_equipe_id,
    line_id: item.line_id,
    equipe_jogador_id: equipeJogador.id,
    tipo_formacao: 'reserva',
    ordem_formacao: (existing || []).length + 1,
    origem: 'convite_line_campeonato',
    adicionado_por: userId,
    status: 'ativo',
    updated_at: new Date().toISOString(),
  }
  const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogadores').insert(payload).select('id').single()
  if (error) throw error
  await supabaseAdmin.from('equipe_formacao_historico').insert({
    equipe_id: item.equipe_id,
    line_id: item.line_id,
    campeonato_id: participation.campeonato_id,
    campeonato_equipe_id: item.campeonato_equipe_id,
    equipe_jogador_id: equipeJogador.id,
    campeonato_jogador_id: inserted.id,
    acao: 'adicionado_formacao',
    detalhes: { origem: 'convite' },
    realizado_por: userId,
  })
  return { added: true, reason: null }
}

export async function GET(_: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const item = await convite((await context.params).token)
    return NextResponse.json({
      equipe: item.equipes,
      line: item.line || null,
      campeonato: item.participacao?.campeonato || null,
      destino: item.participacao ? 'formacao' : item.line ? 'line' : 'elenco',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Convite inválido.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const user = await getBearerUser(req)
    const item = await convite((await context.params).token)
    const { data: jogador, error: playerError } = await supabaseAdmin
      .from('jogadores')
      .select('id,nome,avatar_url,id_jogo,funcao,localidade')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (playerError) throw playerError
    if (!jogador) throw new Error('Crie ou acesse seu perfil de jogador para aceitar o convite.')

    const rosterPayload = {
      equipe_id: item.equipe_id,
      jogador_auth_user_id: user.id,
      nick: jogador.nome,
      foto_url: jogador.avatar_url,
      id_jogo: jogador.id_jogo,
      funcao: jogador.funcao,
      localidade: jogador.localidade,
      origem: item.line_id ? 'convite_line' : 'convite',
      status: 'ativo',
      updated_at: new Date().toISOString(),
    }
    const equipeJogador = await saveTeamPlayer(rosterPayload)

    let lineAdded = false
    if (item.line_id) {
      await ensureLineMembership(item.equipe_id, item.line_id, equipeJogador.id, user.id)
      lineAdded = true
      await supabaseAdmin.from('equipe_formacao_historico').insert({
        equipe_id: item.equipe_id,
        line_id: item.line_id,
        equipe_jogador_id: equipeJogador.id,
        acao: 'adicionado_line',
        detalhes: { origem: 'convite' },
        realizado_por: user.id,
      })
    }

    const formation = await tryAddFormation(item, equipeJogador, jogador, user.id)
    const { error: tokenError } = await supabaseAdmin.from('tokens').update({
      usado: true,
      usado_em: new Date().toISOString(),
      status: 'usado',
      jogador_id: jogador.id,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    if (tokenError) throw tokenError

    return NextResponse.json({
      success: true,
      equipe: item.equipes,
      line_added: lineAdded,
      formation_added: formation.added,
      formation_reason: formation.reason,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao aceitar convite.' }, { status: 400 })
  }
}
