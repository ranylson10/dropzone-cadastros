import { getAccountsForUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { getPublishedRulebook, getRulebook } from '@backend/campeonatos/rulebook'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import type { LiliCard, LiliLocale } from './types'

type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null }

function liliRegistrationDeadlineOpen(value: unknown) {
  if (!value) return true
  const raw = String(value)
  const deadline = raw.includes('T') ? new Date(raw) : new Date(`${raw.slice(0, 10)}T23:59:59.999`)
  return Number.isFinite(deadline.getTime()) && deadline.getTime() >= Date.now()
}

function liliPriceMode(value: unknown): 'paid' | 'free' | 'consult' {
  if (value == null || value === '') return 'consult'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'consult'
  return amount <= 0 ? 'free' : 'paid'
}

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

  const [{ data: configs }, { data: slots }, { data: phases }, { data: purchases }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('campeonato_id,numero_vagas,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,tem_live,tem_trofeu,premiacao,jogadores_por_vaga,vagas_por_equipe,permite_troca_jogadores,contatos_whatsapp,pagamento_pix_ativo,pagamento_cartao_ativo,pagamento_paypal_ativo,pagamento_whatsapp_ativo,cartao_max_parcelas,paypal_moedas')
      .in('campeonato_id', ids)
      .eq('aceita_novas_inscricoes_equipes', true),
    supabaseAdmin
      .from('campeonato_slots')
      .select('campeonato_id,fase_id,equipe_id,line_id,status')
      .in('campeonato_id', ids)
      .neq('status', 'excluido'),
    supabaseAdmin
      .from('campeonato_fases')
      .select('id,campeonato_id,ordem')
      .in('campeonato_id', ids),
    supabaseAdmin
      .from('sistema_compras_vaga')
      .select('campeonato_id,status,expira_em')
      .in('campeonato_id', ids)
      .in('status', ['pendente', 'pago', 'liberado']),
  ])
  const configMap = new Map((configs || []).map((row: any) => [row.campeonato_id, row]))
  const phaseMap = new Map<string, Set<string> | null>()

  for (const championshipId of ids) {
    const champPhases = (phases || []).filter((phase: any) => phase.campeonato_id === championshipId)
    if (!champPhases.length) {
      phaseMap.set(championshipId, null)
      continue
    }
    const minOrder = Math.min(...champPhases.map((phase: any) => Number(phase.ordem || 0)))
    phaseMap.set(
      championshipId,
      new Set(
        champPhases
          .filter((phase: any) => Number(phase.ordem || 0) === minOrder)
          .map((phase: any) => String(phase.id)),
      ),
    )
  }

  return (championships || []).flatMap((championship: any) => {
    const config: any = configMap.get(championship.id)
    if (!config || !liliRegistrationDeadlineOpen(config.data_limite_inscricao)) return []
    const entryPhaseIds = phaseMap.get(championship.id) || null
    const champSlots = (slots || []).filter((slot: any) => {
      if (slot.campeonato_id !== championship.id) return false
      if (!entryPhaseIds || entryPhaseIds.size === 0) return true
      return !slot.fase_id || entryPhaseIds.has(String(slot.fase_id))
    })
    const physicalFree = champSlots.filter((slot: any) => !slot.equipe_id && !slot.line_id).length
    const now = Date.now()
    const commercialReservations = (purchases || []).filter((purchase: any) => {
      if (purchase.campeonato_id !== championship.id) return false
      if (purchase.status === 'pendente') {
        return !purchase.expira_em || new Date(purchase.expira_em).getTime() > now
      }
      return purchase.status === 'pago' || purchase.status === 'liberado'
    }).length
    const officialTotal = Math.max(0, Math.floor(Number(config.numero_vagas || 0)))
    const occupied = champSlots.filter((slot: any) => Boolean(slot.equipe_id || slot.line_id)).length
    const officialFree = Math.max(0, officialTotal - occupied)
    const free = Math.max(0, officialFree - commercialReservations)
    if (free <= 0) return []
    return [{
      ...championship,
      ...config,
      vagas_livres: free,
      vagas_fisicamente_livres: physicalFree,
      vagas_em_compra: commercialReservations,
      total_slots: champSlots.length,
      total_vagas: officialTotal,
      price_mode: liliPriceMode(config.valor_inscricao),
    }]
  })
}

export function championshipCards(items: any[], registrationMode = false, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.map((item) => ({
    id: item.id,
    kind: 'championship',
    title: item.nome,
    subtitle: [item.tipo, item.plataforma, item.servidor].filter(Boolean).join(' • '),
    imageUrl: item.logo_url || item.banner_url || null,
    badges: [`${item.vagas_livres} vaga${item.vagas_livres === 1 ? '' : 's'}`],
    details: [
      ...(item.price_mode === 'free'
        ? [{ label: 'Inscrição', value: 'Gratuita' }]
        : item.price_mode === 'consult'
          ? [{ label: 'Inscrição', value: 'Valor sob consulta' }]
          : [{ label: 'Inscrição', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` }]),
      ...(item.data_limite_inscricao ? [{ label: 'Prazo', value: new Date(item.data_limite_inscricao).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR') }] : []),
    ],
    actions: registrationMode
      ? [{
          id: `buy-${item.id}`,
          label: item.price_mode === 'free' ? 'Fazer inscrição grátis' : item.price_mode === 'consult' ? 'Consultar vaga' : 'Comprar vaga',
          message: item.price_mode === 'free' ? `Fazer inscrição grátis em ${item.nome}` : item.price_mode === 'consult' ? `Consultar vaga em ${item.nome}` : `Comprar vaga em ${item.nome}`,
          intent: 'comprar_vaga',
          variant: 'primary',
          context: { selectedChampionshipId: item.id, currentFlow: item.price_mode === 'free' ? 'registration' : 'vacancy_purchase' },
        }]
      : [{
          id: `view-${item.id}`,
          label: 'Ver campeonato',
          message: `Abrir campeonato ${item.nome}`,
          intent: 'abrir_campeonato',
          variant: 'primary',
          context: { selectedChampionshipId: item.id, currentFlow: 'championship' },
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
    }] : [{
      id: `open-team-${team.id}`,
      label: 'Abrir equipe',
      message: `Abrir equipe ${team.nome}`,
      intent: 'abrir_equipe',
      variant: 'primary',
      context: { selectedTeamId: team.id, currentFlow: 'team_hub' },
    }],
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
      ...(isCard ? [{ label: 'Segurança', value: 'Os dados do cartão são informados somente no checkout do Asaas' }] : []),
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


export async function listUserVacancyPurchases(authUserId: string) {
  const { data: purchases, error } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('id,token,campeonato_id,status,valor_centavos,pagamento_id,pago_em,liberado_em,consumido_em,expira_em,created_at,meta')
    .eq('auth_user_id', authUserId)
    .in('status', ['pendente', 'pago', 'liberado', 'consumido', 'cancelado', 'expirado', 'estornado'])
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  if (!purchases?.length) return []

  const championshipIds = [...new Set(purchases.map((row: any) => row.campeonato_id).filter(Boolean))]
  const paymentIds = [...new Set(purchases.map((row: any) => row.pagamento_id).filter(Boolean))]
  const [championshipResult, paymentResult] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,banner_url,status,aprovacao_status')
      .in('id', championshipIds),
    paymentIds.length
      ? supabaseAdmin
          .from('sistema_pagamentos')
          .select('id,status,metodo,provider,valor_centavos,invoice_url,pix_payload,asaas_payment_id,created_at,updated_at')
          .in('id', paymentIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (championshipResult.error) throw championshipResult.error
  if (paymentResult.error) throw paymentResult.error

  const championshipMap = new Map((championshipResult.data || []).map((row: any) => [row.id, row]))
  const paymentMap = new Map((paymentResult.data || []).map((row: any) => [row.id, row]))
  const now = Date.now()

  return purchases.map((purchase: any) => {
    const expiredByDate = purchase.status === 'pendente' && purchase.expira_em && new Date(purchase.expira_em).getTime() < now
    const effectiveStatus = expiredByDate ? 'expirado' : String(purchase.status)
    return {
      ...purchase,
      status_original: purchase.status,
      status_efetivo: effectiveStatus,
      campeonato: championshipMap.get(purchase.campeonato_id) || null,
      pagamento: purchase.pagamento_id ? paymentMap.get(purchase.pagamento_id) || null : null,
      liberada: ['pago', 'liberado'].includes(effectiveStatus),
      consumida: effectiveStatus === 'consumido',
      pendente: effectiveStatus === 'pendente',
      encerrada: ['cancelado', 'expirado', 'estornado'].includes(effectiveStatus),
      em_revisao_financeira: Boolean(
        purchase.meta?.financeiro_revisao_manual
        && purchase.meta?.financeiro_revisao_status === 'pendente',
      ),
      financeiro_status: purchase.meta?.financeiro_status || null,
      financeiro_motivo: purchase.meta?.financeiro_motivo || null,
      financeiro_estornado_em: purchase.meta?.financeiro_estornado_em || null,
    }
  })
}

export function vacancyPurchaseCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const formatMoney = (cents: unknown) => `R$ ${(Number(cents || 0) / 100).toFixed(2).replace('.', ',')}`
  const formatDateTime = (value: string | null | undefined) => value
    ? new Date(value).toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '—'

  const labels: Record<string, { badge: string; subtitle: string }> = {
    pendente: { badge: '⏳ Pendente', subtitle: 'Pagamento aguardando confirmação' },
    pago: { badge: '✅ Paga', subtitle: 'Pagamento confirmado · pronta para usar' },
    liberado: { badge: '✅ Liberada', subtitle: 'Vaga pronta para usar' },
    consumido: { badge: '🎟️ Utilizada', subtitle: 'Inscrição concluída' },
    cancelado: { badge: '🚫 Cancelada', subtitle: 'Compra cancelada' },
    expirado: { badge: '⌛ Expirada', subtitle: 'Prazo de pagamento encerrado' },
    estornado: { badge: '↩️ Estornada', subtitle: 'Pagamento devolvido' },
  }

  return items.map((item) => {
    const status = String(item.status_efetivo || item.status || 'pendente')
    const financialReview = Boolean(item.em_revisao_financeira)
    const statusInfo = financialReview
      ? { badge: '⚠️ Revisão financeira', subtitle: 'Inscrição preservada · pagamento estornado em análise' }
      : labels[status] || { badge: status, subtitle: status }
    const title = item.campeonato?.nome || 'Vaga de campeonato'
    const actions: any[] = []

    if (item.liberada) {
      actions.push({
        id: `use-purchased-spot-${item.id}`,
        label: 'Usar vaga agora',
        message: 'Usar minha vaga comprada',
        intent: 'usar_vaga_comprada',
        variant: 'primary',
        context: { purchaseToken: item.token, selectedChampionshipId: item.campeonato_id, currentFlow: 'vacancy_purchase', currentStep: 'team' },
      })
      actions.push({
        id: `resume-purchased-spot-${item.id}`,
        label: 'Abrir link de recuperação',
        href: `/lili?purchase=${encodeURIComponent(String(item.token))}`,
        variant: 'secondary',
      })
    } else if (item.pendente) {
      actions.push({
        id: `check-purchased-spot-${item.id}`,
        label: 'Verificar pagamento',
        message: 'Verificar pagamento',
        intent: 'verificar_pagamento_inscricao',
        variant: 'primary',
        context: { purchaseToken: item.token, selectedChampionshipId: item.campeonato_id, currentFlow: 'vacancy_purchase', currentStep: 'payment_wait' },
      })
      if (item.pagamento?.invoice_url) {
        actions.push({ id: `open-payment-${item.id}`, label: 'Abrir pagamento', href: item.pagamento.invoice_url, variant: 'secondary' })
      }
      actions.push({
        id: `resume-pending-purchase-${item.id}`,
        label: 'Abrir link de recuperação',
        href: `/lili?purchase=${encodeURIComponent(String(item.token))}`,
        variant: 'secondary',
      })
      if (String(item.pagamento?.provider || '').toLowerCase() !== 'paypal') {
        actions.push({
          id: `cancel-pending-purchase-${item.id}`,
          label: 'Desistir e liberar vaga',
          message: 'Cancelar esta compra pendente e liberar a vaga',
          intent: 'cancelar_compra_vaga_pendente',
          variant: 'secondary',
          context: { purchaseToken: item.token, selectedChampionshipId: item.campeonato_id, currentFlow: 'vacancy_purchase', currentStep: 'payment_wait' },
        })
      }
    } else if (item.consumida) {
      actions.push({ id: `view-registration-${item.id}`, label: financialReview ? 'Ver inscrição preservada' : 'Ver minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'primary' })
    } else if (item.encerrada) {
      actions.push({ id: `buy-again-${item.id}`, label: 'Comprar outra vaga', message: `Comprar vaga em ${title}`, intent: 'comprar_vaga', variant: 'primary', context: { selectedChampionshipId: item.campeonato_id, currentFlow: 'vacancy_purchase' } })
    }

    return {
      id: `vacancy-purchase-${item.id}`,
      kind: 'payment',
      title,
      subtitle: statusInfo.subtitle,
      imageUrl: item.campeonato?.logo_url || item.campeonato?.banner_url || null,
      expiresAt: status === 'pendente' ? item.expira_em || null : null,
      badges: [statusInfo.badge, formatMoney(item.valor_centavos)],
      details: [
        { label: 'Valor', value: formatMoney(item.valor_centavos) },
        { label: 'Forma de pagamento', value: String(item.pagamento?.metodo || item.pagamento?.provider || 'Não informada').toUpperCase() },
        { label: 'Criada em', value: formatDateTime(item.created_at) },
        ...(item.pago_em ? [{ label: 'Pago em', value: formatDateTime(item.pago_em) }] : []),
        ...(item.consumido_em ? [{ label: 'Utilizada em', value: formatDateTime(item.consumido_em) }] : []),
        ...(financialReview ? [
          { label: 'Situação da inscrição', value: 'Preservada no campeonato enquanto a organização revisa o caso' },
          { label: 'Situação financeira', value: 'Pagamento estornado · valores e comissões revertidos' },
          { label: 'Motivo registrado', value: String(item.financeiro_motivo || 'Estorno ou chargeback') },
          { label: 'Estornado em', value: formatDateTime(item.financeiro_estornado_em) },
          { label: 'Próximo passo', value: 'Aguarde a decisão manual da organização. A equipe não será removida automaticamente.' },
        ] : []),
        ...(status === 'pendente' ? [
          { label: 'Reserva da vaga', value: 'Mantida por até 2 minutos enquanto o pagamento é concluído' },
          { label: 'Pagamento válido até', value: formatDateTime(item.expira_em) },
        ] : []),
        { label: 'Protocolo', value: String(item.token) },
      ],
      actions,
    }
  })
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


export async function getChampionshipDetails(championshipId: string) {
  const { data: championship, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,premiacao')
    .eq('id', championshipId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!championship || championship.status !== 'ativo' || championship.aprovacao_status !== 'aprovado') {
    throw new Error('Campeonato não encontrado ou indisponível.')
  }

  const [{ data: config }, { data: slots }, { data: phases }, { data: purchases }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('numero_vagas,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,tem_live,tem_trofeu,premiacao,jogadores_por_vaga,vagas_por_equipe,permite_troca_jogadores,data_limite_trocas,contatos_whatsapp,pagamento_pix_ativo,pagamento_cartao_ativo,pagamento_paypal_ativo,pagamento_whatsapp_ativo,cartao_max_parcelas,paypal_moedas')
      .eq('campeonato_id', championshipId)
      .maybeSingle(),
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,fase_id,equipe_id,line_id,status')
      .eq('campeonato_id', championshipId)
      .neq('status', 'excluido'),
    supabaseAdmin
      .from('campeonato_fases')
      .select('id,ordem')
      .eq('campeonato_id', championshipId),
    supabaseAdmin
      .from('sistema_compras_vaga')
      .select('status,expira_em')
      .eq('campeonato_id', championshipId)
      .in('status', ['pendente', 'pago', 'liberado']),
  ])

  const champPhases = phases || []
  const entryPhaseIds = champPhases.length
    ? new Set(
        champPhases
          .filter((phase: any) => Number(phase.ordem || 0) === Math.min(...champPhases.map((current: any) => Number(current.ordem || 0))))
          .map((phase: any) => String(phase.id)),
      )
    : null

  const entrySlots = (slots || []).filter((slot: any) => {
    if (!entryPhaseIds || entryPhaseIds.size === 0) return true
    return !slot.fase_id || entryPhaseIds.has(String(slot.fase_id))
  })
  const physicalFree = entrySlots.filter((slot: any) => !slot.equipe_id && !slot.line_id).length
  const now = Date.now()
  const commercialReservations = (purchases || []).filter((purchase: any) => {
    if (purchase.status === 'pendente') {
      return !purchase.expira_em || new Date(purchase.expira_em).getTime() > now
    }
    return purchase.status === 'pago' || purchase.status === 'liberado'
  }).length
  const officialTotal = Math.max(0, Math.floor(Number(config?.numero_vagas || 0)))
  const occupied = entrySlots.filter((slot: any) => Boolean(slot.equipe_id || slot.line_id)).length
  const officialFree = Math.max(0, officialTotal - occupied)
  const vagasLivres = Math.max(0, officialFree - commercialReservations)
  return {
    ...championship,
    ...(config || {}),
    premiacao_texto: championship.premiacao,
    premiacao_valor: config?.premiacao ?? null,
    vagas_livres: vagasLivres,
    vagas_fisicamente_livres: physicalFree,
    vagas_em_compra: commercialReservations,
    total_slots: entrySlots.length,
    total_vagas: officialTotal,
    price_mode: liliPriceMode(config?.valor_inscricao),
    prazo_aberto: liliRegistrationDeadlineOpen(config?.data_limite_inscricao),
  }
}


export async function getPublishedChampionshipRulebook(championshipId: string, userId?: string | null) {
  // Primeiro usa exatamente o serviço público oficial do Rulebook Builder.
  // Se ainda estiver em rascunho, somente um usuário com permissão no campeonato
  // pode consultá-lo pela Lili; visitantes continuam vendo apenas versões publicadas.
  let source: any = await getPublishedRulebook(championshipId)
  let visibility: 'published' | 'draft' = 'published'

  if (!source && userId) {
    const permission = await getCampeonatoPermission(userId, championshipId)
    const canManage = permission.role === 'owner' || permission.canManage || permission.canOrganizeGroups
    if (canManage) {
      source = await getRulebook(championshipId)
      visibility = 'draft'
    }
  }

  if (!source) return null

  const row = source.rulebook && typeof source.rulebook === 'object' ? source.rulebook : source
  const document = row.documento && typeof row.documento === 'object' ? row.documento as any : null
  if (!document || !Array.isArray(document.chapters)) return null

  return {
    campeonatoId: String(row.campeonato_id || championshipId),
    perfil: row.perfil,
    publicadoEm: row.publicado_em || null,
    versao: row.versao,
    status: String(row.status || (visibility === 'published' ? 'publicado' : 'rascunho')),
    visibility,
    title: String(document.title || 'Regulamento'),
    subtitle: String(document.subtitle || ''),
    chapters: document.chapters
      .filter((chapter: any) => chapter && chapter.included !== false)
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0)),
  }
}

function truncateRuleText(value: unknown, max = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export function rulebookTopicCards(rulebook: any, championshipId: string): LiliCard[] {
  return (rulebook.chapters || []).map((chapter: any, chapterIndex: number) => {
    const articles = Array.isArray(chapter.articles) ? chapter.articles : []
    const topicId = String(chapter.id || chapterIndex)
    return {
      id: `rulebook-topic-${topicId}`,
      kind: 'rulebook',
      title: String(chapter.title || `Tópico ${chapterIndex + 1}`),
      subtitle: `${articles.length} artigo${articles.length === 1 ? '' : 's'}`,
      badges: [`Tópico ${chapterIndex + 1}`],
      actions: [{
        id: `open-rulebook-topic-${topicId}`,
        label: 'Ver regras deste tópico',
        message: `Abrir tópico ${chapter.title || chapterIndex + 1}`,
        intent: 'abrir_topico_regulamento',
        variant: 'primary',
        context: {
          selectedChampionshipId: championshipId,
          selectedRulebookTopicId: topicId,
          currentFlow: 'championship_rules',
          currentStep: 'rulebook_topic',
        },
      }],
    }
  })
}

export function rulebookTopicDetailCard(rulebook: any, championshipId: string, topicId: string): LiliCard | null {
  const chapters = Array.isArray(rulebook.chapters) ? rulebook.chapters : []
  const chapterIndex = chapters.findIndex((chapter: any, index: number) => String(chapter?.id || index) === String(topicId))
  if (chapterIndex < 0) return null

  const chapter = chapters[chapterIndex]
  const articles = Array.isArray(chapter.articles) ? chapter.articles : []
  const details = articles.map((article: any, articleIndex: number) => ({
    label: article.number ? `Art. ${article.number}` : `Regra ${articleIndex + 1}`,
    value: [article.title, String(article.body || '').replace(/\s+/g, ' ').trim()]
      .filter(Boolean)
      .join(' — '),
  }))

  return {
    id: `rulebook-topic-detail-${topicId}`,
    kind: 'rulebook',
    title: String(chapter.title || `Tópico ${chapterIndex + 1}`),
    subtitle: `${articles.length} artigo${articles.length === 1 ? '' : 's'}`,
    badges: [`Tópico ${chapterIndex + 1}`],
    details,
    actions: [{
      id: `open-full-rulebook-topic-${topicId}`,
      label: 'Abrir no regulamento completo',
      href: `/campeonatos/${championshipId}/regulamento${chapter.id ? `#${encodeURIComponent(String(chapter.id))}` : ''}`,
      variant: 'secondary',
    }],
  }
}

function detailsSafeIndex(article: any, articles: any[]) {
  const index = articles.indexOf(article)
  return index >= 0 ? index : 0
}


function normalizeRuleSearchText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const RULE_STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'eu', 'me', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'por', 'posso', 'pode', 'podem', 'que', 'qual', 'quais', 'se', 'ser', 'sobre', 'tem', 'uma', 'um',
  'al', 'con', 'como', 'de', 'del', 'el', 'en', 'es', 'la', 'las', 'los', 'o', 'para', 'por', 'puedo', 'puede', 'que', 'se', 'sobre', 'un', 'una',
  'about', 'a', 'an', 'and', 'can', 'do', 'does', 'for', 'how', 'i', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'with',
])

function ruleSearchTokens(value: unknown) {
  return normalizeRuleSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !RULE_STOP_WORDS.has(token))
}

export function findRulebookAnswers(rulebook: any, question: string, championshipId: string): LiliCard[] {
  const tokens = [...new Set(ruleSearchTokens(question))]
  if (!tokens.length) return []

  const matches: Array<{ score: number; chapter: any; chapterIndex: number; article: any; articleIndex: number }> = []
  for (const [chapterIndex, chapter] of (rulebook.chapters || []).entries()) {
    const chapterText = normalizeRuleSearchText(chapter?.title)
    const articles = Array.isArray(chapter?.articles) ? chapter.articles : []
    for (const [articleIndex, article] of articles.entries()) {
      const titleText = normalizeRuleSearchText(article?.title)
      const bodyText = normalizeRuleSearchText(article?.body)
      const numberText = normalizeRuleSearchText(article?.number)
      let score = 0
      for (const token of tokens) {
        if (numberText === token || numberText.includes(token)) score += 8
        if (titleText.includes(token)) score += 5
        if (chapterText.includes(token)) score += 3
        if (bodyText.includes(token)) score += 1
      }
      const phrase = normalizeRuleSearchText(question)
      if (phrase.length >= 8 && titleText.includes(phrase)) score += 10
      if (score > 0) matches.push({ score, chapter, chapterIndex, article, articleIndex })
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.chapterIndex - b.chapterIndex || a.articleIndex - b.articleIndex)
    .slice(0, 4)
    .map(({ chapter, chapterIndex, article, articleIndex }) => ({
      id: `rule-answer-${chapter?.id || chapterIndex}-${article?.id || articleIndex}`,
      kind: 'rulebook' as const,
      title: String(article?.title || (article?.number ? `Artigo ${article.number}` : `Regra ${articleIndex + 1}`)),
      subtitle: String(chapter?.title || `Tópico ${chapterIndex + 1}`),
      badges: [article?.number ? `Art. ${article.number}` : `Tópico ${chapterIndex + 1}`],
      details: [{ label: 'Regra publicada', value: truncateRuleText(article?.body, 900) || 'Conteúdo não informado.' }],
      actions: [{
        id: `open-rule-answer-${chapter?.id || chapterIndex}-${article?.id || articleIndex}`,
        label: 'Abrir no regulamento completo',
        href: `/campeonatos/${championshipId}/regulamento${chapter?.id ? `#${encodeURIComponent(String(chapter.id))}` : ''}`,
        variant: 'secondary' as const,
      }],
    }))
}

function extractInviteToken(value: string) {
  const raw = decodeURIComponent(String(value || '').trim())
  if (!raw) return { token: '', hintedPath: '' }
  try {
    const url = new URL(raw)
    const path = url.pathname
    const match = path.match(/^\/(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#]+)/i)
    if (match) return { token: decodeURIComponent(match[2]), hintedPath: `/${match[1]}` }
  } catch {
    const match = raw.match(/\/?(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#\s]+)/i)
    if (match) return { token: decodeURIComponent(match[2]), hintedPath: `/${match[1]}` }
  }
  return { token: raw.replace(/^['\"]|['\"]$/g, '').trim(), hintedPath: '' }
}

export async function resolveExistingInvite(value: string) {
  const parsed = extractInviteToken(value)
  const token = parsed.token
  if (!token) throw new Error('Informe o token ou cole o link de convite.')

  const byHint = (path: string) => ({ token, href: `${path}/${encodeURIComponent(token)}` })
  if (parsed.hintedPath) {
    const hinted = byHint(parsed.hintedPath)
    return { ...hinted, kind: parsed.hintedPath, title: 'Convite localizado' }
  }

  const { data: playerTeamInvite, error: playerTeamError } = await supabaseAdmin
    .from('tokens')
    .select('token,tipo,equipe_id,status,expira_em')
    .ilike('token', token)
    .eq('tipo', 'convite_jogador_equipe')
    .maybeSingle()
  if (playerTeamError) throw playerTeamError
  if (playerTeamInvite) {
    return {
      token: playerTeamInvite.token,
      href: `/equipe/entrar/${encodeURIComponent(playerTeamInvite.token)}`,
      kind: 'convite_jogador_equipe',
      title: 'Convite individual de equipe',
    }
  }

  const { data: teamInvite, error: teamError } = await supabaseAdmin
    .from('tokens')
    .select('token,tipo,campeonato_id,grupo_id,slot_id,status,expira_em')
    .ilike('token', token)
    .in('tipo', ['convite_equipe_campeonato', 'team_invite'])
    .maybeSingle()
  if (teamError) throw teamError
  if (teamInvite) {
    return {
      token: teamInvite.token,
      href: `/convite/equipe/${encodeURIComponent(teamInvite.token)}`,
      kind: 'convite_equipe',
      title: 'Convite de equipe',
      campeonatoId: teamInvite.campeonato_id,
    }
  }

  const { data: lineupLink, error: lineupError } = await supabaseAdmin
    .from('campeonato_links_inscricao')
    .select('token,tipo,campeonato_id,grupo_id,campeonato_equipe_id,line_id,ativo,expira_em')
    .ilike('token', token)
    .eq('tipo', 'escalacao_line')
    .maybeSingle()
  if (lineupError) throw lineupError
  if (lineupLink) {
    return {
      token: lineupLink.token,
      href: `/escala/${encodeURIComponent(lineupLink.token)}`,
      kind: 'escalacao_line',
      title: 'Convite para escalação de jogadores',
      campeonatoId: lineupLink.campeonato_id,
    }
  }

  const { data: groupLink, error: groupError } = await supabaseAdmin
    .from('campeonato_links')
    .select('token,tipo,campeonato_id,grupo_id,ativo,expira_em')
    .ilike('token', token)
    .maybeSingle()
  if (groupError) throw groupError
  if (groupLink) {
    const href = groupLink.tipo === 'inscricao_equipes_grupo'
      ? `/convite/grupo/${encodeURIComponent(groupLink.token)}`
      : `/i/${encodeURIComponent(groupLink.token)}`
    return {
      token: groupLink.token,
      href,
      kind: groupLink.tipo,
      title: groupLink.tipo === 'inscricao_equipes_grupo' ? 'Link de inscrição de equipe' : 'Link de inscrição',
      campeonatoId: groupLink.campeonato_id,
    }
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('token,campeonato_id,status')
    .ilike('token', token)
    .maybeSingle()
  if (purchaseError) throw purchaseError
  if (purchase) {
    return {
      token: purchase.token,
      href: `/vagas/compra/${encodeURIComponent(purchase.token)}`,
      kind: 'compra_vaga',
      title: 'Compra de vaga',
      campeonatoId: purchase.campeonato_id,
    }
  }

  throw new Error('Não encontrei um convite válido com esse token. Confira o código ou cole o link completo.')
}


export function agendaCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const labels = locale === 'en'
    ? { match: 'Match', date: 'Date', time: 'Time', tournament: 'Tournament', rounds: 'Rounds', status: 'Status', open: 'Open tournament' }
    : locale === 'es'
      ? { match: 'Partido', date: 'Fecha', time: 'Horario', tournament: 'Campeonato', rounds: 'Partidas', status: 'Estado', open: 'Abrir campeonato' }
      : { match: 'Jogo', date: 'Data', time: 'Horário', tournament: 'Campeonato', rounds: 'Quedas', status: 'Status', open: 'Abrir campeonato' }

  const localeTag = locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US'
  const dateFormatter = new Intl.DateTimeFormat(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' })

  return items.map((item: any) => {
    const rawDate = String(item.data || item.data_jogo || '').slice(0, 10)
    const parsedDate = rawDate ? new Date(`${rawDate}T12:00:00`) : null
    const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime()) ? dateFormatter.format(parsedDate) : rawDate
    const start = String(item.horario_inicio || item.horario || '').slice(0, 5)
    const end = String(item.horario_fim || '').slice(0, 5)
    const timeLabel = [start, end].filter(Boolean).join(' — ')
    const championshipId = item.meta?.campeonato_id || item.campeonato_id || null
    const championshipName = item.meta?.campeonato_nome || item.campeonato_nome || null

    const details = [
      dateLabel ? { label: labels.date, value: dateLabel } : null,
      timeLabel ? { label: labels.time, value: timeLabel } : null,
      championshipName ? { label: labels.tournament, value: championshipName } : null,
      item.meta?.numero_partidas ? { label: labels.rounds, value: String(item.meta.numero_partidas) } : null,
      item.meta?.status ? { label: labels.status, value: String(item.meta.status) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>

    return {
      id: String(item.id),
      kind: 'agenda',
      title: item.titulo || labels.match,
      subtitle: championshipName || undefined,
      badges: item.tipo ? [String(item.tipo)] : undefined,
      details,
      actions: championshipId ? [{
        id: `open-agenda-championship-${championshipId}-${item.id}`,
        label: labels.open,
        href: `/campeonatos/${championshipId}`,
        variant: 'secondary',
      }] : undefined,
    }
  })
}


export function financialReviewCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.map((item: any) => {
    const value = item.valor_centavos != null
      ? `R$ ${(Number(item.valor_centavos) / 100).toFixed(2).replace('.', ',')}`
      : 'Valor não informado'
    const waiting = item.revisao_status === 'aguardando_regularizacao'
    return {
      id: `financial-review-${item.id}`,
      kind: 'summary',
      title: item.campeonato?.nome || 'Revisão financeira',
      subtitle: item.equipe?.nome || item.participacao?.nome_exibicao || 'Inscrição preservada',
      imageUrl: item.equipe?.logo_url || item.campeonato?.logo_url || item.campeonato?.banner_url || null,
      badges: [waiting ? 'Aguardando regularização' : 'Revisão pendente', value],
      details: [
        { label: 'Equipe', value: item.equipe?.nome || item.participacao?.nome_exibicao || 'Não identificada' },
        { label: 'Motivo', value: item.revisao_motivo || 'Estorno' },
        { label: 'Inscrição', value: 'Preservada até decisão da organização' },
        { label: 'Situação', value: waiting ? 'Regularização solicitada ao comprador' : 'Aguardando decisão manual' },
      ],
      actions: [
        {
          id: `review-keep-${item.id}`,
          label: 'Manter inscrição',
          message: 'Manter esta inscrição mesmo após o estorno',
          intent: 'resolver_revisao_financeira',
          variant: 'primary',
          context: { selectedFinancialReviewId: item.id, selectedFinancialReviewDecision: 'manter_inscricao', currentFlow: 'financial_review' },
        },
        {
          id: `review-regularize-${item.id}`,
          label: waiting ? 'Marcar como regularizada' : 'Solicitar regularização',
          message: waiting ? 'Marcar esta pendência como regularizada' : 'Solicitar regularização deste pagamento',
          intent: 'resolver_revisao_financeira',
          variant: 'secondary',
          context: {
            selectedFinancialReviewId: item.id,
            selectedFinancialReviewDecision: waiting ? 'marcar_regularizada' : 'solicitar_regularizacao',
            currentFlow: 'financial_review',
          },
        },
      ],
    }
  })
}


export function financialReviewHistoryCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR'
  return items.map((item: any) => {
    const value = item.valor_centavos != null
      ? `R$ ${(Number(item.valor_centavos) / 100).toFixed(2).replace('.', ',')}`
      : 'Valor não informado'
    const decision = String(item.revisao_decisao || '')
    const decisionLabel = decision === 'manter_inscricao'
      ? 'Inscrição mantida'
      : decision === 'marcar_regularizada'
        ? 'Pagamento regularizado'
        : 'Revisão encerrada'
    const decidedAt = item.revisao_decidida_em
      ? new Date(item.revisao_decidida_em).toLocaleString(dateLocale)
      : 'Data não registrada'
    return {
      id: `financial-review-history-${item.id}`,
      kind: 'summary',
      title: item.campeonato?.nome || 'Revisão financeira encerrada',
      subtitle: item.equipe?.nome || item.participacao?.nome_exibicao || 'Inscrição',
      imageUrl: item.equipe?.logo_url || item.campeonato?.logo_url || item.campeonato?.banner_url || null,
      badges: [decisionLabel, value],
      details: [
        { label: 'Equipe', value: item.equipe?.nome || item.participacao?.nome_exibicao || 'Não identificada' },
        { label: 'Motivo original', value: item.revisao_motivo || 'Estorno' },
        { label: 'Decisão final', value: decisionLabel },
        { label: 'Decidida em', value: decidedAt },
        ...(item.revisao_observacao ? [{ label: 'Observação', value: String(item.revisao_observacao) }] : []),
      ],
      actions: item.campeonato?.id ? [{
        id: `history-open-championship-${item.id}`,
        label: 'Abrir campeonato',
        href: `/campeonatos/${item.campeonato.id}`,
        variant: 'secondary',
      }] : undefined,
    }
  })
}


export function financialCenterCards(input: {
  purchases: any[]
  pendingReviews: any[]
  reviewHistory: any[]
  locale?: LiliLocale
}): LiliCard[] {
  const locale = input.locale || 'pt-BR'
  const money = (cents: number) => new Intl.NumberFormat(
    locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR',
    { style: 'currency', currency: 'BRL' },
  ).format(cents / 100)

  const purchases = input.purchases || []
  const paidToUse = purchases.filter((item: any) => item.liberada).length
  const pending = purchases.filter((item: any) => item.pendente).length
  const used = purchases.filter((item: any) => item.consumida).length
  const closed = purchases.filter((item: any) => item.encerrada).length
  const reviewBuyer = purchases.filter((item: any) => item.em_revisao_financeira).length
  const paidTotal = purchases
    .filter((item: any) => ['pago', 'liberado', 'consumido'].includes(String(item.status_efetivo || item.status)))
    .reduce((sum: number, item: any) => sum + Number(item.valor_centavos || 0), 0)

  const labels = locale === 'en'
    ? {
        buyerTitle: 'Your payments and purchased spots',
        buyerSubtitle: 'Everything related to your purchases in one place',
        pending: 'Pending payments', paidToUse: 'Paid spots to use', used: 'Completed registrations',
        closed: 'Cancelled / expired / refunded', total: 'Confirmed purchase total', review: 'Under financial review',
        organizerTitle: 'Organizer financial reviews', organizerSubtitle: 'Manual cases from tournaments you manage',
        reviewPending: 'Pending decisions', history: 'Closed reviews', role: 'Access', roleValue: 'Only tournaments you manage',
      }
    : locale === 'es'
      ? {
          buyerTitle: 'Tus pagos y cupos comprados',
          buyerSubtitle: 'Todo lo relacionado con tus compras en un solo lugar',
          pending: 'Pagos pendientes', paidToUse: 'Cupos pagados por usar', used: 'Inscripciones concluidas',
          closed: 'Cancelados / vencidos / reembolsados', total: 'Total de compras confirmadas', review: 'En revisión financiera',
          organizerTitle: 'Revisiones financieras del organizador', organizerSubtitle: 'Casos manuales de campeonatos que administras',
          reviewPending: 'Decisiones pendientes', history: 'Revisiones cerradas', role: 'Acceso', roleValue: 'Solo campeonatos que administras',
        }
      : {
          buyerTitle: 'Seus pagamentos e vagas compradas',
          buyerSubtitle: 'Tudo relacionado às suas compras em um só lugar',
          pending: 'Pagamentos pendentes', paidToUse: 'Vagas pagas para usar', used: 'Inscrições concluídas',
          closed: 'Canceladas / expiradas / estornadas', total: 'Total de compras confirmadas', review: 'Em revisão financeira',
          organizerTitle: 'Revisões financeiras do organizador', organizerSubtitle: 'Casos manuais dos campeonatos que você administra',
          reviewPending: 'Decisões pendentes', history: 'Revisões encerradas', role: 'Acesso', roleValue: 'Somente campeonatos administrados por você',
        }

  const cards: LiliCard[] = [{
    id: 'financial-center-buyer',
    kind: 'summary',
    title: labels.buyerTitle,
    subtitle: labels.buyerSubtitle,
    badges: pending ? [`⏳ ${pending}`] : paidToUse ? [`✅ ${paidToUse}`] : undefined,
    details: [
      { label: labels.pending, value: String(pending) },
      { label: labels.paidToUse, value: String(paidToUse) },
      { label: labels.used, value: String(used) },
      { label: labels.closed, value: String(closed) },
      { label: labels.review, value: String(reviewBuyer) },
      { label: labels.total, value: money(paidTotal) },
    ],
    actions: [
      { id: 'financial-center-open-purchases', label: locale === 'en' ? 'View purchases' : locale === 'es' ? 'Ver compras' : 'Ver compras e pagamentos', message: 'Mostrar minhas vagas compradas', intent: 'listar_minhas_vagas_compradas', variant: 'primary', context: { locale } },
      { id: 'financial-center-new-purchase', label: locale === 'en' ? 'Buy a spot' : locale === 'es' ? 'Comprar un cupo' : 'Comprar nova vaga', message: 'Quero comprar uma vaga', intent: 'comprar_vaga', variant: 'secondary', context: { locale } },
    ],
  }]

  if (input.pendingReviews.length || input.reviewHistory.length) {
    cards.push({
      id: 'financial-center-organizer',
      kind: 'summary',
      title: labels.organizerTitle,
      subtitle: labels.organizerSubtitle,
      badges: input.pendingReviews.length ? [`⚠️ ${input.pendingReviews.length}`] : ['✅ 0'],
      details: [
        { label: labels.reviewPending, value: String(input.pendingReviews.length) },
        { label: labels.history, value: String(input.reviewHistory.length) },
        { label: labels.role, value: labels.roleValue },
      ],
      actions: [
        { id: 'financial-center-open-reviews', label: locale === 'en' ? 'Review pending cases' : locale === 'es' ? 'Revisar pendientes' : 'Analisar pendências', message: 'Mostrar revisões financeiras pendentes', intent: 'listar_revisoes_financeiras', variant: 'primary', context: { locale } },
        { id: 'financial-center-open-history', label: locale === 'en' ? 'View history' : locale === 'es' ? 'Ver historial' : 'Ver histórico', message: 'Mostrar histórico de revisões financeiras', intent: 'listar_historico_revisoes_financeiras', variant: 'secondary', context: { locale } },
      ],
    })
  }

  return cards
}

type TeamOperationsOverview = {
  lines: any[]
  players: any[]
  staff: any[]
  managerInvites: any[]
  playerInvites: any[]
  activeRegistrations: any[]
  issues: Array<{ level: 'attention' | 'info'; title: string; detail: string }>
}

function relationMissing(error: any) {
  return ['42P01', 'PGRST205'].includes(String(error?.code || ''))
}

export async function getTeamOperationsOverview(teamId: string): Promise<TeamOperationsOverview> {
  const [linesResult, playersResult, staffResult, managerInvitesResult, playerInvitesResult, registrationsResult] = await Promise.all([
    supabaseAdmin
      .from('equipe_lines')
      .select('id,equipe_id,nome,tag,logo_url,status,created_at,updated_at')
      .eq('equipe_id', teamId)
      .neq('status', 'inativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('equipe_jogadores')
      .select('id,equipe_id,jogador_auth_user_id,nick,foto_url,id_jogo,funcao,localidade,origem,status,created_at,updated_at')
      .eq('equipe_id', teamId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('manager_equipe')
      .select('id,manager_id,pode_ver,pode_editar,pode_escalar,pode_gerar_token,status,created_at')
      .eq('equipe_id', teamId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('equipe_manager_convites')
      .select('id,manager_id,manager_username,status,expira_em,created_at,pode_ver,pode_editar,pode_escalar,pode_gerar_token')
      .eq('equipe_id', teamId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('tokens')
      .select('id,token,status,usado,expira_em,created_at')
      .eq('equipe_id', teamId)
      .eq('tipo', 'convite_jogador_equipe')
      .eq('status', 'ativo')
      .eq('usado', false)
      .order('created_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('id,line_id,campeonato_id,status,nome_exibicao,slot_numero')
      .eq('equipe_id', teamId)
      .eq('status', 'ativo'),
  ])

  for (const result of [linesResult, playersResult, staffResult, registrationsResult]) {
    if (result.error) throw result.error
  }
  if (managerInvitesResult.error && !relationMissing(managerInvitesResult.error)) throw managerInvitesResult.error
  if (playerInvitesResult.error && !relationMissing(playerInvitesResult.error)) throw playerInvitesResult.error

  const staffRows = staffResult.data || []
  const managerIds = [...new Set(staffRows.map((row: any) => row.manager_id).filter(Boolean))]
  const { data: managers, error: managersError } = managerIds.length
    ? await supabaseAdmin
        .from('managers')
        .select('id,username,nome,avatar_url,public_id,status')
        .in('id', managerIds)
    : { data: [] as any[], error: null }
  if (managersError) throw managersError
  const managerMap = new Map((managers || []).map((row: any) => [row.id, row]))
  const staff = staffRows.map((row: any) => ({ ...row, manager: managerMap.get(row.manager_id) || null }))

  const lines = linesResult.data || []
  const players = playersResult.data || []
  const managerInvites = managerInvitesResult.error ? [] : managerInvitesResult.data || []
  const playerInvites = playerInvitesResult.error ? [] : playerInvitesResult.data || []
  const activeRegistrations = registrationsResult.data || []

  const issues: TeamOperationsOverview['issues'] = []
  if (!lines.length) issues.push({ level: 'attention', title: 'Nenhuma line criada', detail: 'Crie pelo menos uma line antes de preparar inscrições e escalações.' })
  if (!players.length) issues.push({ level: 'attention', title: 'Elenco vazio', detail: 'Convide jogadores para formar o elenco oficial da equipe.' })
  if (players.some((row: any) => !String(row.id_jogo || '').trim())) issues.push({ level: 'attention', title: 'Jogadores sem ID do jogo', detail: `${players.filter((row: any) => !String(row.id_jogo || '').trim()).length} jogador(es) precisam completar o ID do Free Fire.` })
  if (players.some((row: any) => !String(row.funcao || '').trim())) issues.push({ level: 'info', title: 'Funções incompletas', detail: `${players.filter((row: any) => !String(row.funcao || '').trim()).length} jogador(es) ainda não possuem função informada.` })
  if (activeRegistrations.some((row: any) => !row.line_id)) issues.push({ level: 'attention', title: 'Inscrição sem line vinculada', detail: `${activeRegistrations.filter((row: any) => !row.line_id).length} inscrição(ões) ativas precisam de revisão.` })
  if (managerInvites.some((row: any) => row.expira_em && new Date(row.expira_em).getTime() < Date.now())) issues.push({ level: 'info', title: 'Convites de manager vencidos', detail: 'Existem convites pendentes com prazo expirado que podem ser cancelados e reenviados.' })
  if (!issues.length) issues.push({ level: 'info', title: 'Equipe organizada', detail: 'Não encontrei pendências operacionais básicas neste momento.' })

  return { lines, players, staff, managerInvites, playerInvites, activeRegistrations, issues }
}

export function teamRosterCards(players: any[], teamId: string): LiliCard[] {
  return players.map((player: any) => ({
    id: `player-${player.id}`,
    kind: 'summary',
    title: player.nick || 'Jogador',
    subtitle: [player.funcao, player.localidade].filter(Boolean).join(' • ') || 'Jogador do elenco',
    imageUrl: player.foto_url || null,
    badges: [player.id_jogo ? `ID ${player.id_jogo}` : 'ID pendente', player.origem === 'convite' ? 'Via convite' : 'Elenco'],
    details: [
      { label: 'Função', value: player.funcao || 'Não informada' },
      { label: 'ID do jogo', value: player.id_jogo || 'Não informado' },
      { label: 'Status', value: player.status || 'ativo' },
    ],
    actions: [{ id: `open-player-${player.id}`, label: 'Abrir equipe', href: `/equipes/${teamId}`, variant: 'secondary' }],
  }))
}

export function teamLineManagementCards(lines: any[], registrations: any[], teamId: string): LiliCard[] {
  const countByLine = new Map<string, number>()
  for (const registration of registrations) {
    if (!registration.line_id) continue
    countByLine.set(registration.line_id, (countByLine.get(registration.line_id) || 0) + 1)
  }
  return lines.map((line: any) => ({
    id: `manage-line-${line.id}`,
    kind: 'line',
    title: line.nome,
    subtitle: line.tag || 'Line da equipe',
    imageUrl: line.logo_url || null,
    badges: [`${countByLine.get(line.id) || 0} campeonato(s) ativo(s)`, line.status || 'ativo'],
    details: [
      { label: 'Participações ativas', value: String(countByLine.get(line.id) || 0) },
      { label: 'Atualizada', value: line.updated_at ? new Date(line.updated_at).toLocaleDateString('pt-BR') : 'Sem registro' },
    ],
    actions: [{ id: `manage-line-page-${line.id}`, label: 'Gerenciar lines', href: `/equipes/${teamId}`, variant: 'primary' }],
  }))
}

export function teamStaffCards(staff: any[], teamId: string): LiliCard[] {
  return staff.map((row: any) => {
    const manager = row.manager || {}
    const permissions = [
      row.pode_ver ? 'ver' : null,
      row.pode_editar ? 'editar' : null,
      row.pode_escalar ? 'escalar' : null,
      row.pode_gerar_token ? 'gerar token' : null,
    ].filter(Boolean)
    return {
      id: `staff-${row.id}`,
      kind: 'summary',
      title: manager.nome || manager.username || 'Manager',
      subtitle: manager.username ? `@${manager.username}` : 'Staff da equipe',
      imageUrl: manager.avatar_url || null,
      badges: permissions.length ? permissions.map(String) : ['Sem permissões'],
      details: [{ label: 'Permissões', value: permissions.join(', ') || 'Nenhuma permissão ativa' }],
      actions: [{ id: `staff-page-${row.id}`, label: 'Gerenciar staff', href: `/equipes/${teamId}`, variant: 'primary' }],
    } as LiliCard
  })
}

export function teamAuditCards(overview: TeamOperationsOverview, teamId: string): LiliCard[] {
  return overview.issues.map((issue, index) => ({
    id: `team-audit-${index}`,
    kind: 'summary',
    title: issue.title,
    subtitle: issue.detail,
    badges: [issue.level === 'attention' ? 'Atenção' : 'Informação'],
    actions: [{ id: `resolve-team-audit-${index}`, label: 'Abrir gestão da equipe', href: `/equipes/${teamId}`, variant: issue.level === 'attention' ? 'primary' : 'secondary' }],
  }))
}


type ManagedChampionship = {
  id: string
  nome: string
  tipo?: string | null
  logo_url?: string | null
  banner_url?: string | null
  status?: string | null
  aprovacao_status?: string | null
  permission: Awaited<ReturnType<typeof getCampeonatoPermission>>
}

export type ChampionshipOperationsOverview = {
  championship: ManagedChampionship
  config: any | null
  phases: any[]
  groups: any[]
  slots: any[]
  teams: any[]
  games: any[]
  rounds: any[]
  rulebookPublished: boolean
  issues: Array<{ level: 'critical' | 'attention' | 'info'; title: string; detail: string; area: string }>
}

export async function listManagedChampionships(authUserId: string): Promise<ManagedChampionship[]> {
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,criado_por,produtora_id,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  const checked = await Promise.all((data || []).map(async (championship: any) => {
    try {
      const permission = await getCampeonatoPermission(authUserId, String(championship.id))
      const operational = permission.role !== 'none' && (
        permission.canManage || permission.canOrganizeGroups || permission.canManageGames ||
        permission.canScore || permission.canGenerateToken || permission.role === 'owner'
      )
      return operational ? { ...championship, permission } as ManagedChampionship : null
    } catch {
      return null
    }
  }))
  return checked.filter(Boolean) as ManagedChampionship[]
}

function permissionLabel(permission: ManagedChampionship['permission']) {
  if (permission.role === 'owner') return 'Organizador principal'
  if (permission.role === 'manager') return 'Staff da produtora'
  if (permission.role === 'seller') return 'Vendedor / operador'
  return 'Visualização'
}

export function managedChampionshipCards(items: ManagedChampionship[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.map((item) => ({
    id: `managed-championship-${item.id}`,
    kind: 'championship',
    title: item.nome,
    subtitle: [item.tipo, permissionLabel(item.permission)].filter(Boolean).join(' • '),
    imageUrl: item.logo_url || item.banner_url || null,
    badges: [item.status || 'rascunho', item.aprovacao_status || 'sem aprovação'],
    details: [
      { label: 'Estrutura', value: item.permission.canOrganizeGroups ? 'Pode gerenciar' : 'Somente leitura' },
      { label: 'Jogos', value: item.permission.canManageGames ? 'Pode gerenciar' : 'Somente leitura' },
      { label: 'Pontuação', value: item.permission.canScore ? 'Pode pontuar' : 'Sem permissão' },
      { label: 'Convites', value: item.permission.canGenerateToken ? 'Pode gerar' : 'Sem permissão' },
    ],
    actions: [
      { id: `open-organizer-${item.id}`, label: locale === 'en' ? 'Open operations' : locale === 'es' ? 'Abrir gestión' : 'Abrir gestão', message: `Abrir central do organizador do campeonato ${item.nome}`, intent: 'abrir_central_organizador', variant: 'primary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'organizer_center' } },
      { id: `open-page-${item.id}`, label: locale === 'en' ? 'Tournament page' : locale === 'es' ? 'Página del torneo' : 'Página do campeonato', href: `/campeonatos/${item.id}`, variant: 'secondary' },
    ],
  }))
}

export async function getChampionshipOperationsOverview(authUserId: string, championshipId: string): Promise<ChampionshipOperationsOverview> {
  const permission = await getCampeonatoPermission(authUserId, championshipId)
  if (permission.role === 'none') throw new Error('Você não possui acesso operacional a este campeonato.')

  const { data: championship, error: championshipError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,criado_por,produtora_id,created_at')
    .eq('id', championshipId)
    .is('deleted_at', null)
    .maybeSingle()
  if (championshipError) throw championshipError
  if (!championship) throw new Error('Campeonato não encontrado.')

  const results = await Promise.all([
    supabaseAdmin.from('campeonato_configuracoes').select('*').eq('campeonato_id', championshipId).maybeSingle(),
    supabaseAdmin.from('campeonato_fases').select('*').eq('campeonato_id', championshipId).order('ordem', { ascending: true }),
    supabaseAdmin.from('campeonato_grupos').select('*').eq('campeonato_id', championshipId),
    supabaseAdmin.from('campeonato_slots').select('*').eq('campeonato_id', championshipId).neq('status', 'excluido'),
    supabaseAdmin.from('campeonato_equipes').select('*').eq('campeonato_id', championshipId).neq('status', 'excluido'),
    supabaseAdmin.from('campeonato_jogos').select('*').eq('campeonato_id', championshipId),
    supabaseAdmin.from('campeonato_rodadas').select('*').eq('campeonato_id', championshipId),
  ])

  const [configResult, phasesResult, groupsResult, slotsResult, teamsResult, gamesResult, roundsResult] = results
  for (const result of [configResult, phasesResult, groupsResult, slotsResult, teamsResult, gamesResult]) {
    if (result.error && !relationMissing(result.error)) throw result.error
  }
  if (roundsResult.error && !relationMissing(roundsResult.error)) throw roundsResult.error

  const config = configResult.error ? null : configResult.data || null
  const phases = phasesResult.error ? [] : phasesResult.data || []
  const groups = groupsResult.error ? [] : groupsResult.data || []
  const slots = slotsResult.error ? [] : slotsResult.data || []
  const teams = teamsResult.error ? [] : teamsResult.data || []
  const games = gamesResult.error ? [] : gamesResult.data || []
  const rounds = roundsResult.error ? [] : roundsResult.data || []
  let rulebookPublished = false
  try {
    const published = await getPublishedRulebook(championshipId)
    rulebookPublished = Boolean(published)
  } catch { rulebookPublished = false }

  const issues: ChampionshipOperationsOverview['issues'] = []
  const add = (level: 'critical' | 'attention' | 'info', area: string, title: string, detail: string) => issues.push({ level, area, title, detail })
  if (!config) add('critical', 'Configuração', 'Configuração principal ausente', 'Complete as configurações gerais antes de abrir inscrições.')
  if (championship.status !== 'ativo') add('attention', 'Publicação', 'Campeonato não está ativo', `Status atual: ${championship.status || 'não informado'}.`)
  if (championship.aprovacao_status && championship.aprovacao_status !== 'aprovado') add('attention', 'Publicação', 'Aprovação pendente', `Aprovação atual: ${championship.aprovacao_status}.`)
  if (!phases.length) add('critical', 'Estrutura', 'Nenhuma fase criada', 'Crie a primeira fase para organizar grupos, slots e jogos.')
  if (phases.length && !groups.length) add('attention', 'Estrutura', 'Nenhum grupo criado', 'As fases existem, mas ainda não há grupos operacionais.')
  if (groups.length && !slots.length) add('critical', 'Vagas', 'Nenhum slot criado', 'Crie os slots dos grupos antes de receber equipes.')
  const occupiedSlots = slots.filter((slot: any) => slot.equipe_id || slot.line_id)
  const incompleteOccupied = occupiedSlots.filter((slot: any) => !slot.equipe_id || !slot.line_id)
  if (incompleteOccupied.length) add('attention', 'Vagas', 'Slots ocupados incompletos', `${incompleteOccupied.length} slot(s) possuem equipe ou line ausente.`)
  const activeTeams = teams.filter((team: any) => String(team.status || 'ativo') === 'ativo')
  const unallocatedTeams = activeTeams.filter((team: any) => !team.grupo_id || (!team.slot_id && !team.slot_numero))
  if (unallocatedTeams.length) add('attention', 'Equipes', 'Equipes sem alocação completa', `${unallocatedTeams.length} inscrição(ões) precisam de grupo ou slot.`)
  if (!activeTeams.length) add('info', 'Equipes', 'Nenhuma equipe inscrita', 'O campeonato ainda não possui inscrições ativas.')
  if (phases.length && !games.length) add('attention', 'Jogos', 'Nenhum jogo criado', 'A estrutura existe, mas o calendário de jogos ainda está vazio.')
  const gamesWithoutSchedule = games.filter((game: any) => !game.data && !game.data_jogo && !game.inicio_em)
  if (gamesWithoutSchedule.length) add('attention', 'Jogos', 'Jogos sem data', `${gamesWithoutSchedule.length} jogo(s) ainda não possuem data definida.`)
  if (!rulebookPublished) add('attention', 'Regulamento', 'Regulamento não publicado', 'Publique o regulamento para que equipes e jogadores consultem regras oficiais.')
  if (config?.aceita_novas_inscricoes_equipes && config?.data_limite_inscricao && !liliRegistrationDeadlineOpen(config.data_limite_inscricao)) {
    add('critical', 'Inscrições', 'Prazo encerrado com inscrições abertas', 'Feche as inscrições ou atualize a data limite.')
  }
  if (!issues.length) add('info', 'Auditoria', 'Estrutura operacional organizada', 'Não encontrei pendências básicas neste momento.')

  return { championship: { ...championship, permission }, config, phases, groups, slots, teams, games, rounds, rulebookPublished, issues }
}

export function championshipOperationsSummaryCard(overview: ChampionshipOperationsOverview): LiliCard {
  const occupied = overview.slots.filter((slot: any) => slot.equipe_id || slot.line_id).length
  const activeTeams = overview.teams.filter((team: any) => String(team.status || 'ativo') === 'ativo').length
  const critical = overview.issues.filter((issue) => issue.level === 'critical').length
  const attention = overview.issues.filter((issue) => issue.level === 'attention').length
  return {
    id: `organizer-summary-${overview.championship.id}`,
    kind: 'championship',
    title: overview.championship.nome,
    subtitle: permissionLabel(overview.championship.permission),
    imageUrl: overview.championship.logo_url || overview.championship.banner_url || null,
    badges: critical ? [`⛔ ${critical} crítico(s)`] : attention ? [`⚠️ ${attention} atenção`] : ['✅ Estrutura organizada'],
    details: [
      { label: 'Fases', value: String(overview.phases.length) },
      { label: 'Grupos', value: String(overview.groups.length) },
      { label: 'Slots', value: `${occupied}/${overview.slots.length} ocupados` },
      { label: 'Equipes ativas', value: String(activeTeams) },
      { label: 'Jogos', value: String(overview.games.length) },
      { label: 'Regulamento', value: overview.rulebookPublished ? 'Publicado' : 'Pendente' },
    ],
  }
}

export function championshipStructureCards(overview: ChampionshipOperationsOverview): LiliCard[] {
  return overview.phases.map((phase: any) => {
    const groups = overview.groups.filter((group: any) => String(group.fase_id) === String(phase.id))
    const groupIds = new Set(groups.map((group: any) => String(group.id)))
    const slots = overview.slots.filter((slot: any) => String(slot.fase_id || '') === String(phase.id) || groupIds.has(String(slot.grupo_id)))
    const occupied = slots.filter((slot: any) => slot.equipe_id || slot.line_id).length
    const games = overview.games.filter((game: any) => String(game.fase_id || '') === String(phase.id)).length
    return {
      id: `phase-${phase.id}`,
      kind: 'summary',
      title: phase.nome || `Fase ${phase.ordem || ''}`.trim(),
      subtitle: `Ordem ${phase.ordem || '—'}`,
      badges: [phase.status || 'configurada'],
      details: [
        { label: 'Grupos', value: String(groups.length) },
        { label: 'Slots', value: String(slots.length) },
        { label: 'Ocupação', value: `${occupied}/${slots.length}` },
        { label: 'Jogos', value: String(games) },
      ],
      actions: [{ id: `open-structure-${phase.id}`, label: 'Abrir estrutura completa', href: `/campeonatos/${overview.championship.id}`, variant: 'secondary' }],
    }
  })
}

export function championshipAuditCards(overview: ChampionshipOperationsOverview): LiliCard[] {
  return overview.issues.map((issue, index) => ({
    id: `championship-audit-${index}`,
    kind: 'summary',
    title: `${issue.level === 'critical' ? '⛔' : issue.level === 'attention' ? '⚠️' : 'ℹ️'} ${issue.title}`,
    subtitle: issue.area,
    badges: [issue.level === 'critical' ? 'Crítico' : issue.level === 'attention' ? 'Atenção' : 'Informação'],
    details: [{ label: 'Diagnóstico', value: issue.detail }],
    actions: [{ id: `audit-open-${index}`, label: 'Abrir painel do campeonato', href: `/campeonatos/${overview.championship.id}`, variant: issue.level === 'critical' ? 'primary' : 'secondary' }],
  }))
}

function liliMoney(cents: unknown, locale: LiliLocale = 'pt-BR') {
  const value = Number(cents || 0) / 100
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(value)
}

export async function getLiliNotifications(userId: string, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('notificacoes')
    .select('id,tipo,titulo,mensagem,status,acao_url,metadata,created_at,read_at')
    .eq('destinatario_auth_user_id', userId)
    .neq('status', 'arquivada')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) throw error
  const items = data || []
  return { items, unread: items.filter((item: any) => item.status === 'nao_lida').length }
}

export async function markAllLiliNotificationsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notificacoes')
    .update({ status: 'lida', read_at: new Date().toISOString() })
    .eq('destinatario_auth_user_id', userId)
    .eq('status', 'nao_lida')
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) throw error
}

export function notificationCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR'
  return items.map((item: any) => ({
    id: `notification-${item.id}`,
    kind: 'notification',
    title: item.titulo || (locale === 'en' ? 'Notification' : locale === 'es' ? 'Notificación' : 'Notificação'),
    subtitle: item.mensagem || undefined,
    badges: [item.status === 'nao_lida' ? (locale === 'en' ? 'New' : locale === 'es' ? 'Nueva' : 'Nova') : (locale === 'en' ? 'Read' : locale === 'es' ? 'Leída' : 'Lida')],
    details: item.created_at ? [{ label: locale === 'en' ? 'Received' : locale === 'es' ? 'Recibida' : 'Recebida', value: new Date(item.created_at).toLocaleString(dateLocale) }] : undefined,
    actions: item.acao_url ? [{ id: `notification-open-${item.id}`, label: locale === 'en' ? 'Open' : locale === 'es' ? 'Abrir' : 'Abrir', href: item.acao_url, variant: 'primary' }] : undefined,
  }))
}

export async function getLiliWalletOverview(user: AuthUser) {
  const accounts = await getAccountsForUser(user as any)
  const account: any = accounts.find((item: any) => item.is_active) || accounts[0] || null
  let ownerType: 'manager' | 'produtora' | 'auth_user' = 'auth_user'
  let ownerId = account?.id || user.id
  if (account?.profile_type === 'manager') ownerType = 'manager'
  if (account?.profile_type === 'produtora') ownerType = 'produtora'

  let walletQuery = supabaseAdmin.from('sistema_carteiras').select('*').eq('dono_tipo', ownerType)
  walletQuery = walletQuery.eq('dono_id', ownerId)
  let { data: wallet, error } = await walletQuery.maybeSingle()
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) throw error
  if (!wallet) return { account, wallet: null, movements: [], withdrawals: [] }

  const [{ data: movements }, { data: withdrawals }] = await Promise.all([
    supabaseAdmin.from('sistema_carteira_lancamentos').select('*').eq('carteira_id', wallet.id).order('created_at', { ascending: false }).limit(30),
    supabaseAdmin.from('sistema_saques').select('id,valor_centavos,status,pix_chave,pix_tipo,titular_nome,created_at,pago_em,rejeicao_motivo,analisado_em').eq('carteira_id', wallet.id).order('created_at', { ascending: false }).limit(30),
  ])
  return { account, wallet, movements: movements || [], withdrawals: withdrawals || [] }
}

export function walletSummaryCard(data: any, locale: LiliLocale = 'pt-BR'): LiliCard {
  const wallet = data.wallet || {}
  const pending = (data.withdrawals || []).filter((item: any) => ['solicitado', 'em_analise', 'processando'].includes(String(item.status))).length
  return {
    id: 'lili-wallet-summary', kind: 'wallet',
    title: locale === 'en' ? 'Wallet overview' : locale === 'es' ? 'Resumen de cartera' : 'Resumo da carteira',
    subtitle: data.account?.name || data.account?.username || undefined,
    details: [
      { label: locale === 'en' ? 'Available balance' : locale === 'es' ? 'Saldo disponible' : 'Saldo disponível', value: liliMoney(wallet.saldo_disponivel_centavos, locale) },
      { label: locale === 'en' ? 'Held balance' : locale === 'es' ? 'Saldo retenido' : 'Saldo retido', value: liliMoney(wallet.saldo_bloqueado_centavos, locale) },
      { label: locale === 'en' ? 'Recent transactions' : locale === 'es' ? 'Movimientos recientes' : 'Movimentações recentes', value: String((data.movements || []).length) },
      { label: locale === 'en' ? 'Pending withdrawals' : locale === 'es' ? 'Retiros pendientes' : 'Saques pendentes', value: String(pending) },
      { label: 'PIX', value: wallet.pix_chave ? `${wallet.pix_tipo || 'chave'} • cadastrado` : (locale === 'en' ? 'Not registered' : locale === 'es' ? 'No registrado' : 'Não cadastrado') },
    ],
    actions: [{ id: 'wallet-open-page', label: locale === 'en' ? 'Open wallet' : locale === 'es' ? 'Abrir cartera' : 'Abrir carteira', href: '/carteira', variant: 'primary' }],
  }
}

export function walletMovementCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.slice(0, 20).map((item: any) => ({
    id: `wallet-movement-${item.id}`, kind: 'wallet',
    title: item.descricao || item.tipo || (locale === 'en' ? 'Transaction' : locale === 'es' ? 'Movimiento' : 'Movimentação'),
    subtitle: item.created_at ? new Date(item.created_at).toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR') : undefined,
    badges: [liliMoney(item.valor_centavos, locale), String(item.natureza || item.tipo || '').toUpperCase()].filter(Boolean),
    details: item.saldo_apos_centavos != null ? [{ label: locale === 'en' ? 'Balance after' : locale === 'es' ? 'Saldo posterior' : 'Saldo após lançamento', value: liliMoney(item.saldo_apos_centavos, locale) }] : undefined,
  }))
}

export function withdrawalCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.slice(0, 20).map((item: any) => ({
    id: `withdrawal-${item.id}`, kind: 'withdrawal',
    title: `${locale === 'en' ? 'Withdrawal' : locale === 'es' ? 'Retiro' : 'Saque'} · ${liliMoney(item.valor_centavos, locale)}`,
    subtitle: item.created_at ? new Date(item.created_at).toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR') : undefined,
    badges: [String(item.status || 'solicitado').replaceAll('_', ' ')],
    details: [
      item.pix_chave ? { label: 'PIX', value: `${item.pix_tipo || 'chave'} • ${String(item.pix_chave).slice(0, 4)}••••` } : null,
      item.rejeicao_motivo ? { label: locale === 'en' ? 'Reason' : locale === 'es' ? 'Motivo' : 'Motivo', value: item.rejeicao_motivo } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>,
  }))
}

export async function getLiliSellerOverview(user: AuthUser) {
  const accounts = await getAccountsForUser(user as any)
  const manager: any = accounts.find((item: any) => item.profile_type === 'manager') || null
  const producer: any = accounts.find((item: any) => item.profile_type === 'produtora') || null
  const assignments = manager ? (await supabaseAdmin.from('campeonato_vendedores').select('id,campeonato_id,limite_vagas,status,nome_publico,whatsapp_url,permissoes,campeonatos:campeonato_id(id,nome,logo_url,status)').eq('manager_id', manager.id).neq('status', 'cancelado')).data || [] : []
  const roster = producer ? (await supabaseAdmin.from('produtora_vendedores').select('id,manager_id,nome_publico,status,whatsapp_url,created_at').eq('produtora_id', producer.id).neq('status', 'cancelado')).data || [] : []
  return { manager, producer, assignments, roster }
}

export function sellerOverviewCards(data: any, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const cards: LiliCard[] = []
  if (data.manager) cards.push({
    id: 'seller-manager-summary', kind: 'seller',
    title: locale === 'en' ? 'My seller operation' : locale === 'es' ? 'Mi operación de ventas' : 'Minha operação como vendedor',
    subtitle: data.manager.name || data.manager.username || undefined,
    details: [
      { label: locale === 'en' ? 'Assigned tournaments' : locale === 'es' ? 'Campeonatos vinculados' : 'Campeonatos vinculados', value: String(data.assignments.length) },
      { label: locale === 'en' ? 'Active assignments' : locale === 'es' ? 'Vínculos activos' : 'Vínculos ativos', value: String(data.assignments.filter((x: any) => x.status === 'ativo').length) },
    ],
    actions: [{ id: 'seller-open-profile', label: locale === 'en' ? 'Open seller page' : locale === 'es' ? 'Abrir página de vendedor' : 'Abrir página de vendedor', href: `/vendedores/${data.manager.id}`, variant: 'primary' }],
  })
  if (data.producer) cards.push({
    id: 'seller-producer-summary', kind: 'seller',
    title: locale === 'en' ? 'Producer sales team' : locale === 'es' ? 'Equipo de ventas de la productora' : 'Equipe de vendedores da produtora',
    subtitle: data.producer.name || undefined,
    details: [
      { label: locale === 'en' ? 'Registered sellers' : locale === 'es' ? 'Vendedores registrados' : 'Vendedores cadastrados', value: String(data.roster.length) },
      { label: locale === 'en' ? 'Active sellers' : locale === 'es' ? 'Vendedores activos' : 'Vendedores ativos', value: String(data.roster.filter((x: any) => x.status === 'ativo').length) },
    ],
    actions: [{ id: 'seller-open-management', label: locale === 'en' ? 'Manage sellers' : locale === 'es' ? 'Gestionar vendedores' : 'Gerenciar vendedores', href: '/produtoras', variant: 'primary' }],
  })
  return cards
}

export type CompetitiveOperationsOverview = {
  championship: ManagedChampionship
  games: any[]
  teamResults: any[]
  playerResults: any[]
  broadcastProfile: any | null
  broadcastLinks: any[]
  liveSessions: any[]
  streamKeys: any[]
  issues: Array<{ level: 'critical' | 'attention' | 'info'; title: string; detail: string }>
}

function optionalRelationError(error: any) {
  return Boolean(error && ['42P01', 'PGRST205', '42703'].includes(String(error.code || '')))
}

export async function getCompetitiveOperationsOverview(authUserId: string, championshipId: string): Promise<CompetitiveOperationsOverview> {
  const permission = await getCampeonatoPermission(authUserId, championshipId)
  if (permission.role === 'none') throw new Error('Você não possui acesso operacional a este campeonato.')

  const { data: championship, error: championshipError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status')
    .eq('id', championshipId)
    .maybeSingle()
  if (championshipError) throw championshipError
  if (!championship) throw new Error('Campeonato não encontrado.')

  const [gamesResult, teamResultsResult, playerResultsResult, broadcastResult, keysResult] = await Promise.all([
    supabaseAdmin.from('campeonato_jogos').select('*').eq('campeonato_id', championshipId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('campeonato_resultados_equipes').select('*').eq('campeonato_id', championshipId).order('updated_at', { ascending: false }).limit(500),
    supabaseAdmin.from('campeonato_resultados_jogadores').select('*').eq('campeonato_id', championshipId).order('updated_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('broadcasts').select('id,nome,username,papel,avatar_url,status').eq('auth_user_id', authUserId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from('campeonato_stream_keys').select('id,label,ativo,created_at,updated_at').eq('campeonato_id', championshipId).order('created_at', { ascending: false }),
  ])

  for (const result of [gamesResult, teamResultsResult, playerResultsResult, broadcastResult, keysResult]) {
    if (result.error && !optionalRelationError(result.error)) throw result.error
  }

  const broadcastProfile = broadcastResult.error ? null : broadcastResult.data
  let broadcastLinks: any[] = []
  let liveSessions: any[] = []
  if (broadcastProfile?.id) {
    const [linksResult, sessionsResult] = await Promise.all([
      supabaseAdmin.from('broadcast_campeonato_links').select('id,display_name,created_at,stream_key_id').eq('broadcast_id', broadcastProfile.id).eq('campeonato_id', championshipId),
      supabaseAdmin.from('broadcast_live_sessions').select('id,nome,controller_token,obs_token,active_overlay_id,ativo,created_at,updated_at').eq('broadcast_id', broadcastProfile.id).eq('campeonato_id', championshipId).order('updated_at', { ascending: false }),
    ])
    if (linksResult.error && !optionalRelationError(linksResult.error)) throw linksResult.error
    if (sessionsResult.error && !optionalRelationError(sessionsResult.error)) throw sessionsResult.error
    broadcastLinks = linksResult.error ? [] : linksResult.data || []
    liveSessions = sessionsResult.error ? [] : sessionsResult.data || []
  }

  const games = gamesResult.error ? [] : gamesResult.data || []
  const teamResults = teamResultsResult.error ? [] : teamResultsResult.data || []
  const playerResults = playerResultsResult.error ? [] : playerResultsResult.data || []
  const streamKeys = keysResult.error ? [] : keysResult.data || []
  const issues: CompetitiveOperationsOverview['issues'] = []

  if (!games.length) issues.push({ level: 'attention', title: 'Nenhum jogo cadastrado', detail: 'Crie os jogos antes de abrir o pontuador ou preparar a transmissão.' })
  const unscheduled = games.filter((game: any) => !(game.data || game.data_jogo || game.inicio_em || game.data_hora))
  if (unscheduled.length) issues.push({ level: 'attention', title: 'Jogos sem horário', detail: `${unscheduled.length} jogo(s) ainda não possuem data e horário definidos.` })

  const teamKillsByMatch = new Map<string, number>()
  for (const row of teamResults) teamKillsByMatch.set(`${row.partida_id}:${row.campeonato_equipe_id}`, Number(row.abates || 0))
  const playerKillsByMatch = new Map<string, number>()
  for (const row of playerResults) {
    const key = `${row.partida_id}:${row.campeonato_equipe_id}`
    playerKillsByMatch.set(key, (playerKillsByMatch.get(key) || 0) + Number(row.abates || 0))
  }
  const killMismatches = [...teamKillsByMatch.entries()].filter(([key, teamKills]) => playerKillsByMatch.has(key) && playerKillsByMatch.get(key) !== teamKills)
  if (killMismatches.length) issues.push({ level: 'critical', title: 'Divergência de abates', detail: `${killMismatches.length} resultado(s) possuem total da equipe diferente da soma dos jogadores.` })

  const invalidPositions = teamResults.filter((row: any) => Number(row.posicao || 0) <= 0)
  if (invalidPositions.length) issues.push({ level: 'critical', title: 'Posições inválidas', detail: `${invalidPositions.length} resultado(s) possuem posição inválida.` })

  const resultGameIds = new Set(teamResults.map((row: any) => String(row.jogo_id || '')).filter(Boolean))
  const gamesWithoutResults = games.filter((game: any) => {
    const state = String(game.status || game.situacao || '').toLowerCase()
    const finished = ['finalizado', 'encerrado', 'concluido', 'concluído'].includes(state)
    return finished && !resultGameIds.has(String(game.id))
  })
  if (gamesWithoutResults.length) issues.push({ level: 'attention', title: 'Jogos finalizados sem resultados', detail: `${gamesWithoutResults.length} jogo(s) aparecem como finalizados, mas não possuem resultados de equipe.` })

  if (!broadcastProfile) issues.push({ level: 'info', title: 'Perfil de transmissão não vinculado', detail: 'Use a área Stream para criar ou vincular um perfil de broadcast.' })
  else if (!broadcastLinks.length) issues.push({ level: 'attention', title: 'Campeonato não vinculado ao Stream', detail: 'Envie ou aceite a chave do campeonato para disponibilizá-lo na mesa de transmissão.' })
  if (broadcastProfile && broadcastLinks.length && !liveSessions.some((row: any) => row.ativo)) issues.push({ level: 'attention', title: 'Nenhuma sessão de live ativa', detail: 'Crie ou reative a mesa para gerar os links de controle e OBS.' })
  if (!streamKeys.some((row: any) => row.ativo)) issues.push({ level: 'info', title: 'Chave Stream ausente', detail: 'O organizador pode gerar uma chave para vincular uma equipe de transmissão.' })
  if (!issues.length) issues.push({ level: 'info', title: 'Operação competitiva organizada', detail: 'Não encontrei pendências básicas de pontuação, resultados ou transmissão.' })

  return {
    championship: { ...championship, permission } as ManagedChampionship,
    games,
    teamResults,
    playerResults,
    broadcastProfile,
    broadcastLinks,
    liveSessions,
    streamKeys,
    issues,
  }
}

function gameDateLabel(game: any, locale: LiliLocale) {
  const raw = game.data_hora || game.inicio_em || game.data_jogo || game.data
  if (!raw) return 'Horário não definido'
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return String(raw)
  return date.toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR')
}

export function competitiveSummaryCard(overview: CompetitiveOperationsOverview, locale: LiliLocale = 'pt-BR'): LiliCard {
  const activeSessions = overview.liveSessions.filter((row: any) => row.ativo).length
  const critical = overview.issues.filter((issue) => issue.level === 'critical').length
  const attention = overview.issues.filter((issue) => issue.level === 'attention').length
  return {
    id: `competitive-summary-${overview.championship.id}`,
    kind: 'summary',
    title: overview.championship.nome,
    subtitle: 'Pontuador, resultados e transmissão',
    imageUrl: overview.championship.logo_url || overview.championship.banner_url || null,
    badges: [`${overview.games.length} jogo(s)`, `${overview.teamResults.length} resultado(s)`, `${activeSessions} live ativa(s)`],
    details: [
      { label: 'Resultados de equipes', value: String(overview.teamResults.length) },
      { label: 'Resultados de jogadores', value: String(overview.playerResults.length) },
      { label: 'Alertas críticos', value: String(critical) },
      { label: 'Pontos de atenção', value: String(attention) },
    ],
  }
}

export function scoringGameCards(overview: CompetitiveOperationsOverview, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const resultsByGame = new Map<string, number>()
  for (const row of overview.teamResults) resultsByGame.set(String(row.jogo_id), (resultsByGame.get(String(row.jogo_id)) || 0) + 1)
  return overview.games.slice(0, 20).map((game: any, index: number) => ({
    id: `score-game-${game.id}`,
    kind: 'game',
    title: game.nome || game.titulo || `Jogo ${index + 1}`,
    subtitle: game.grupo_nome || game.fase_nome || game.status || 'Jogo do campeonato',
    badges: [game.status || game.situacao || 'Pendente', `${resultsByGame.get(String(game.id)) || 0} resultado(s)`],
    details: [
      { label: 'Data e hora', value: gameDateLabel(game, locale) },
      { label: 'Quedas', value: String(game.quantidade_partidas || game.numero_quedas || (Array.isArray(game.quedas) ? game.quedas.length : 'Não informado')) },
      { label: 'Resultados lançados', value: String(resultsByGame.get(String(game.id)) || 0) },
    ],
    actions: [{ id: `open-score-${game.id}`, label: 'Abrir pontuador', href: `/campeonatos/${overview.championship.id}/pontuador/${game.id}`, variant: 'primary' }],
  }))
}

export function competitiveAuditCards(overview: CompetitiveOperationsOverview): LiliCard[] {
  return overview.issues.map((issue, index) => ({
    id: `competitive-audit-${index}`,
    kind: 'result',
    title: issue.title,
    subtitle: issue.detail,
    badges: [issue.level === 'critical' ? 'Crítico' : issue.level === 'attention' ? 'Atenção' : 'Informação'],
    actions: [{ id: `competitive-fix-${index}`, label: issue.title.toLowerCase().includes('transmiss') || issue.title.toLowerCase().includes('stream') || issue.title.toLowerCase().includes('live') ? 'Abrir transmissão' : 'Abrir campeonato', href: issue.title.toLowerCase().includes('transmiss') || issue.title.toLowerCase().includes('stream') || issue.title.toLowerCase().includes('live') ? `/campeonatos/${overview.championship.id}/stream` : `/campeonatos/${overview.championship.id}`, variant: issue.level === 'critical' ? 'primary' : 'secondary' }],
  }))
}

export function broadcastOperationsCards(overview: CompetitiveOperationsOverview): LiliCard[] {
  const cards: LiliCard[] = []
  if (overview.broadcastProfile) {
    cards.push({
      id: `broadcast-profile-${overview.broadcastProfile.id}`,
      kind: 'broadcast',
      title: overview.broadcastProfile.nome || overview.broadcastProfile.username || 'Perfil Stream',
      subtitle: overview.broadcastProfile.papel || 'broadcast',
      imageUrl: overview.broadcastProfile.avatar_url || null,
      badges: [overview.broadcastProfile.status || 'ativo', overview.broadcastLinks.length ? 'Campeonato vinculado' : 'Sem vínculo'],
      details: [
        { label: 'Sessões', value: String(overview.liveSessions.length) },
        { label: 'Sessões ativas', value: String(overview.liveSessions.filter((row: any) => row.ativo).length) },
        { label: 'Chaves ativas', value: String(overview.streamKeys.filter((row: any) => row.ativo).length) },
      ],
      actions: [{ id: 'broadcast-panel', label: 'Abrir mesa Stream', href: `/campeonatos/${overview.championship.id}/stream`, variant: 'primary' }],
    })
  }
  for (const session of overview.liveSessions.slice(0, 8)) {
    cards.push({
      id: `broadcast-session-${session.id}`,
      kind: 'broadcast',
      title: session.nome || 'Mesa de transmissão',
      subtitle: session.ativo ? 'Sessão ativa' : 'Sessão encerrada',
      badges: [session.ativo ? 'Ao vivo / pronta' : 'Inativa', session.active_overlay_id ? 'Overlay selecionado' : 'Sem overlay'],
      details: [
        { label: 'Controle', value: session.controller_token ? 'Link disponível' : 'Não gerado' },
        { label: 'OBS', value: session.obs_token ? 'Browser Source disponível' : 'Não gerado' },
        { label: 'Atualizada', value: session.updated_at ? new Date(session.updated_at).toLocaleString('pt-BR') : 'Sem registro' },
      ],
      actions: [
        ...(session.controller_token ? [{ id: `broadcast-control-${session.id}`, label: 'Abrir controle', href: `/broadcast/control/${session.controller_token}`, variant: 'primary' as const }] : []),
        ...(session.obs_token ? [{ id: `broadcast-obs-${session.id}`, label: 'Abrir fonte OBS', href: `/broadcast/obs/${session.obs_token}`, variant: 'secondary' as const }] : []),
      ],
    })
  }
  return cards
}
