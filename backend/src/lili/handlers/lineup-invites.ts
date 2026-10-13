import type { LiliClientContext } from '@backend/lili/types'
import { backToMainMenu } from '../helpers/navigation'
import { forwardedAuthHeaders, loadLineupInviteInChat } from '../helpers/group-invites'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleLineupInvites(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'continuar_convite_escalacao': {
      if (!user) {
        response = {
          reply: 'Entre com sua conta de jogador. Depois do login, eu continuo exatamente deste convite.',
          intent: match.intent,
          requiresAuth: true,
          context: { ...context, currentFlow: 'lineup_invite' },
          source: 'system',
        }
        return response
      }
      if (!context.inviteToken) throw new Error('Convite de escalação não localizado.')
      const lineup = await loadLineupInviteInChat(req, context.inviteToken)
      const resumeContext: LiliClientContext = { ...context, currentFlow: 'lineup_invite', currentStep: 'confirm' }
      if (!lineup.jogador) {
        response = {
          reply: 'Seu login ainda não possui um perfil de jogador. Cadastre os dados do jogador e eu volto automaticamente para confirmar esta escalação.',
          intent: match.intent,
          actions: [{
            id: 'create-player-for-lineup',
            label: 'Cadastrar jogador',
            message: 'Continuar convite de escalação',
            intent: 'continuar_convite_escalacao',
            href: `/?cadastro=jogador&vincular=1&returnTo=${encodeURIComponent('/lili')}`,
            variant: 'primary',
            context: resumeContext,
          }, backToMainMenu(locale)],
          context: resumeContext,
          source: 'system',
        }
        return response
      }
      if (lineup.ja_inscrito) {
        response = {
          reply: `Você já está confirmado nesta escalação como ${lineup.inscricao_atual?.nick || lineup.jogador.nome || lineup.jogador.username}.`,
          intent: match.intent,
          actions: [
            { id: 'lineup-invite-agenda', label: 'Ver minha agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'primary', context: { locale } },
            backToMainMenu(locale),
          ],
          context: resumeContext,
          source: 'system',
        }
        return response
      }
      const limit = Number(lineup.link?.limite_jogadores || lineup.limite_jogadores || 0)
      const occupied = Number(lineup.jogadores?.length || 0)
      response = {
        reply: occupied >= limit
          ? 'Esta escalação já está completa. Posso te mostrar sua agenda ou voltar ao início.'
          : `Tudo certo, ${lineup.jogador.nome || lineup.jogador.username}. Você vai entrar na ${lineup.line_nome || 'line'} para disputar ${lineup.campeonato_nome || 'este campeonato'}. Quer confirmar?`,
        intent: match.intent,
        cards: [{
          id: `confirm-lineup-${context.inviteToken}`,
          kind: 'summary',
          title: lineup.campeonato_nome || 'Escalação',
          subtitle: lineup.line_nome || null,
          badges: [`${occupied}/${limit} jogadores`],
          details: [
            { label: 'Equipe', value: lineup.equipe_nome || 'Equipe' },
            { label: 'Fase / grupo', value: [lineup.fase_nome, lineup.grupo_nome].filter(Boolean).join(' · ') || 'Não definido' },
            { label: 'Jogador', value: lineup.jogador.nome || lineup.jogador.username || 'Jogador' },
          ],
          actions: occupied < limit ? [{
            id: 'confirm-lineup-entry',
            label: 'Confirmar minha entrada',
            message: 'Confirmar minha entrada na escalação',
            intent: 'confirmar_convite_escalacao',
            variant: 'primary',
            context: resumeContext,
          }] : undefined,
        }],
        actions: [
          { id: 'lineup-confirm-agenda', label: 'Ver minha agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ],
        context: resumeContext,
        source: 'system',
      }
      return response
    }

    case 'confirmar_convite_escalacao': {
      if (!user || !context.inviteToken) throw new Error('Faça login para confirmar este convite.')
      const joinResponse = await fetch(
        new URL(`/api/escalacoes/${encodeURIComponent(context.inviteToken)}`, req.nextUrl.origin),
        { method: 'POST', headers: forwardedAuthHeaders(req), body: '{}' },
      )
      const joined = await joinResponse.json().catch(() => ({}))
      if (!joinResponse.ok) throw new Error(joined?.error || 'Não foi possível confirmar sua entrada.')
      response = {
        reply: joined.already_registered
          ? 'Você já estava confirmado nesta escalação.'
          : 'Pronto! Sua entrada na escalação foi confirmada. Agora esse campeonato também aparecerá nas suas inscrições e na sua agenda.',
        intent: match.intent,
        actions: [
          { id: 'joined-registrations', label: 'Ver campeonatos inscritos', message: 'Mostrar campeonatos inscritos', intent: 'listar_minhas_inscricoes', variant: 'primary', context: { locale } },
          { id: 'joined-agenda', label: 'Ver minha agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ],
        context: { locale, currentFlow: 'lineup_invite', currentStep: 'done' },
        source: 'system',
      }
      return response
    }
  }
  return response
}
