import { getAccountsForUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard } from './types'

type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null }

export async function listOpenChampionships(searchTerm?: string) {
  let query = supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status')
    .eq('status', 'ativo')
    .eq('aprovacao_status', 'aprovado')
    .is('deleted_at', null)
    .limit(12)
  if (searchTerm) query = query.ilike('nome', `%${searchTerm}%`)
  const { data: championships, error } = await query
  if (error) throw error
  const ids = (championships || []).map((item) => item.id)
  if (!ids.length) return []

  const [{ data: configs }, { data: slots }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('campeonato_id,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes')
      .in('campeonato_id', ids)
      .eq('aceita_novas_inscricoes_equipes', true),
    supabaseAdmin
      .from('campeonato_slots')
      .select('campeonato_id,equipe_id,status')
      .in('campeonato_id', ids)
      .neq('status', 'excluido'),
  ])
  const configMap = new Map((configs || []).map((row: any) => [row.campeonato_id, row]))
  return (championships || []).flatMap((championship: any) => {
    const config: any = configMap.get(championship.id)
    if (!config) return []
    const champSlots = (slots || []).filter((slot: any) => slot.campeonato_id === championship.id)
    const free = champSlots.filter((slot: any) => !slot.equipe_id).length
    if (free <= 0) return []
    return [{ ...championship, ...config, vagas_livres: free, total_slots: champSlots.length }]
  })
}

export function championshipCards(items: any[], registrationMode = false): LiliCard[] {
  return items.map((item) => ({
    id: item.id,
    kind: 'championship',
    title: item.nome,
    subtitle: [item.tipo, item.plataforma, item.servidor].filter(Boolean).join(' • '),
    imageUrl: item.logo_url || item.banner_url || null,
    badges: [`${item.vagas_livres} vaga${item.vagas_livres === 1 ? '' : 's'}`],
    details: [
      ...(item.valor_inscricao != null ? [{ label: 'Inscrição', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` }] : []),
      ...(item.data_limite_inscricao ? [{ label: 'Prazo', value: new Date(item.data_limite_inscricao).toLocaleDateString('pt-BR') }] : []),
    ],
    actions: [{
      id: `${registrationMode ? 'register' : 'view'}-${item.id}`,
      label: registrationMode ? 'Escolher campeonato' : 'Ver opções',
      message: registrationMode ? `Quero me inscrever no campeonato ${item.nome}` : `Quero ver o campeonato ${item.nome}`,
      intent: registrationMode ? 'iniciar_inscricao' : 'buscar_campeonato',
      variant: 'primary',
      context: { selectedChampionshipId: item.id, currentFlow: registrationMode ? 'registration' : 'championship' },
    }],
  }))
}

export async function listUserTeams(user: AuthUser) {
  const accounts = await getAccountsForUser(user)
  return listControllableEquipes(user.id, accounts)
}

export function teamCards(teams: any[], championshipId?: string | null): LiliCard[] {
  return teams.map((team) => ({
    id: team.id,
    kind: 'team',
    title: team.nome,
    subtitle: team.tag ? `${team.tag} • ${team.papel === 'dono' ? 'Proprietário' : 'Staff'}` : team.papel === 'dono' ? 'Proprietário' : 'Staff',
    imageUrl: team.logo_url || null,
    badges: [team.permissoes?.pode_escalar ? 'Pode escalar' : 'Visualização'],
    actions: championshipId ? [{
      id: `team-${team.id}`,
      label: 'Usar esta equipe',
      message: `Quero usar a equipe ${team.nome}`,
      intent: 'iniciar_inscricao',
      variant: 'primary',
      context: { selectedChampionshipId: championshipId, selectedTeamId: team.id, currentFlow: 'registration', currentStep: 'team' },
    }] : undefined,
  }))
}

export async function buildRegistrationSummary(championshipId: string, teamId: string) {
  const [{ data: championship, error: championshipError }, { data: team, error: teamError }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', championshipId).maybeSingle(),
    supabaseAdmin.from('equipes').select('id,nome,tag,logo_url').eq('id', teamId).maybeSingle(),
    supabaseAdmin.from('campeonato_equipes').select('id,status,slot_numero').eq('campeonato_id', championshipId).eq('equipe_id', teamId).eq('status', 'ativo').maybeSingle(),
  ])
  if (championshipError) throw championshipError
  if (teamError) throw teamError
  if (!championship || !team) throw new Error('Campeonato ou equipe não encontrado.')
  return { championship, team, existing }
}

export function lineCards(lines: any[], baseContext: Record<string, unknown>): LiliCard[] {
  return lines.map((line) => ({
    id: line.id,
    kind: 'line',
    title: line.nome,
    subtitle: line.jogadores_count != null ? `${line.jogadores_count} jogador${Number(line.jogadores_count) === 1 ? '' : 'es'}` : 'Line da equipe',
    badges: line.disponivel === false ? ['Já utilizada'] : ['Disponível'],
    actions: line.disponivel === false ? undefined : [{
      id: `line-${line.id}`,
      label: 'Escolher esta line',
      message: `Usar a line ${line.nome}`,
      intent: 'selecionar_line_inscricao',
      variant: 'primary',
      context: { ...baseContext, selectedLineId: line.id, selectedLineName: line.nome, currentStep: 'slot' },
    }],
  }))
}

export function slotCards(slots: any[], baseContext: Record<string, unknown>): LiliCard[] {
  return slots.map((slot) => {
    const label = slot.slot_letra || String(slot.slot_numero || '')
    return {
      id: slot.id,
      kind: 'slot',
      title: `Slot ${label}`,
      subtitle: 'Vaga livre',
      badges: ['Disponível'],
      actions: [{
        id: `slot-${slot.id}`,
        label: `Escolher slot ${label}`,
        message: `Escolher o slot ${label}`,
        intent: 'selecionar_slot_inscricao',
        variant: 'primary',
        context: { ...baseContext, selectedSlotId: slot.id, selectedSlotLabel: label, currentStep: 'confirm' },
      }],
    } as LiliCard
  })
}

export function paymentCard(input: {
  token: string
  status: string
  valueCents?: number | null
  invoiceUrl?: string | null
  pixPayload?: string | null
}): LiliCard {
  const value = input.valueCents != null
    ? `R$ ${(Number(input.valueCents) / 100).toFixed(2).replace('.', ',')}`
    : 'A confirmar'
  const actions: any[] = []
  if (input.pixPayload) actions.push({ id: 'copy-pix', label: 'Copiar código PIX', copyText: input.pixPayload, variant: 'primary' })
  if (input.invoiceUrl) actions.push({ id: 'open-payment', label: 'Abrir pagamento', href: input.invoiceUrl, variant: input.pixPayload ? 'secondary' : 'primary' })
  return {
    id: input.token,
    kind: 'payment',
    title: 'Pagamento da inscrição',
    subtitle: `Status: ${input.status}`,
    badges: [value],
    details: [{ label: 'Código', value: input.token }],
    actions,
  }
}
