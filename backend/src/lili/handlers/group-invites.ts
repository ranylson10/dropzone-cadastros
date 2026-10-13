import type { LiliClientContext } from '@backend/lili/types'
import { loadGroupInviteInChat, groupTeamCards, groupLineCards, groupSlotCards } from '../helpers/group-invites'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleGroupInvites(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'continuar_convite_grupo': {
      if (!user) {
        response = {
          reply: 'Entre na sua conta para continuar a inscrição deste convite. Depois do login, a Lili retoma daqui.',
          intent: match.intent,
          requiresAuth: true,
          context,
          source: 'system',
        }
        return response
      }
      if (!context.inviteToken) throw new Error('Convite não localizado nesta conversa.')
      const groupInvite = await loadGroupInviteInChat(req, context.inviteToken, context.selectedTeamId)
      if (!groupInvite?.inscricao_aberta) throw new Error(groupInvite?.status_mensagem || 'Este convite não aceita novas inscrições.')

      const baseContext: LiliClientContext = {
        ...context,
        inviteKind: 'inscricao_equipes_grupo',
        inviteGroupId: groupInvite?.grupo?.id || context.inviteGroupId || null,
        selectedChampionshipId: groupInvite?.campeonato?.id || context.selectedChampionshipId || null,
        currentFlow: 'group_invite',
      }

      if (!context.selectedTeamId && (!Array.isArray(groupInvite?.equipes_disponiveis) || groupInvite.equipes_disponiveis.length === 0)) {
        const resumeContext: LiliClientContext = { ...baseContext, currentStep: 'team_profile' }
        response = {
          reply: 'Sua conta ainda não possui um perfil de equipe. Cadastre os dados da equipe e, ao concluir, a Lili voltará automaticamente para este mesmo campeonato para você escolher a line e o slot.',
          intent: match.intent,
          actions: [
            {
              id: 'create-team-for-group-invite',
              label: 'Cadastrar equipe',
              message: 'Continuar inscrição após cadastrar equipe',
              intent: 'continuar_convite_grupo',
              href: `/?cadastro=equipe&vincular=1&returnTo=${encodeURIComponent('/lili')}`,
              variant: 'primary',
              context: resumeContext,
            },
            { id: 'cancel-group-invite', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: resumeContext },
          ],
          context: resumeContext,
          source: 'system',
        }
        return response
      }

      if (!context.selectedTeamId && Array.isArray(groupInvite?.equipes_disponiveis) && groupInvite.equipes_disponiveis.length > 1) {
        response = {
          reply: 'Escolha qual equipe você administra e deseja inscrever neste campeonato.',
          intent: match.intent,
          cards: groupTeamCards(groupInvite.equipes_disponiveis, { ...baseContext, currentStep: 'team' }),
          actions: [{ id: 'cancel-group-invite', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: baseContext }],
          context: { ...baseContext, currentStep: 'team' },
          source: 'system',
        }
        return response
      }

      const selectedTeamId = context.selectedTeamId || groupInvite?.equipe?.id || groupInvite?.equipes_disponiveis?.[0]?.id || null
      const selectedContext = { ...baseContext, selectedTeamId, currentStep: 'line' }
      const availableLines = Array.isArray(groupInvite?.lines_disponiveis) ? groupInvite.lines_disponiveis : []
      const registeredLines = Array.isArray(groupInvite?.lines_inscritas) ? groupInvite.lines_inscritas : []
      const cards = groupLineCards(availableLines, registeredLines, selectedContext)
      const availabilityText = availableLines.length
        ? `Você tem ${availableLines.length} ${availableLines.length === 1 ? 'line disponível' : 'lines disponíveis'} para esta vaga.`
        : 'Todas as lines existentes desta equipe já estão inscritas neste campeonato.'
      const registeredText = registeredLines.length
        ? ` ${registeredLines.length} ${registeredLines.length === 1 ? 'line já está inscrita' : 'lines já estão inscritas'} e aparece apenas para consulta.`
        : ''
      response = {
        reply: `Equipe confirmada. ${availabilityText}${registeredText}`,
        intent: match.intent,
        cards: cards.length ? cards : undefined,
        actions: [
          { id: 'create-group-line', label: 'Criar nova line', message: 'Criar uma nova line', intent: 'criar_line_convite_grupo', variant: availableLines.length ? 'secondary' : 'primary', context: selectedContext },
          { id: 'view-group-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: selectedContext },
          { id: 'cancel-group', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: selectedContext },
        ],
        context: selectedContext,
        source: 'system',
      }
      return response
    }

    case 'selecionar_equipe_convite_grupo': {
      response = {
        reply: 'Equipe selecionada. Vou carregar as lines disponíveis.',
        intent: 'continuar_convite_grupo',
        actions: [{
          id: 'load-group-lines',
          label: 'Continuar',
          message: 'Continuar inscrição',
          intent: 'continuar_convite_grupo',
          variant: 'primary',
          context,
        }],
        context,
        source: 'system',
      }
      return response
    }

    case 'criar_line_convite_grupo': {
      const nextContext = { ...context, selectedLineId: null, selectedLineName: null, awaitingGroupLineName: true, currentFlow: 'group_invite', currentStep: 'line_name' }
      response = {
        reply: 'Digite o nome da nova line. Ela será criada somente quando você confirmar a inscrição no final.',
        intent: match.intent,
        actions: [
          { id: 'back-group-lines', label: 'Voltar às lines', message: 'Voltar às lines', intent: 'continuar_convite_grupo', variant: 'secondary', context: { ...context, awaitingGroupLineName: false, currentStep: 'line' } },
          { id: 'cancel-new-line', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: nextContext },
        ],
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'selecionar_line_convite_grupo': {
      if (!context.inviteToken || !context.selectedTeamId) throw new Error('Faltam dados do convite ou da equipe.')
      const groupInvite = await loadGroupInviteInChat(req, context.inviteToken, context.selectedTeamId)
      const nextContext = { ...context, currentFlow: 'group_invite', currentStep: 'slot' }
      const allSlots = Array.isArray(groupInvite?.vagas) ? groupInvite.vagas : []
      const slots = groupSlotCards(allSlots, nextContext)
      const freeCount = allSlots.filter((item: any) => item.slot_id && !item.ocupada).length
      response = {
        reply: slots.length
          ? `Line ${context.selectedLineName || 'selecionada'}. Veja a grade completa do grupo ${groupInvite?.grupo?.nome || ''}: ${freeCount} ${freeCount === 1 ? 'slot livre' : 'slots livres'}. Os slots ocupados mostram a equipe e a line atuais.`
          : 'Este grupo ainda não possui slots configurados.',
        intent: match.intent,
        cards: slots,
        actions: [
          { id: 'view-slot-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: nextContext },
          { id: 'cancel-slot', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: nextContext },
        ],
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'selecionar_slot_convite_grupo': {
      if (!context.inviteToken || !context.selectedTeamId || !context.selectedSlotId || (!context.selectedLineId && !context.selectedLineName)) {
        throw new Error('Faltam dados para continuar esta inscrição.')
      }
      const groupInvite = await loadGroupInviteInChat(req, context.inviteToken, context.selectedTeamId)
      const nextContext = {
        ...context,
        selectedChampionshipId: String(groupInvite?.campeonato?.id || context.selectedChampionshipId || ''),
        inviteGroupId: String(groupInvite?.grupo?.id || context.inviteGroupId || ''),
        currentFlow: 'group_invite',
        currentStep: 'confirm',
      }
      response = {
        reply: 'Este token já representa uma vaga autorizada pelo administrador. Confira os dados e confirme a inscrição; não há cobrança neste fluxo.',
        intent: match.intent,
        cards: [{
          id: 'group-invite-confirm-summary', kind: 'summary',
          title: String(groupInvite?.campeonato?.nome || 'Confirmar inscrição'),
          subtitle: String(groupInvite?.grupo?.nome || ''),
          imageUrl: groupInvite?.campeonato?.logo_url || null,
          details: [
            { label: 'Equipe', value: String(groupInvite?.equipe?.nome || 'Equipe selecionada') },
            { label: 'Line', value: String(context.selectedLineName || 'Line selecionada') },
            { label: 'Grupo', value: String(groupInvite?.grupo?.nome || 'Grupo do convite') },
            { label: 'Slot', value: String(context.selectedSlotLabel || 'Selecionado') },
            { label: 'Autorização', value: 'Token liberado pelo administrador' },
          ],
        }],
        actions: [
          { id: 'confirm-group-invite', label: 'Confirmar inscrição', message: 'Confirmar inscrição agora', intent: 'confirmar_convite_grupo', variant: 'primary', context: nextContext },
          { id: 'view-confirm-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: nextContext },
          { id: 'cancel-token-entry', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: nextContext },
        ],
        context: nextContext,
        source: 'system',
      }
      return response
    }
  }
  return response
}
