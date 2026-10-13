import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from '@backend/lili/types'
import { AuthUser } from './common'
import { listUserTeams } from './teams'

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
  pixQrCode?: string | null
  expiresAt?: string | null
  method?: 'pix' | 'cartao' | 'paypal' | string | null
  maxInstallments?: number | null
}): LiliCard {
  const value = input.valueCents != null
    ? `R$ ${(Number(input.valueCents) / 100).toFixed(2).replace('.', ',')}`
    : 'A confirmar'
  const actions: any[] = []
  const normalizedStatus = String(input.status || 'pendente').toLowerCase()
  const statusLabels: Record<string, string> = {
    pendente: 'Aguardando pagamento',
    aguardando: 'Em processamento',
    em_analise: 'Em análise pela operadora',
    pago: 'Pagamento aprovado',
    confirmado: 'Pagamento aprovado',
    recebido: 'Pagamento aprovado',
    liberado: 'Vaga liberada',
    recusado: 'Pagamento recusado',
    negado: 'Pagamento recusado',
    cancelado: 'Pagamento cancelado',
    expirado: 'Tempo de pagamento encerrado',
    estornado: 'Pagamento estornado',
  }
  const statusLabel = statusLabels[normalizedStatus] || input.status
  const terminalStatus = ['recusado', 'negado', 'cancelado', 'expirado', 'estornado'].includes(normalizedStatus)
  const qrCodeUrl = input.pixQrCode
    ? String(input.pixQrCode).startsWith('data:image/')
      ? String(input.pixQrCode)
      : `data:image/png;base64,${String(input.pixQrCode).replace(/^data:image\/[^;]+;base64,/, '')}`
    : null
  const isCard = input.method === 'cartao'
  if (!terminalStatus && input.pixPayload) actions.push({ id: 'copy-pix', label: 'Copiar código PIX', copyText: input.pixPayload, variant: 'primary' })
  if (!terminalStatus && input.invoiceUrl) actions.push({
    id: 'open-payment',
    label: isCard ? 'Abrir checkout seguro do cartão' : 'Abrir pagamento',
    href: input.invoiceUrl,
    variant: input.pixPayload ? 'secondary' : 'primary',
  })
  return {
    id: input.token,
    kind: 'payment',
    title: isCard ? 'Pagamento com cartão' : 'Pagamento da inscrição',
    subtitle: statusLabel,
    qrCodeUrl: terminalStatus ? null : qrCodeUrl,
    expiresAt: terminalStatus ? null : input.expiresAt || null,
    badges: [value, statusLabel],
    details: [
      ...(isCard ? [{ label: 'Segurança', value: 'Os dados do cartão são informados somente no checkout seguro' }] : []),
      ...(isCard && Number(input.maxInstallments || 1) > 1 ? [{ label: 'Parcelamento', value: `Disponível em até ${Number(input.maxInstallments)}x, conforme as opções exibidas no checkout` }] : []),
      ...(isCard && normalizedStatus === 'em_analise' ? [{ label: 'Análise', value: 'A operadora ainda está validando o pagamento. Não faça outra cobrança enquanto este status estiver ativo.' }] : []),
      ...(isCard && ['recusado', 'negado'].includes(normalizedStatus) ? [{ label: 'Próximo passo', value: 'Tente novamente com outro cartão ou escolha outro meio de pagamento.' }] : []),
      ...(isCard && !terminalStatus ? [{ label: 'Retorno', value: 'Após pagar, você volta para a Lili e continua a inscrição' }] : []),
      { label: 'Status', value: statusLabel },
      { label: 'Código', value: input.token },
    ],
    actions,
  }
}

export async function listUserRegistrations(user: AuthUser) {
  const teams = await listUserTeams(user)
  const teamIds = teams.map((team: any) => String(team.id)).filter(Boolean)
  if (!teamIds.length) return []

  const { data: entries, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,equipe_id,line_id,grupo_id,status,slot_numero,nome_exibicao,created_at')
    .in('equipe_id', teamIds)
    .neq('status', 'excluido')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  if (!entries?.length) return []

  const championshipIds = [...new Set(entries.map((row: any) => row.campeonato_id).filter(Boolean))]
  const lineIds = [...new Set(entries.map((row: any) => row.line_id).filter(Boolean))]
  const groupIds = [...new Set(entries.map((row: any) => row.grupo_id).filter(Boolean))]

  const [championshipResult, lineResult, groupResult] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,tipo,logo_url,banner_url,status').in('id', championshipIds),
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabaseAdmin.from('campeonato_grupos').select('id,nome').in('id', groupIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (championshipResult.error) throw championshipResult.error
  if (lineResult.error) throw lineResult.error
  if (groupResult.error) throw groupResult.error

  const championshipMap = new Map((championshipResult.data || []).map((row: any) => [row.id, row]))
  const teamMap = new Map(teams.map((row: any) => [String(row.id), row]))
  const lineMap = new Map((lineResult.data || []).map((row: any) => [row.id, row]))
  const groupMap = new Map((groupResult.data || []).map((row: any) => [row.id, row]))

  return entries.map((entry: any) => ({
    ...entry,
    campeonato: championshipMap.get(entry.campeonato_id) || null,
    equipe: teamMap.get(String(entry.equipe_id)) || null,
    line: entry.line_id ? lineMap.get(entry.line_id) || null : null,
    grupo: entry.grupo_id ? groupMap.get(entry.grupo_id) || null : null,
  }))
}

export function registrationCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const labels = locale === 'en'
    ? { championship: 'Tournament', registrations: 'registrations', registration: 'registration', team: 'Team', line: 'Line', group: 'Group', slot: 'Slot', active: 'Active', pending: 'Pending', open: 'Open tournament' }
    : locale === 'es'
      ? { championship: 'Campeonato', registrations: 'inscripciones', registration: 'inscripción', team: 'Equipo', line: 'Line', group: 'Grupo', slot: 'Slot', active: 'Activa', pending: 'Pendiente', open: 'Abrir campeonato' }
      : { championship: 'Campeonato', registrations: 'inscrições', registration: 'inscrição', team: 'Equipe', line: 'Line', group: 'Grupo', slot: 'Slot', active: 'Ativa', pending: 'Pendente', open: 'Abrir campeonato' }

  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const championshipId = String(item.campeonato?.id || item.campeonato_id || item.id)
    const current = grouped.get(championshipId) || []
    current.push(item)
    grouped.set(championshipId, current)
  }

  return [...grouped.entries()].map(([championshipId, registrations]) => {
    const first = registrations[0]
    const championship = first.campeonato
    const teamNames = [...new Set(registrations.map((item) => item.equipe?.nome).filter(Boolean))]
    const count = registrations.length

    const details = registrations.map((item, index) => {
      const status = String(item.status || 'ativo')
      const statusLabel = status === 'ativo' ? labels.active : status === 'pendente' ? labels.pending : status
      const lineName = item.line?.nome || item.nome_exibicao || `${labels.line} ${index + 1}`
      const values = [
        item.equipe?.nome ? `${labels.team}: ${item.equipe.nome}` : null,
        item.grupo?.nome ? `${labels.group}: ${item.grupo.nome}` : null,
        item.slot_numero ? `${labels.slot}: ${item.slot_numero}` : null,
        statusLabel,
      ].filter(Boolean)
      return { label: lineName, value: values.join(' • ') }
    })

    return {
      id: `championship-registrations-${championshipId}`,
      kind: 'registration',
      title: championship?.nome || labels.championship,
      subtitle: teamNames.join(' • ') || undefined,
      imageUrl: championship?.logo_url || championship?.banner_url || first.equipe?.logo_url || null,
      badges: [`${count} ${count === 1 ? labels.registration : labels.registrations}`],
      details,
      actions: championship?.id ? [{
        id: `open-registration-${championship.id}`,
        label: labels.open,
        href: `/campeonatos/${championship.id}`,
        variant: 'secondary',
      }] : undefined,
    }
  })
}
