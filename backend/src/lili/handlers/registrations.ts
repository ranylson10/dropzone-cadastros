import { getActiveAccount } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listUserRegistrations, registrationCards } from '@backend/lili/tools'
import { backToMainMenu } from '../helpers/navigation'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleRegistrations(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'listar_minhas_inscricoes': {
      if (!user) {
        response = { reply: 'Para consultar suas inscrições, preciso confirmar sua identidade.', intent: match.intent, requiresAuth: true, context: { currentFlow: 'registrations' }, source: match.source }
        return response
      }
      const activeAccount = await getActiveAccount(req, user)
      let registrations = await listUserRegistrations(user)
      if (String(activeAccount.profile_type) === 'equipe') {
        registrations = registrations.filter((item: any) => String(item.equipe_id) === String(activeAccount.id))
      } else if (String(activeAccount.profile_type) === 'jogador') {
        const { data: playerEntries, error: playerEntriesError } = await supabaseAdmin
          .from('campeonato_jogadores')
          .select('id,campeonato_id,equipe_id,line_id,status,created_at')
          .eq('jogador_id', activeAccount.id)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false })
        if (playerEntriesError) throw playerEntriesError
        const championshipIds = [...new Set((playerEntries || []).map((item: any) => item.campeonato_id).filter(Boolean))]
        const teamIds = [...new Set((playerEntries || []).map((item: any) => item.equipe_id).filter(Boolean))]
        const [{ data: championships }, { data: teams }] = await Promise.all([
          championshipIds.length ? supabaseAdmin.from('campeonatos').select('id,nome,tipo,logo_url,banner_url,status').in('id', championshipIds) : Promise.resolve({ data: [] }),
          teamIds.length ? supabaseAdmin.from('equipes').select('id,nome,tag,logo_url').in('id', teamIds) : Promise.resolve({ data: [] }),
        ])
        const championshipMap = new Map((championships || []).map((item: any) => [String(item.id), item]))
        const teamMap = new Map((teams || []).map((item: any) => [String(item.id), item]))
        registrations = (playerEntries || []).map((item: any) => ({
          ...item,
          campeonato: championshipMap.get(String(item.campeonato_id)) || null,
          equipe: teamMap.get(String(item.equipe_id)) || null,
        }))
      }
      const championshipCount = new Set(registrations.map((item: any) => item.campeonato?.id || item.campeonato_id).filter(Boolean)).size
      const registrationsReply = locale === 'en'
        ? `I found ${registrations.length} registration${registrations.length === 1 ? '' : 's'} across ${championshipCount} tournament${championshipCount === 1 ? '' : 's'}. Lines from the same tournament are grouped together.`
        : locale === 'es'
          ? `Encontré ${registrations.length} inscripción${registrations.length === 1 ? '' : 'es'} en ${championshipCount} campeonato${championshipCount === 1 ? '' : 's'}. Las lines del mismo campeonato aparecen agrupadas.`
          : `Encontrei ${registrations.length} inscrição${registrations.length === 1 ? '' : 'ões'} em ${championshipCount} campeonato${championshipCount === 1 ? '' : 's'}. As lines do mesmo campeonato aparecem agrupadas.`
      response = {
        reply: registrations.length
          ? registrationsReply
          : locale === 'en'
            ? 'I did not find registrations linked to teams you manage.'
            : locale === 'es'
              ? 'No encontré inscripciones vinculadas a los equipos que administras.'
              : 'Não encontrei inscrições vinculadas às equipes que você administra.',
        intent: match.intent,
        cards: registrationCards(registrations, locale),
        actions: [
          { id: 'register-new', label: 'Fazer nova inscrição', message: 'Quero fazer uma nova inscrição', intent: 'iniciar_inscricao', variant: 'primary' },
          { id: 'registrations-agenda', label: 'Ver agenda', message: 'Abrir minha agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
          { id: 'registrations-lineup', label: 'Escalar elenco', message: 'Escalar elenco', intent: 'escalar_elenco', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ],
        context: { locale },
        source: match.source,
      }
      return response
    }
  }
  return response
}
