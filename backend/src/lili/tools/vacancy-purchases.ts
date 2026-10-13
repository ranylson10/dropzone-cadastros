import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from '@backend/lili/types'

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
    const hasPaymentReceipt = Boolean(
      item.pagamento_id
      && (
        item.pago_em
        || item.liberada
        || item.consumida
        || ['pago', 'liberado', 'consumido'].includes(status)
      ),
    )

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
    if (hasPaymentReceipt) {
      actions.push({
        id: `receipt-purchased-spot-${item.id}`,
        label: 'Ver comprovante de pagamento',
        href: `/carteira?comprovante=${encodeURIComponent(String(item.pagamento_id))}&tipo=pagamento`,
        variant: 'secondary',
      })
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
        { label: 'Forma de pagamento', value: String(item.pagamento?.metodo || item.pagamento?.provider || 'Não informada').toLowerCase() === 'asaas' ? 'ONLINE' : String(item.pagamento?.metodo || item.pagamento?.provider || 'Não informada').toUpperCase() },
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
