import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { resolveLiliIntent } from '@/features/lili/intent-router'
import { buildRegistrationSummary, championshipCards, listOpenChampionships, listUserTeams, teamCards } from '@/features/lili/tools'
import type { LiliChatResponse, LiliClientContext, LiliIntent } from '@/features/lili/types'

async function optionalUser(req: NextRequest) {
  try { return await getBearerUser(req) } catch { return null }
}

const menuActions = [
  { id: 'open-championships', label: 'Campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos' as LiliIntent, variant: 'primary' as const },
  { id: 'register', label: 'Fazer inscrição', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao' as LiliIntent, variant: 'primary' as const },
  { id: 'my-teams', label: 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes' as LiliIntent, variant: 'secondary' as const },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = String(body?.message || '').trim().slice(0, 1000)
    const forcedIntent = String(body?.intent || '').trim() as LiliIntent
    const context: LiliClientContext = body?.context && typeof body.context === 'object' ? body.context : {}
    if (!message && !forcedIntent) return NextResponse.json({ error: 'Mensagem ausente.' }, { status: 400 })

    const user = await optionalUser(req)
    const match = forcedIntent
      ? { intent: forcedIntent, confidence: 1, source: 'system' as const, searchTerm: undefined }
      : await resolveLiliIntent(message)

    let response: LiliChatResponse

    if (context.currentFlow === 'registration' && context.selectedChampionshipId && context.selectedTeamId) {
      if (!user) {
        response = { reply: 'Para confirmar os dados dessa equipe, preciso que você entre na sua conta.', intent: 'iniciar_inscricao', requiresAuth: true, context }
      } else {
        const summary = await buildRegistrationSummary(context.selectedChampionshipId, context.selectedTeamId)
        response = summary.existing
          ? {
              reply: `A equipe ${summary.team.nome} já está inscrita em ${summary.championship.nome}${summary.existing.slot_numero ? ` no slot ${summary.existing.slot_numero}` : ''}.`,
              intent: 'iniciar_inscricao',
              cards: [{ id: summary.existing.id, kind: 'summary', title: 'Inscrição encontrada', details: [{ label: 'Campeonato', value: summary.championship.nome }, { label: 'Equipe', value: summary.team.nome }, { label: 'Status', value: 'Ativa' }] }],
              actions: menuActions,
              context: {},
              source: 'system',
            }
          : {
              reply: `Encontrei ${summary.championship.nome} e a equipe ${summary.team.nome}. A seleção está pronta. Nesta primeira etapa, a conclusão segue pelo fluxo seguro de vagas do DropZone.`,
              intent: 'iniciar_inscricao',
              cards: [{ id: `${summary.championship.id}-${summary.team.id}`, kind: 'summary', title: 'Resumo da inscrição', details: [{ label: 'Campeonato', value: summary.championship.nome }, { label: 'Equipe', value: summary.team.nome }] }],
              actions: [
                { id: 'continue-registration', label: 'Continuar inscrição', href: '/vagas', variant: 'primary' },
                { id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
              ],
              context,
              source: 'system',
            }
      }
      return NextResponse.json(response)
    }

    switch (match.intent) {
      case 'menu':
        response = { reply: user ? 'Como posso ajudar agora?' : 'Olá! Sou a Lili, assistente do DropZone. Posso mostrar informações públicas agora e pedir seu login apenas quando os dados forem privados.', intent: 'menu', actions: menuActions, context: {}, source: match.source }
        break
      case 'listar_campeonatos_abertos': {
        const items = await listOpenChampionships()
        response = { reply: items.length ? `Encontrei ${items.length} campeonato${items.length === 1 ? '' : 's'} com vagas abertas.` : 'Não encontrei campeonatos com vagas abertas neste momento.', intent: match.intent, cards: championshipCards(items), actions: [{ id: 'register', label: 'Fazer inscrição', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao', variant: 'primary' }, { id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }], source: match.source }
        break
      }
      case 'buscar_campeonato': {
        const term = match.searchTerm || message
        let items = await listOpenChampionships(term)
        if (!items.length && term) {
          const words = term.split(/\s+/).filter((word) => word.length >= 3)
          for (const word of words) {
            items = await listOpenChampionships(word)
            if (items.length) break
          }
        }
        response = { reply: items.length ? `Encontrei estes campeonatos parecidos com “${term}”.` : `Não encontrei campeonato com o nome “${term}”. Posso mostrar os campeonatos com vagas abertas.`, intent: match.intent, cards: championshipCards(items), actions: items.length ? [{ id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }] : [{ id: 'open', label: 'Ver campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary' }], source: match.source }
        break
      }
      case 'listar_minhas_equipes': {
        if (!user) {
          response = { reply: 'Para mostrar suas equipes, preciso confirmar sua identidade.', intent: match.intent, requiresAuth: true, source: match.source }
          break
        }
        const teams = await listUserTeams(user)
        response = { reply: teams.length ? `Encontrei ${teams.length} equipe${teams.length === 1 ? '' : 's'} que você pode acessar.` : 'Sua conta ainda não possui equipe vinculada.', intent: match.intent, cards: teamCards(teams), actions: menuActions, source: match.source }
        break
      }
      case 'iniciar_inscricao': {
        if (!context.selectedChampionshipId) {
          const items = await listOpenChampionships()
          response = { reply: items.length ? 'Primeiro, escolha o campeonato em que deseja inscrever uma equipe.' : 'Não há campeonatos com vagas abertas agora.', intent: match.intent, cards: championshipCards(items, true), actions: [{ id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }], context: { currentFlow: 'registration' }, source: match.source }
          break
        }
        if (!user) {
          response = { reply: 'Campeonato escolhido. Agora preciso que você entre na conta para localizar as equipes que pode inscrever.', intent: match.intent, requiresAuth: true, context: { ...context, currentFlow: 'registration' }, source: match.source }
          break
        }
        const teams = await listUserTeams(user)
        response = { reply: teams.length ? 'Qual equipe você quer usar nesta inscrição?' : 'Não encontrei nenhuma equipe vinculada à sua conta.', intent: match.intent, cards: teamCards(teams, context.selectedChampionshipId), context: { ...context, currentFlow: 'registration' }, source: match.source }
        break
      }
      default:
        response = { reply: 'Ainda não reconheci esse pedido. Escolha uma opção abaixo ou escreva, por exemplo, “quero ver campeonatos com vagas”.', intent: 'desconhecido', actions: menuActions, source: match.source }
    }

    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'A Lili não conseguiu concluir esta consulta.' }, { status: 400 })
  }
}
