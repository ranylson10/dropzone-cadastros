import { NextRequest } from 'next/server'
import type { LiliClientContext, LiliIntent } from '@backend/lili/types'
import { liliInternalRequest, liliInternalFetchOptions } from '../internal-api'

export function forwardedAuthHeaders(req: NextRequest) {
  const headers = new Headers()
  const authorization = req.headers.get('authorization')
  const cookie = req.headers.get('cookie')
  if (authorization) headers.set('authorization', authorization)
  if (cookie) headers.set('cookie', cookie)
  headers.set('content-type', 'application/json')
  return headers
}

export async function loadGroupInviteInChat(req: NextRequest, token: string, equipeId?: string | null) {
  const url = liliInternalRequest(req, `/api/convites/grupo/${encodeURIComponent(token)}`)
  if (equipeId) url.searchParams.set('equipe_id', equipeId)
  const response = await fetch(url, { method: 'GET', headers: forwardedAuthHeaders(req), cache: 'no-store', ...liliInternalFetchOptions() })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar este convite.')
  return data
}

export async function loadLineupInviteInChat(req: NextRequest, token: string) {
  const response = await fetch(
    liliInternalRequest(req, `/api/escalacoes/${encodeURIComponent(token)}`),
    { method: 'GET', headers: forwardedAuthHeaders(req), cache: 'no-store', ...liliInternalFetchOptions() },
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar este convite de escalação.')
  return data
}

export async function confirmGroupInviteInChat(req: NextRequest, context: LiliClientContext) {
  if (!context.inviteToken) throw new Error('Convite não localizado nesta conversa.')
  const url = liliInternalRequest(req, `/api/convites/grupo/${encodeURIComponent(context.inviteToken)}`)
  const headers = forwardedAuthHeaders(req)
  const requestId = req.headers.get('Idempotency-Key')
  if (requestId) headers.set('Idempotency-Key', requestId)
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      equipe_id: context.selectedTeamId,
      line_id: context.selectedLineId || null,
      nome_line: context.selectedLineId ? null : context.selectedLineName || null,
      slot_id: context.selectedSlotId,
    }),
    cache: 'no-store',
    ...liliInternalFetchOptions(),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'Não foi possível concluir a inscrição.')
  if (data?.ok !== true) throw new Error('Não foi possível confirmar o resultado. Repita com os mesmos dados.')
  return data
}

export function groupInviteSummaryCard(invite: any, token: string) {
  const expiresAt = invite?.link?.expira_em
  const expiration = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Sem data definida'
  const remaining = Number(invite?.resumo_link?.restantes ?? 0)
  const freeSlots = Number(invite?.resumo_grupo?.livres ?? 0)
  return {
    id: `group-invite-${token}`,
    kind: 'championship' as const,
    title: String(invite?.campeonato?.nome || 'Convite de campeonato'),
    subtitle: String(invite?.grupo?.nome || 'Grupo definido pelo convite'),
    imageUrl: invite?.campeonato?.logo_url || null,
    badges: [
      invite?.inscricao_aberta ? 'Convite ativo' : 'Inscrição indisponível',
      `${freeSlots} ${freeSlots === 1 ? 'slot livre' : 'slots livres'}`,
    ],
    details: [
      { label: 'Grupo', value: String(invite?.grupo?.nome || 'Definido pelo convite') },
      { label: 'Validade', value: expiration },
      { label: 'Vagas restantes neste convite', value: String(remaining) },
      { label: 'Status', value: invite?.status_mensagem || (invite?.inscricao_aberta ? 'Disponível para inscrição' : 'Indisponível') },
    ],
    actions: [] as Array<{ id: string; label: string; message?: string; intent?: LiliIntent; variant?: 'primary' | 'secondary'; context?: LiliClientContext }>,
  }
}

export function groupTeamCards(items: any[], context: LiliClientContext) {
  return items.map((item) => ({
    id: String(item.id),
    kind: 'team' as const,
    title: String(item.nome || 'Equipe'),
    subtitle: item.tag ? String(item.tag) : null,
    imageUrl: item.logo_url || null,
    badges: item.inscrita_no_grupo ? ['Já inscrita neste grupo'] : [],
    actions: item.inscrita_no_grupo ? [] : [{
      id: `group-team-${item.id}`,
      label: 'Usar esta equipe',
      message: `Usar a equipe ${item.nome}`,
      intent: 'selecionar_equipe_convite_grupo' as LiliIntent,
      variant: 'primary' as const,
      context: { ...context, selectedTeamId: String(item.id), currentStep: 'team' },
    }],
  }))
}

export function groupLineCards(availableItems: any[], registeredItems: any[], context: LiliClientContext) {
  const available = availableItems.map((item) => ({
    id: String(item.id),
    kind: 'line' as const,
    title: String(item.nome || 'Line'),
    subtitle: item.tag ? String(item.tag) : null,
    imageUrl: item.logo_url || null,
    badges: ['Disponível para inscrição'],
    actions: [{
      id: `group-line-${item.id}`,
      label: 'Usar esta line',
      message: `Usar a line ${item.nome}`,
      intent: 'selecionar_line_convite_grupo' as LiliIntent,
      variant: 'primary' as const,
      context: { ...context, selectedLineId: String(item.id), selectedLineName: String(item.nome || ''), currentStep: 'line' },
    }],
  }))

  const registered = registeredItems.map((item) => ({
    id: `registered-${item.id}`,
    kind: 'line' as const,
    title: String(item.nome || item.nome_exibicao || 'Line'),
    subtitle: item.tag ? String(item.tag) : null,
    imageUrl: item.logo_url || null,
    badges: ['Já inscrita neste campeonato'],
    details: [
      ...(item.grupo_id ? [{ label: 'Grupo', value: String(item.grupo_nome || 'Já definido') }] : []),
      ...(item.slot_numero ? [{ label: 'Slot', value: String(item.slot_numero) }] : []),
    ],
    actions: [],
  }))

  return [...available, ...registered]
}

export function groupSlotCards(items: any[], context: LiliClientContext) {
  return items
    .filter((item) => item.slot_id)
    .map((item) => {
      const label = item.slot_letra || item.slot_numero || item.nome || 'Slot'
      const occupied = Boolean(item.ocupada)
      const occupant = [item.equipe_nome, item.line_nome].filter(Boolean).join(' • ')
      return {
        id: String(item.slot_id),
        kind: 'slot' as const,
        title: `Slot ${label}`,
        subtitle: occupied ? (occupant || 'Ocupado') : 'Disponível',
        imageUrl: item.logo_url || null,
        badges: [occupied ? 'Ocupado' : 'Livre'],
        details: occupied && occupant ? [{ label: 'Inscrição atual', value: occupant }] : [],
        actions: occupied ? [] : [{
          id: `group-slot-${item.slot_id}`,
          label: 'Escolher',
          message: `Escolher o slot ${label}`,
          intent: 'selecionar_slot_convite_grupo' as LiliIntent,
          variant: 'primary' as const,
          context: { ...context, selectedSlotId: String(item.slot_id), selectedSlotLabel: String(label), currentStep: 'slot' },
        }],
      }
    })
}
