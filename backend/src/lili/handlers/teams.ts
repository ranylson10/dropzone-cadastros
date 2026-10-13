import { listAgenda } from '@backend/agenda/agenda.service'
import { agendaCards, getTeamOperationsOverview, listUserRegistrations, listUserTeams, registrationCards, teamCards, teamRosterCards, teamLineManagementCards, teamStaffCards, teamAuditCards } from '@backend/lili/tools'
import type { LiliAction } from '@backend/lili/types'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleTeams(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'listar_minhas_equipes': {
      if (!user) {
        response = { reply: 'Para mostrar suas equipes, preciso confirmar sua identidade.', intent: match.intent, requiresAuth: true, source: match.source }
        return response
      }
      const teams = await listUserTeams(user)
      response = {
        reply: teams.length ? `Encontrei ${teams.length} equipe${teams.length === 1 ? '' : 's'} que você pode acessar. Escolha uma para abrir a central da equipe.` : 'Sua conta ainda não possui equipe vinculada.',
        intent: match.intent,
        cards: teamCards(teams),
        actions: [{ id: 'back-team-list', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } }],
        context: { locale, currentFlow: 'team_hub' },
        source: match.source,
      }
      return response
    }

    case 'abrir_equipe': {
      if (!user) {
        response = { reply: 'Entre na sua conta para abrir esta equipe.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.selectedTeamId) throw new Error('Equipe não informada.')
      const teams = await listUserTeams(user)
      const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const registrations = (await listUserRegistrations(user)).filter((item: any) => String(item.equipe_id) === String(team.id))
      const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 90)
      const agenda = await listAgenda({ scope: 'equipe', scopeId: String(team.id), from: today.toISOString().slice(0,10), to: end.toISOString().slice(0,10), authUserId: user.id })
      const upcoming = (agenda.items || []).filter((item: any) => item.source === 'jogo').length
      const championships = new Set(registrations.map((item: any) => String(item.campeonato_id || '')).filter(Boolean)).size
      response = {
        reply: `Central da equipe ${team.nome}.`,
        intent: match.intent,
        cards: [{ id: `team-hub-${team.id}`, kind: 'team', title: team.nome, subtitle: team.tag ? `${team.tag} • ${team.papel === 'dono' ? 'Proprietário' : 'Staff'}` : undefined, imageUrl: team.logo_url || null, badges: [team.permissoes?.pode_escalar ? 'Pode escalar' : 'Visualização'], details: [
          { label: 'Campeonatos inscritos', value: String(championships) },
          { label: 'Inscrições/lines', value: String(registrations.length) },
          { label: 'Próximos jogos', value: String(upcoming) },
          { label: 'Acesso', value: team.papel === 'dono' ? 'Proprietário' : 'Staff' },
        ] }],
        actions: [
          { id: `team-operations-${team.id}`, label: 'Gestão completa', message: `Abrir central operacional da equipe ${team.nome}`, intent: 'central_operacional_equipe', variant: 'primary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `team-agenda-${team.id}`, label: 'Agenda da equipe', message: `Ver agenda da equipe ${team.nome}`, intent: 'ver_agenda_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' } },
          { id: `team-champs-${team.id}`, label: 'Campeonatos inscritos', message: `Ver campeonatos da equipe ${team.nome}`, intent: 'ver_campeonatos_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' } },
          { id: `team-page-${team.id}`, label: 'Abrir perfil da equipe', href: `/equipes/${team.id}`, variant: 'secondary' },
          { id: 'back-my-teams', label: 'Voltar às equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes', variant: 'secondary', context: { locale } },
        ],
        context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' }, source: 'system',
      }
      return response
    }

    case 'central_operacional_equipe': {
      if (!user) {
        response = { reply: 'Entre na sua conta para abrir a gestão da equipe.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.selectedTeamId) {
        const teams = await listUserTeams(user)
        response = {
          reply: teams.length ? 'Escolha a equipe que deseja administrar.' : 'Sua conta ainda não possui equipe vinculada.',
          intent: match.intent,
          cards: teamCards(teams),
          context: { locale, currentFlow: 'team_operations' },
          source: 'system',
        }
        return response
      }
      const teams = await listUserTeams(user)
      const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const overview = await getTeamOperationsOverview(String(team.id))
      const attentionCount = overview.issues.filter((item) => item.level === 'attention').length
      response = {
        reply: attentionCount
          ? `Central operacional da ${team.nome}. Encontrei ${attentionCount} pendência${attentionCount === 1 ? '' : 's'} que merece${attentionCount === 1 ? '' : 'm'} atenção.`
          : `Central operacional da ${team.nome}. A estrutura básica da equipe está organizada.`,
        intent: match.intent,
        cards: [{
          id: `team-operations-summary-${team.id}`,
          kind: 'team',
          title: team.nome,
          subtitle: team.papel === 'dono' ? 'Gestão como proprietário' : 'Gestão como staff',
          imageUrl: team.logo_url || null,
          badges: [attentionCount ? `${attentionCount} pendência(s)` : 'Sem pendências básicas'],
          details: [
            { label: 'Jogadores no elenco', value: String(overview.players.length) },
            { label: 'Lines ativas', value: String(overview.lines.length) },
            { label: 'Managers/staff', value: String(overview.staff.length) },
            { label: 'Convites pendentes', value: String(overview.managerInvites.length + overview.playerInvites.length) },
            { label: 'Inscrições ativas', value: String(overview.activeRegistrations.length) },
          ],
        }],
        actions: [
          { id: `team-roster-${team.id}`, label: 'Elenco', message: `Ver elenco da equipe ${team.nome}`, intent: 'ver_elenco_equipe', variant: 'primary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `team-lines-${team.id}`, label: 'Lines', message: `Ver lines da equipe ${team.nome}`, intent: 'ver_lines_equipe', variant: 'primary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `team-staff-${team.id}`, label: 'Managers e staff', message: `Ver staff da equipe ${team.nome}`, intent: 'ver_staff_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `team-invites-${team.id}`, label: 'Convites', message: `Ver convites da equipe ${team.nome}`, intent: 'ver_convites_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `team-audit-${team.id}`, label: 'Auditar equipe', message: `Auditar equipe ${team.nome}`, intent: 'auditar_equipe', variant: attentionCount ? 'primary' : 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `team-manage-page-${team.id}`, label: 'Abrir painel completo', href: `/equipes/${team.id}`, variant: 'secondary' },
          { id: `back-team-hub-operations-${team.id}`, label: 'Voltar à equipe', message: `Abrir equipe ${team.nome}`, intent: 'abrir_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' } },
        ],
        context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' },
        source: 'system',
      }
      return response
    }

    case 'ver_elenco_equipe':

    case 'ver_lines_equipe':

    case 'ver_staff_equipe':

    case 'ver_convites_equipe':

    case 'auditar_equipe': {
      if (!user || !context.selectedTeamId) throw new Error('Equipe não informada.')
      const teams = await listUserTeams(user)
      const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const overview = await getTeamOperationsOverview(String(team.id))
      const backAction: LiliAction = { id: `back-team-operations-${team.id}`, label: 'Voltar à gestão', message: `Abrir central operacional da equipe ${team.nome}`, intent: 'central_operacional_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } }

      if (match.intent === 'ver_elenco_equipe') {
        response = {
          reply: overview.players.length ? `${team.nome} possui ${overview.players.length} jogador${overview.players.length === 1 ? '' : 'es'} no elenco.` : `${team.nome} ainda não possui jogadores no elenco.`,
          intent: match.intent,
          cards: teamRosterCards(overview.players, String(team.id)),
          actions: [
            { id: `invite-player-${team.id}`, label: 'Gerar convite de jogador', href: `/equipes/${team.id}`, variant: 'primary' },
            backAction,
          ],
          context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' }, source: 'system',
        }
      } else if (match.intent === 'ver_lines_equipe') {
        response = {
          reply: overview.lines.length ? `${team.nome} possui ${overview.lines.length} line${overview.lines.length === 1 ? '' : 's'} ativa${overview.lines.length === 1 ? '' : 's'}.` : `${team.nome} ainda não possui lines.`,
          intent: match.intent,
          cards: teamLineManagementCards(overview.lines, overview.activeRegistrations, String(team.id)),
          actions: [
            { id: `create-line-${team.id}`, label: 'Criar ou editar line', href: `/equipes/${team.id}`, variant: 'primary' },
            backAction,
          ],
          context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' }, source: 'system',
        }
      } else if (match.intent === 'ver_staff_equipe') {
        response = {
          reply: overview.staff.length ? `${team.nome} possui ${overview.staff.length} manager${overview.staff.length === 1 ? '' : 's'}/staff ativo${overview.staff.length === 1 ? '' : 's'}.` : `${team.nome} ainda não possui manager no staff.`,
          intent: match.intent,
          cards: teamStaffCards(overview.staff, String(team.id)),
          actions: [
            { id: `invite-manager-${team.id}`, label: 'Convidar manager', href: `/equipes/${team.id}`, variant: 'primary' },
            backAction,
          ],
          context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' }, source: 'system',
        }
      } else if (match.intent === 'ver_convites_equipe') {
        const cards: any[] = []
        for (const invite of overview.managerInvites) cards.push({
          id: `manager-invite-${invite.id}`, kind: 'summary', title: invite.manager_username ? `@${invite.manager_username}` : 'Convite de manager', subtitle: 'Aguardando resposta', badges: ['Manager', 'Pendente'], details: [
            { label: 'Validade', value: invite.expira_em ? new Date(invite.expira_em).toLocaleString('pt-BR') : 'Sem prazo informado' },
            { label: 'Permissões', value: [invite.pode_ver && 'ver', invite.pode_editar && 'editar', invite.pode_escalar && 'escalar', invite.pode_gerar_token && 'gerar token'].filter(Boolean).join(', ') || 'Básicas' },
          ],
        })
        for (const invite of overview.playerInvites) cards.push({
          id: `player-invite-${invite.id}`, kind: 'summary', title: 'Convite de jogador', subtitle: invite.token, badges: ['Elenco', 'Ativo'], details: [
            { label: 'Criado', value: invite.created_at ? new Date(invite.created_at).toLocaleString('pt-BR') : 'Sem registro' },
            { label: 'Validade', value: invite.expira_em ? new Date(invite.expira_em).toLocaleString('pt-BR') : 'Sem prazo' },
          ], actions: [{ id: `copy-player-invite-${invite.id}`, label: 'Copiar link', copyText: `${new URL(req.url).origin}/equipe/entrar/${invite.token}`, variant: 'primary' }],
        })
        response = {
          reply: cards.length ? `Encontrei ${cards.length} convite${cards.length === 1 ? '' : 's'} pendente${cards.length === 1 ? '' : 's'} da ${team.nome}.` : `A ${team.nome} não possui convites pendentes.`,
          intent: match.intent, cards,
          actions: [{ id: `manage-invites-${team.id}`, label: 'Gerenciar convites', href: `/equipes/${team.id}`, variant: 'primary' }, backAction],
          context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' }, source: 'system',
        }
      } else {
        const attentionCount = overview.issues.filter((item) => item.level === 'attention').length
        response = {
          reply: attentionCount ? `Auditoria concluída: encontrei ${attentionCount} pendência${attentionCount === 1 ? '' : 's'} importante${attentionCount === 1 ? '' : 's'} na ${team.nome}.` : `Auditoria concluída: não encontrei pendências operacionais básicas na ${team.nome}.`,
          intent: match.intent,
          cards: teamAuditCards(overview, String(team.id)),
          actions: [{ id: `open-team-fix-${team.id}`, label: 'Corrigir no painel', href: `/equipes/${team.id}`, variant: attentionCount ? 'primary' : 'secondary' }, backAction],
          context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' }, source: 'system',
        }
      }
      return response
    }

    case 'ver_agenda_equipe': {
      if (!user || !context.selectedTeamId) throw new Error('Equipe não informada.')
      const teams = await listUserTeams(user); const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 90)
      const agenda = await listAgenda({ scope: 'equipe', scopeId: String(team.id), from: today.toISOString().slice(0,10), to: end.toISOString().slice(0,10), authUserId: user.id })
      const items = (agenda.items || []).slice(0,20)
      response = { reply: items.length ? `Encontrei ${items.length} compromisso${items.length === 1 ? '' : 's'} da ${team.nome} nos próximos 90 dias.` : `Não encontrei compromissos da ${team.nome} nos próximos 90 dias.`, intent: match.intent, cards: agendaCards(items, locale), actions: [
        { id: `back-team-hub-${team.id}`, label: 'Voltar à equipe', message: `Abrir equipe ${team.nome}`, intent: 'abrir_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' } },
        { id: `open-team-agenda-${team.id}`, label: 'Abrir agenda completa', href: `/agenda?scope=equipe&scopeId=${team.id}`, variant: 'secondary' },
      ], context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' }, source: 'system' }
      return response
    }

    case 'ver_campeonatos_equipe': {
      if (!user || !context.selectedTeamId) throw new Error('Equipe não informada.')
      const teams = await listUserTeams(user); const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const registrations = (await listUserRegistrations(user)).filter((item: any) => String(item.equipe_id) === String(team.id))
      response = { reply: registrations.length ? `${team.nome} possui ${registrations.length} inscrição${registrations.length === 1 ? '' : 'ões'} em campeonato.` : `${team.nome} ainda não possui inscrições em campeonatos.`, intent: match.intent, cards: registrationCards(registrations, locale), actions: [
        { id: `back-team-hub-champs-${team.id}`, label: 'Voltar à equipe', message: `Abrir equipe ${team.nome}`, intent: 'abrir_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' } },
        { id: `new-registration-team-${team.id}`, label: 'Fazer nova inscrição', message: 'Quero fazer uma nova inscrição', intent: 'iniciar_inscricao', variant: 'primary', context: { locale, selectedTeamId: team.id, currentFlow: 'registration', currentStep: 'championship' } },
      ], context: { locale, selectedTeamId: team.id, currentFlow: 'team_hub' }, source: 'system' }
      return response
    }
  }
  return response
}
