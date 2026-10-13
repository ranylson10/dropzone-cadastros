import { resolveExistingInvite } from '@backend/lili/tools'
import type { LiliClientContext } from '@backend/lili/types'
import { backToMainMenu } from '../helpers/navigation'
import { loadGroupInviteInChat, loadLineupInviteInChat, groupInviteSummaryCard } from '../helpers/group-invites'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleInviteResolution(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'usar_convite_token': {
      const tokenContext: LiliClientContext = {
        locale,
        currentFlow: 'invite_token',
        currentStep: 'token',
        awaitingInviteToken: true,
      }
      response = {
        reply: 'Digite somente o código do token recebido. A Lili identifica automaticamente se ele é de inscrição, grupo, escalação, convite individual de equipe ou compra de vaga.',
        intent: match.intent,
        actions: [
          { id: 'cancel-invite', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: tokenContext },
        ],
        context: tokenContext,
        source: 'system',
      }
      return response
    }

    case 'iniciar_inscricao': {
      const tokenContext: LiliClientContext = {
        locale,
        selectedChampionshipId: context.selectedChampionshipId || null,
        currentFlow: 'registration_token',
        currentStep: 'token',
        awaitingInviteToken: true,
      }
      response = {
        reply: context.selectedChampionshipId
          ? 'Para entrar neste campeonato, cole o link de convite ou digite o token recebido do organizador.'
          : 'Cole o link de convite ou digite o token recebido do organizador. Cada convite continua preso ao campeonato, grupo ou slot definido quando foi criado.',
        intent: match.intent,
        actions: [
          { id: 'no-token', label: 'Não tenho token', message: 'Não tenho token', intent: 'comprar_vaga', variant: 'primary', context: { locale, selectedChampionshipId: context.selectedChampionshipId || null, currentFlow: 'vacancy_purchase' } },
          { id: 'open-spots', label: 'Ver campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'secondary', context: { locale } },
          { id: 'cancel-token', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: tokenContext },
        ],
        context: tokenContext,
        source: 'system',
      }
      return response
    }

    case 'validar_token_inscricao': {
      const invite = await resolveExistingInvite(context.inviteToken || message)

      if (invite.kind === 'inscricao_equipes_grupo' || invite.href.startsWith('/convite/grupo/')) {
        const groupInvite = await loadGroupInviteInChat(req, invite.token)
        const inviteContext: LiliClientContext = {
          locale,
          inviteToken: invite.token,
          inviteKind: 'inscricao_equipes_grupo',
          inviteHref: invite.href,
          inviteGroupId: groupInvite?.grupo?.id || null,
          selectedChampionshipId: groupInvite?.campeonato?.id || invite.campeonatoId || null,
          currentFlow: 'group_invite',
          currentStep: 'invite_summary',
        }
        const card = groupInviteSummaryCard(groupInvite, invite.token)
        card.actions = groupInvite?.inscricao_aberta ? [{
          id: 'continue-group-invite',
          label: 'Continuar inscrição pela Lili',
          message: 'Continuar inscrição',
          intent: 'continuar_convite_grupo',
          variant: 'primary',
          context: inviteContext,
        }] : []
        response = {
          reply: groupInvite?.inscricao_aberta
            ? 'Convite validado. Você pode concluir toda a inscrição aqui na conversa com a Lili.'
            : groupInvite?.status_mensagem || 'Este convite não está disponível para uma nova inscrição.',
          intent: match.intent,
          cards: [card],
          actions: [
            { id: 'view-invite-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: inviteContext },
            { id: 'another-token', label: 'Usar outro token', message: 'Quero usar outro token', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
          ],
          context: inviteContext,
          source: 'system',
        }
        return response
      }

      if (invite.kind === 'escalacao_line' || invite.href.startsWith('/escala/')) {
        const lineup = await loadLineupInviteInChat(req, invite.token)
        const lineupContext: LiliClientContext = {
          locale,
          inviteToken: invite.token,
          inviteKind: 'escalacao_line',
          selectedChampionshipId: lineup.campeonato_id || invite.campeonatoId || null,
          currentFlow: 'lineup_invite',
          currentStep: 'summary',
          autoOpenInvite: false,
        }
        response = {
          reply: `Encontrei o convite da ${lineup.line_nome || 'line'} para ${lineup.campeonato_nome || 'o campeonato'}. Você pode concluir a entrada aqui comigo.`,
          intent: match.intent,
          cards: [{
            id: `lineup-invite-${invite.token}`,
            kind: 'summary',
            title: lineup.campeonato_nome || 'Convite de escalação',
            subtitle: lineup.line_nome || null,
            badges: [`${Number(lineup.jogadores?.length || 0)}/${Number(lineup.link?.limite_jogadores || lineup.limite_jogadores || 0)} jogadores`],
            details: [
              { label: 'Equipe', value: lineup.equipe_nome || 'Equipe' },
              { label: 'Grupo', value: lineup.grupo_nome || 'Não definido' },
              { label: 'Data', value: lineup.data_jogo ? new Date(`${lineup.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'Não definida' },
            ],
            actions: [{
              id: 'continue-lineup-invite',
              label: 'Continuar com a Lili',
              message: 'Continuar convite de escalação',
              intent: 'continuar_convite_escalacao',
              variant: 'primary',
              context: lineupContext,
            }],
          }],
          actions: [backToMainMenu(locale)],
          context: lineupContext,
          source: 'system',
        }
        return response
      }

      response = {
        reply: 'Convite localizado. A próxima etapa será trazida para dentro da conversa da Lili.',
        intent: match.intent,
        cards: [{
          id: invite.token,
          kind: 'summary',
          title: invite.title,
          details: [{ label: 'Tipo de convite', value: invite.title }],
          actions: [{ id: 'continue-existing-invite', label: 'Continuar pela Lili', href: invite.href, variant: 'primary' }],
        }],
        actions: [
          { id: 'another-token', label: 'Usar outro token', message: 'Quero usar outro token', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
          { id: 'menu-token', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale, inviteToken: invite.token, inviteKind: invite.kind, inviteHref: invite.href, autoOpenInvite: Boolean(context.autoOpenInvite) },
        source: 'system',
      }
      return response
    }
  }
  return response
}
