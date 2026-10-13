import type { LiliCard, LiliLocale } from '@backend/lili/types'

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
