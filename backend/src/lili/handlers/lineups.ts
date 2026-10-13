import { getActiveAccount } from '@backend/auth/server-auth'
import { listUserTeams } from '@backend/lili/tools'
import { backToMainMenu } from '../helpers/navigation'
import { forwardedAuthHeaders } from '../helpers/group-invites'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleLineups(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'escalar_elenco': {
      if (!user) {
        response = { reply: 'Entre na sua conta para eu localizar as equipes que você pode escalar.', intent: match.intent, requiresAuth: true, context: { locale, currentFlow: 'lineup' }, source: 'system' }
        return response
      }
      const activeAccount = await getActiveAccount(req, user)
      const teams = await listUserTeams(user)
      const activeTeam = String(activeAccount.profile_type) === 'equipe'
        ? teams.find((team: any) => String(team.id) === String(activeAccount.id))
        : null
      const orderedTeams = activeTeam ? [activeTeam, ...teams.filter((team: any) => String(team.id) !== String(activeTeam.id))] : teams
      if (!orderedTeams.length) {
        response = {
          reply: String(activeAccount.profile_type) === 'jogador'
            ? 'Seu perfil ativo é de jogador e não administra uma equipe. Você pode consultar seus campeonatos ou usar um convite de escalação recebido.'
            : 'Não encontrei uma equipe com permissão de escalação neste perfil.',
          intent: match.intent,
          actions: [
            { id: 'lineup-use-token', label: 'Usar token de escalação', message: 'Tenho um token de escalação', intent: 'usar_convite_token', variant: 'primary', context: { locale } },
            { id: 'lineup-my-games', label: 'Ver minha agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
            backToMainMenu(locale),
          ],
          context: { locale, currentFlow: 'lineup' },
          source: 'system',
        }
        return response
      }
      response = {
        reply: orderedTeams.length === 1
          ? `Encontrei a equipe ${orderedTeams[0].nome}. Abra as escalações para adicionar jogadores, gerar token ou ajustar o limite.`
          : `Você pode escalar ${orderedTeams.length} equipes. Escolha a equipe que deseja administrar.`,
        intent: match.intent,
        cards: orderedTeams.map((team: any) => ({
          id: `lineup-team-${team.id}`,
          kind: 'team' as const,
          title: team.nome,
          subtitle: team.papel === 'dono' ? 'Proprietário' : 'Staff autorizado',
          imageUrl: team.logo_url || null,
          badges: [team.permissoes?.pode_escalar ? 'Pode escalar' : 'Acesso limitado'],
          actions: [
            { id: `open-lineup-${team.id}`, label: 'Ver escalações aqui', message: `Ver escalações da equipe ${team.nome}`, intent: 'abrir_escalacoes_equipe' as const, variant: 'primary' as const, context: { locale, selectedTeamId: team.id, currentFlow: 'lineup' } },
            { id: `view-roster-${team.id}`, label: 'Ver elenco', message: `Ver elenco da equipe ${team.nome}`, intent: 'ver_elenco_equipe' as const, variant: 'secondary' as const, context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          ],
        })),
        actions: [
          { id: 'lineup-use-invite', label: 'Usar token recebido', message: 'Tenho um token de escalação', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
          { id: 'lineup-agenda', label: 'Ver agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ],
        context: { locale, currentFlow: 'lineup' },
        source: 'system',
      }
      return response
    }

    case 'abrir_escalacoes_equipe': {
      if (!user || !context.selectedTeamId) throw new Error('Equipe não informada.')
      const teams = await listUserTeams(user)
      const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const lineupResponse = await fetch(new URL('/api/equipe/escalacoes', req.nextUrl.origin), {
        headers: forwardedAuthHeaders(req),
        cache: 'no-store',
      })
      const lineupPayload = await lineupResponse.json()
      if (!lineupResponse.ok) throw new Error(lineupPayload?.error || 'Não foi possível carregar as escalações.')
      const lineups = (lineupPayload.escalacoes || []).filter((item: any) => String(item.equipe_id) === String(team.id))
      response = {
        reply: lineups.length
          ? `Certo, vamos cuidar da escalação da ${team.nome} por aqui. Encontrei ${lineups.length} participação${lineups.length === 1 ? '' : 'ões'} em campeonato. Escolha uma para ver ou gerar o convite dos jogadores.`
          : `A ${team.nome} ainda não possui uma line inscrita em campeonato. Primeiro precisamos fazer uma inscrição; depois eu volto com você para montar a escalação.`,
        intent: match.intent,
        cards: lineups.map((lineup: any) => {
          const token = String(lineup.link_token || '')
          const publicUrl = token ? `${req.nextUrl.origin}/lili?invite=${encodeURIComponent(token)}` : ''
          return {
            id: `lineup-${lineup.campeonato_equipe_id}`,
            kind: 'summary' as const,
            title: lineup.campeonato_nome || 'Campeonato',
            subtitle: [lineup.line_nome, lineup.grupo_nome, lineup.fase_nome].filter(Boolean).join(' · '),
            imageUrl: lineup.line_logo_url || team.logo_url || null,
            badges: [`${Number(lineup.jogadores_confirmados || 0)}/${Number(lineup.limite_jogadores || 6)} jogadores`, token ? 'Convite ativo' : 'Sem convite'],
            details: [
              { label: 'Data', value: lineup.data_jogo ? new Date(`${lineup.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'Ainda não definida' },
              { label: 'Horário', value: lineup.horario ? String(lineup.horario).slice(0, 5) : 'Ainda não definido' },
              { label: 'Vagas livres', value: String(lineup.vagas_disponiveis ?? Math.max(0, Number(lineup.limite_jogadores || 6) - Number(lineup.jogadores_confirmados || 0))) },
            ],
            actions: token
              ? [
                  { id: `copy-lineup-token-${lineup.campeonato_equipe_id}`, label: 'Copiar só token', copyText: token, variant: 'primary' as const },
                  { id: `copy-lineup-link-${lineup.campeonato_equipe_id}`, label: 'Copiar link', copyText: publicUrl, variant: 'secondary' as const },
                  { id: `open-lineup-invite-${lineup.campeonato_equipe_id}`, label: 'Ver convite', href: `/escala/${token}`, variant: 'secondary' as const },
                ]
              : [
                  { id: `generate-lineup-${lineup.campeonato_equipe_id}`, label: 'Gerar convite', message: `Gerar convite de escalação para ${lineup.line_nome}`, intent: 'gerar_token_escalacao' as const, variant: 'primary' as const, context: { locale, selectedTeamId: team.id, currentEntityId: lineup.campeonato_equipe_id, currentFlow: 'lineup' } },
                ],
          }
        }),
        actions: [
          ...(lineups.length ? [] : [{ id: `lineup-register-${team.id}`, label: 'Buscar campeonato com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos' as const, variant: 'primary' as const, context: { locale, selectedTeamId: team.id } }]),
          { id: `lineup-roster-${team.id}`, label: 'Ver elenco da equipe', message: `Ver elenco da equipe ${team.nome}`, intent: 'ver_elenco_equipe', variant: 'secondary', context: { locale, selectedTeamId: team.id, currentFlow: 'team_operations' } },
          { id: `lineup-advanced-${team.id}`, label: 'Ajustes avançados no site', href: `/equipes/${team.id}?section=campeonatos`, variant: 'secondary' },
          backToMainMenu(locale),
        ],
        context: { locale, selectedTeamId: team.id, currentFlow: 'lineup' },
        source: 'system',
      }
      return response
    }

    case 'gerar_token_escalacao': {
      if (!user || !context.selectedTeamId || !context.currentEntityId) throw new Error('Escalação não informada.')
      const teams = await listUserTeams(user)
      const team = teams.find((item: any) => String(item.id) === String(context.selectedTeamId))
      if (!team) throw new Error('Você não possui acesso a esta equipe.')
      const createResponse = await fetch(new URL('/api/equipe/escalacoes', req.nextUrl.origin), {
        method: 'POST',
        headers: forwardedAuthHeaders(req),
        body: JSON.stringify({ campeonato_equipe_id: context.currentEntityId }),
      })
      const created = await createResponse.json()
      if (!createResponse.ok) throw new Error(created?.error || 'Não foi possível gerar o convite.')
      response = {
        reply: `Pronto! O convite da escalação foi criado. Você pode copiar somente o token para usar na Lili ou enviar o link completo aos jogadores.`,
        intent: match.intent,
        cards: [{
          id: `created-lineup-${context.currentEntityId}`,
          kind: 'summary',
          title: 'Convite de escalação criado',
          subtitle: created.token,
          badges: ['Ativo'],
          details: [{ label: 'Token', value: String(created.token) }],
          actions: [
            { id: 'copy-created-lineup-token', label: 'Copiar só token', copyText: String(created.token), variant: 'primary' },
            { id: 'copy-created-lineup-link', label: 'Copiar link', copyText: `${req.nextUrl.origin}/lili?invite=${encodeURIComponent(String(created.token))}`, variant: 'secondary' },
          ],
        }],
        actions: [
          { id: 'back-created-lineups', label: 'Voltar às escalações', message: `Ver escalações da equipe ${team.nome}`, intent: 'abrir_escalacoes_equipe', variant: 'primary', context: { locale, selectedTeamId: team.id, currentFlow: 'lineup' } },
          { id: 'created-lineup-agenda', label: 'Ver agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ],
        context: { locale, selectedTeamId: team.id, currentFlow: 'lineup' },
        source: 'system',
      }
      return response
    }
  }
  return response
}
