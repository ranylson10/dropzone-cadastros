import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { createNotificacao } from '@backend/equipes/manager-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function assertNotMember(equipeId: string, playerAuthId: string) {
  const { data, error } = await supabaseAdmin.from('equipe_jogadores').select('id,status').eq('equipe_id', equipeId).eq('jogador_auth_user_id', playerAuthId).maybeSingle()
  if (error) throw error
  if (data?.status === 'ativo') throw new Error('Este jogador já faz parte da equipe.')
}

async function assertNoPending(destinatarioAuthUserId: string, tipo: string, equipeId: string, jogadorId: string) {
  const { data, error } = await supabaseAdmin
    .from('notificacoes')
    .select('id')
    .eq('destinatario_auth_user_id', destinatarioAuthUserId)
    .eq('tipo', tipo)
    .eq('status', 'nao_lida')
    .contains('payload', { equipe_id: equipeId, jogador_id: jogadorId })
    .limit(1)
  if (error) throw error
  if (data?.length) throw new Error('Já existe uma solicitação pendente entre este jogador e esta equipe.')
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const equipeId = String(body.equipe_id || '')

    if (action === 'invite_player') {
      await requireEquipeAccess(user.id, accounts, equipeId, 'token')
      const jogadorId = String(body.jogador_id || '')
      const [{ data: equipe, error: teamError }, { data: jogador, error: playerError }] = await Promise.all([
        supabaseAdmin.from('equipes').select('id,nome,auth_user_id').eq('id', equipeId).maybeSingle(),
        supabaseAdmin.from('jogadores').select('id,nick,username,auth_user_id,status').eq('id', jogadorId).eq('status', 'ativo').maybeSingle(),
      ])
      if (teamError) throw teamError
      if (playerError) throw playerError
      if (!equipe || !jogador?.auth_user_id) throw new Error('Equipe ou jogador não encontrado.')
      await assertNotMember(equipe.id, jogador.auth_user_id)
      await assertNoPending(jogador.auth_user_id, 'convite_jogador_equipe_direto', equipe.id, jogador.id)
      const notification = await createNotificacao({
        destinatarioAuthUserId: jogador.auth_user_id,
        destinatarioProfileType: 'jogador',
        destinatarioProfileId: jogador.id,
        remetenteAuthUserId: user.id,
        remetenteProfileType: 'equipe',
        remetenteProfileId: equipe.id,
        tipo: 'convite_jogador_equipe_direto',
        titulo: `${equipe.nome} convidou você`,
        corpo: `Aceite para entrar no elenco da equipe ${equipe.nome}.`,
        payload: { equipe_id: equipe.id, jogador_id: jogador.id },
        referenciaTipo: 'equipe',
        referenciaId: equipe.id,
      })
      return NextResponse.json({ ok: true, notification })
    }

    if (action === 'request_join') {
      const jogador = accounts.find((item) => item.profile_type === 'jogador')
      if (!jogador) throw new Error('Acesse com um perfil de jogador.')
      const { data: equipe, error } = await supabaseAdmin.from('equipes').select('id,nome,auth_user_id,status').eq('id', equipeId).eq('status', 'ativo').maybeSingle()
      if (error) throw error
      if (!equipe?.auth_user_id) throw new Error('Equipe não encontrada.')
      await assertNotMember(equipe.id, user.id)
      await assertNoPending(equipe.auth_user_id, 'pedido_jogador_equipe', equipe.id, jogador.id)
      const notification = await createNotificacao({
        destinatarioAuthUserId: equipe.auth_user_id,
        destinatarioProfileType: 'equipe',
        destinatarioProfileId: equipe.id,
        remetenteAuthUserId: user.id,
        remetenteProfileType: 'jogador',
        remetenteProfileId: jogador.id,
        tipo: 'pedido_jogador_equipe',
        titulo: `${jogador.name || jogador.username} quer entrar na equipe`,
        corpo: `Aceite para adicionar o jogador ao elenco de ${equipe.nome}.`,
        payload: { equipe_id: equipe.id, jogador_id: jogador.id },
        referenciaTipo: 'jogador',
        referenciaId: jogador.id,
      })
      return NextResponse.json({ ok: true, notification })
    }

    throw new Error('Ação inválida.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível enviar a solicitação.' }, { status: 400 })
  }
}
