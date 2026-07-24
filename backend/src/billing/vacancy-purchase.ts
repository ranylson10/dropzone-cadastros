/**
 * Compra de vaga online (ASAAS).
 * Fluxo: pagar → liberar próximo grupo com slots livres → usuário escolhe slot e entra.
 * Isolado do fluxo de link de grupo (que ainda pode cobrar pós-inscrição).
 */

import { supabaseAdmin } from '../shared/supabase-admin'
import {
  createPaymentLink,
  findOrCreateCustomer,
  getPayment,
  getPixQrCode,
  isAsaasConfigured,
  isPaidStatus,
  mapAsaasPaymentStatus,
  AsaasNotConfiguredError,
} from './asaas'
// payments só importa este módulo de forma dinâmica (sem ciclo em load)
import { creditInscriptionSplit } from './payments'
import {
  inserirParticipacaoNoSlot,
  listLinesDisponiveisNoCampeonato,
  resolveLineForInscricao,
} from '../campeonatos/participacao-sync'
import { listControllableEquipes } from '../equipes/manager-team-access'

function moneyReais(centavos: number) {
  return Math.round(centavos) / 100
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** ASAAS às vezes demora um instante para liberar o QR após criar a cobrança. */
async function fetchPixQrWithRetry(paymentId: string, attempts = 3) {
  let last: { encodedImage?: string; payload?: string } = {}
  for (let i = 0; i < attempts; i += 1) {
    try {
      const pix = await getPixQrCode(paymentId)
      last = pix
      if (pix.encodedImage || pix.payload) return pix
    } catch {
      // tenta de novo
    }
    if (i < attempts - 1) await sleep(700 * (i + 1))
  }
  return last
}

function dueDatePlusDays(days = 3) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}


function randomToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'VG'
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/** Próximo grupo com vagas livres (mesma lógica de /api/vagas). */
export async function findNextOpenGroup(campeonatoId: string): Promise<{
  id: string
  nome: string
  vagas_livres: number
  total_slots: number
  proximo_jogo?: { data_jogo?: string | null; horario?: string | null; nome?: string | null } | null
} | null> {
  const [groupsResult, slotsResult, gamesResult, gameGroupsResult] = await Promise.all([
    supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id').eq('campeonato_id', campeonatoId),
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,grupo_id,equipe_id,line_id,status,slot_numero,slot_letra')
      .eq('campeonato_id', campeonatoId),
    supabaseAdmin
      .from('campeonato_jogos')
      .select('id,nome,data_jogo,horario,grupos_ids,status')
      .eq('campeonato_id', campeonatoId)
      .eq('status', 'ativo'),
    supabaseAdmin.from('campeonato_jogos_grupos').select('jogo_id,grupo_id'),
  ])
  if (groupsResult.error) throw groupsResult.error
  if (slotsResult.error) throw slotsResult.error
  if (gamesResult.error) throw gamesResult.error

  const gameGroupMap = new Map<string, string[]>()
  for (const row of gameGroupsResult.data || []) {
    gameGroupMap.set(row.jogo_id, [...(gameGroupMap.get(row.jogo_id) || []), row.grupo_id])
  }

  const today = new Date().toISOString().slice(0, 10)
  const openGroups = (groupsResult.data || [])
    .map((group: any) => {
      const slots = (slotsResult.data || []).filter(
        (slot: any) => slot.grupo_id === group.id && slot.status !== 'excluido',
      )
      const free = slots.filter((slot: any) => !slot.equipe_id && !slot.line_id).length
      if (!free) return null
      const nextGames = (gamesResult.data || [])
        .filter((game: any) => {
          const gids = [...(game.grupos_ids || []), ...(gameGroupMap.get(game.id) || [])]
          return game.data_jogo >= today && gids.includes(group.id)
        })
        .sort((a: any, b: any) =>
          `${a.data_jogo} ${a.horario || ''}`.localeCompare(`${b.data_jogo} ${b.horario || ''}`),
        )
      return {
        id: group.id,
        nome: group.nome,
        vagas_livres: free,
        total_slots: slots.length,
        proximo_jogo: nextGames[0]
          ? {
              data_jogo: nextGames[0].data_jogo,
              horario: nextGames[0].horario,
              nome: nextGames[0].nome,
            }
          : null,
      }
    })
    .filter(Boolean) as any[]

  if (!openGroups.length) return null

  const dated = openGroups
    .filter((g) => g.proximo_jogo)
    .sort((a, b) =>
      `${a.proximo_jogo.data_jogo} ${a.proximo_jogo.horario || ''}`.localeCompare(
        `${b.proximo_jogo.data_jogo} ${b.proximo_jogo.horario || ''}`,
      ),
    )
  return dated[0] || openGroups[0]
}

export async function listFreeSlotsInGroup(campeonatoId: string, grupoId: string) {
  const { data: slots, error } = await supabaseAdmin
    .from('campeonato_slots')
    .select('id,slot_numero,slot_letra,status,equipe_id,line_id,grupo_id')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .neq('status', 'excluido')
    .order('slot_numero', { ascending: true })
  if (error) throw error

  return (slots || [])
    .filter((s) => !s.equipe_id && !s.line_id)
    .map((s) => ({
      id: s.id,
      slot_numero: s.slot_numero,
      slot_letra: s.slot_letra || String.fromCharCode(64 + Number(s.slot_numero || 0)),
      grupo_id: s.grupo_id,
    }))
}

/**
 * Cria (ou reutiliza) compra de vaga + cobrança ASAAS.
 */
export async function createVacancyPurchase(input: {
  campeonatoId: string
  authUserId: string
  payerName: string
  payerEmail: string
  cpfCnpj?: string | null
  vendedorManagerId?: string | null
  method?: 'pix' | 'cartao' | 'paypal'
}) {
  const method = input.method || 'pix'
  if (method !== 'paypal' && !isAsaasConfigured()) throw new AsaasNotConfiguredError()

  const { data: champ, error: cErr } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,produtora_id,status,deleted_at,aprovacao_status')
    .eq('id', input.campeonatoId)
    .maybeSingle()
  if (cErr) throw cErr
  if (!champ || champ.deleted_at || champ.status !== 'ativo' || champ.aprovacao_status !== 'aprovado') {
    throw new Error('Campeonato não encontrado ou indisponível.')
  }

  const { data: config, error: cfgErr } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('valor_inscricao,aceita_novas_inscricoes_equipes,data_limite_inscricao,pagamento_pix_ativo,pagamento_cartao_ativo,pagamento_paypal_ativo')
    .eq('campeonato_id', input.campeonatoId)
    .maybeSingle()
  if (cfgErr) throw cfgErr
  if (!config?.aceita_novas_inscricoes_equipes) {
    throw new Error('Este campeonato não está aceitando novas inscrições.')
  }
  if (method === 'pix' && config.pagamento_pix_ativo === false) {
    throw new Error('Pagamento por PIX não está disponível neste campeonato.')
  }
  if (method === 'cartao' && config.pagamento_cartao_ativo === false) {
    throw new Error('Pagamento por cartão não está disponível neste campeonato.')
  }
  if (method === 'paypal' && config.pagamento_paypal_ativo !== true) {
    throw new Error('Pagamento por PayPal não está disponível neste campeonato.')
  }

  if (config.data_limite_inscricao) {
    const limit = String(config.data_limite_inscricao).slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    if (today > limit) throw new Error('Prazo de inscrição deste campeonato encerrou.')
  }

  const valorReais = Number(config.valor_inscricao || 0)
  if (!Number.isFinite(valorReais) || valorReais < 1) {
    throw new Error('Este campeonato não tem valor de inscrição cobrável online (mín. R$ 1,00). Use o WhatsApp.')
  }
  const valorCentavos = Math.round(valorReais * 100)

  const nextGroup = await findNextOpenGroup(input.campeonatoId)
  if (!nextGroup) throw new Error('Não há grupos com vagas livres neste campeonato.')

  // Reutiliza compra pendente do mesmo usuário no mesmo campeonato
  const { data: existingOpen } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('*')
    .eq('campeonato_id', input.campeonatoId)
    .eq('auth_user_id', input.authUserId)
    .in('status', ['pendente', 'pago', 'liberado'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingOpen && ['pago', 'liberado'].includes(existingOpen.status)) {
    return { compra: existingOpen, payment: await loadPaymentForCompra(existingOpen), reused: true }
  }

  let vendedorManagerId = input.vendedorManagerId || null
  let vendedorAuthUserId: string | null = null
  if (vendedorManagerId) {
    const { data: vend } = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('manager_id,manager_auth_user_id,status')
      .eq('campeonato_id', input.campeonatoId)
      .eq('manager_id', vendedorManagerId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (vend) {
      vendedorManagerId = vend.manager_id
      vendedorAuthUserId = vend.manager_auth_user_id || null
    } else {
      // vendedor global da produtora (portfolio) — ainda atribui se manager existir
      const { data: mgr } = await supabaseAdmin
        .from('managers')
        .select('id,auth_user_id')
        .eq('id', vendedorManagerId)
        .maybeSingle()
      if (mgr) {
        vendedorManagerId = mgr.id
        vendedorAuthUserId = mgr.auth_user_id || null
      } else {
        vendedorManagerId = null
      }
    }
  }

  let compra = existingOpen
  if (!compra) {
    const token = randomToken()
    const { data: created, error: createErr } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .insert({
        token,
        campeonato_id: input.campeonatoId,
        produtora_id: champ.produtora_id || null,
        grupo_id: nextGroup.id,
        auth_user_id: input.authUserId,
        vendedor_manager_id: vendedorManagerId,
        vendedor_auth_user_id: vendedorAuthUserId,
        valor_centavos: valorCentavos,
        status: 'pendente',
        meta: {
          grupo_nome: nextGroup.nome,
          campeonato_nome: champ.nome,
        },
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (createErr) throw createErr
    compra = created
  } else {
    // Atualiza grupo alvo se ainda pendente
    const { data: refreshed } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .update({
        grupo_id: nextGroup.id,
        valor_centavos: valorCentavos,
        vendedor_manager_id: vendedorManagerId || compra.vendedor_manager_id,
        vendedor_auth_user_id: vendedorAuthUserId || compra.vendedor_auth_user_id,
        meta: {
          ...(compra.meta || {}),
          grupo_nome: nextGroup.nome,
          campeonato_nome: champ.nome,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', compra.id)
      .select('*')
      .single()
    if (refreshed) compra = refreshed
  }

  const externalReference = `compra_vaga:${compra.id}`
  let { data: existingPay } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('external_reference', externalReference)
    .in('status', ['pendente', 'aguardando', 'confirmado', 'pago'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPay?.asaas_payment_id && !isPaidStatus(existingPay.status)) {
    // Reutiliza cobrança pendente e garante QR/payload na nossa tela (sem mandar pro ASAAS).
    if (!existingPay.asaas_pix_qrcode || !existingPay.asaas_pix_payload) {
      try {
        const pix = await fetchPixQrWithRetry(existingPay.asaas_payment_id)
        if (pix.encodedImage || pix.payload) {
          const { data: withPix } = await supabaseAdmin
            .from('sistema_pagamentos')
            .update({
              asaas_pix_qrcode: pix.encodedImage || existingPay.asaas_pix_qrcode,
              asaas_pix_payload: pix.payload || existingPay.asaas_pix_payload,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPay.id)
            .select('*')
            .single()
          if (withPix) existingPay = withPix
        }
      } catch {
        // mantém o que já tiver
      }
    }
    if (!compra.pagamento_id) {
      await supabaseAdmin
        .from('sistema_compras_vaga')
        .update({ pagamento_id: existingPay.id, updated_at: new Date().toISOString() })
        .eq('id', compra.id)
    }
    return { compra, payment: existingPay, reused: true }
  }
  if (existingPay && isPaidStatus(existingPay.status)) {
    await markVacancyPurchasePaid(compra.id, existingPay.id)
    const { data: paidCompra } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .select('*')
      .eq('id', compra.id)
      .single()
    return { compra: paidCompra || compra, payment: existingPay, reused: true }
  }

  if (method === 'paypal') {
    return { compra, payment: existingPay || null, reused: Boolean(existingPay) }
  }

  const cpfDigits = input.cpfCnpj ? String(input.cpfCnpj).replace(/\D/g, '') : ''
  if (!cpfDigits || (cpfDigits.length !== 11 && cpfDigits.length !== 14)) {
    throw new Error('Para criar a cobrança é necessário informar o CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador.')
  }

  const customer = await findOrCreateCustomer({
    name: input.payerName,
    email: input.payerEmail,
    cpfCnpj: cpfDigits,
    externalReference: `auth:${input.authUserId}`,
  })

  // Cobrança PIX direta (sem callback ASAAS): o redirect exige domínio
  // cadastrado em "Minha Conta → Informações", e o fluxo já usa QR na nossa página.
  const payment = await createPaymentLink({
    customerId: customer.id,
    valueReais: valorReais,
    dueDate: dueDatePlusDays(3),
    description: `Vaga · ${champ.nome || 'Campeonato'}`.slice(0, 500),
    externalReference,
    billingType: method === 'cartao' ? 'CREDIT_CARD' : 'PIX',
  })

  const pix = method === 'pix' ? await fetchPixQrWithRetry(payment.id) : {}

  const dropzoneMeta = {
    compra_vaga_id: compra.id,
    compra_token: compra.token,
    campeonato_id: input.campeonatoId,
    grupo_id: nextGroup.id,
    produtora_id: champ.produtora_id || null,
    vendedor_manager_id: vendedorManagerId,
    vendedor_auth_user_id: vendedorAuthUserId,
  }

  const row = {
    finalidade: 'compra_vaga',
    referencia_tipo: 'sistema_compras_vaga',
    referencia_id: compra.id,
    pagador_auth_user_id: input.authUserId,
    pagador_tipo: 'equipe',
    valor_centavos: valorCentavos,
    descricao: payment.description || null,
    status: mapAsaasPaymentStatus(payment.status),
    asaas_customer_id: customer.id,
    asaas_payment_id: payment.id,
    asaas_invoice_url: payment.invoiceUrl || null,
    asaas_bank_slip_url: payment.bankSlipUrl || null,
    asaas_pix_qrcode: pix.encodedImage || null,
    asaas_pix_payload: pix.payload || null,
    asaas_status: payment.status,
    billing_type: payment.billingType || (method === 'cartao' ? 'CREDIT_CARD' : 'PIX'),
    external_reference: externalReference,
    payload_criacao: { ...payment, dropzone: dropzoneMeta },
    updated_at: new Date().toISOString(),
  }

  const { data: savedPay, error: payErr } = await supabaseAdmin
    .from('sistema_pagamentos')
    .upsert(row, { onConflict: 'external_reference' })
    .select('*')
    .single()
  if (payErr) throw payErr

  const { data: linked, error: linkErr } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .update({
      pagamento_id: savedPay.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', compra.id)
    .select('*')
    .single()
  if (linkErr) throw linkErr

  // Se ASAAS já retornou pago (raro), libera na hora
  if (isPaidStatus(savedPay.status)) {
    await liberarCompraVagaComSplit(savedPay)
    const { data: paidCompra } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .select('*')
      .eq('id', compra.id)
      .single()
    return { compra: paidCompra || linked, payment: savedPay, reused: false }
  }

  return { compra: linked, payment: savedPay, reused: false }
}

async function loadPaymentForCompra(compra: any) {
  if (!compra.pagamento_id) return null
  const { data } = await supabaseAdmin.from('sistema_pagamentos').select('*').eq('id', compra.pagamento_id).maybeSingle()
  return data
}

/** Marca compra como paga/liberada e resolve grupo com vaga. */
export async function markVacancyPurchasePaid(compraId: string, pagamentoId?: string | null) {
  const next = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('*')
    .eq('id', compraId)
    .maybeSingle()
  if (next.error) throw next.error
  const compra = next.data
  if (!compra) return null
  if (['consumido', 'cancelado', 'estornado'].includes(compra.status)) return compra
  if (['pago', 'liberado'].includes(compra.status)) return compra

  let grupoId = compra.grupo_id
  let grupoNome = compra.meta?.grupo_nome || null
  const open = await findNextOpenGroup(compra.campeonato_id)
  if (open) {
    grupoId = open.id
    grupoNome = open.nome
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .update({
      status: 'liberado',
      pagamento_id: pagamentoId || compra.pagamento_id,
      grupo_id: grupoId,
      pago_em: compra.pago_em || now,
      liberado_em: now,
      meta: {
        ...(compra.meta || {}),
        grupo_nome: grupoNome,
      },
      updated_at: now,
    })
    .eq('id', compraId)
    .select('*')
    .single()
  if (error) throw error
  return updated
}

/** Libera compra + split de carteiras (ledger idempotente; comissão só na 1ª liberação). */
export async function liberarCompraVagaComSplit(pagamento: any) {
  const compraId =
    pagamento.referencia_id
    || pagamento.payload_criacao?.dropzone?.compra_vaga_id
    || null
  if (!compraId) return null

  const { data: before } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('id,status')
    .eq('id', String(compraId))
    .maybeSingle()
  const alreadyOpen = Boolean(before && ['pago', 'liberado', 'consumido'].includes(before.status))

  const compra = await markVacancyPurchasePaid(String(compraId), pagamento.id)
  if (!compra) return null
  if (alreadyOpen) return compra

  const meta = {
    ...(pagamento.payload_criacao?.dropzone || {}),
    campeonato_id: compra.campeonato_id,
    produtora_id: compra.produtora_id,
    vendedor_manager_id: compra.vendedor_manager_id,
    vendedor_auth_user_id: compra.vendedor_auth_user_id,
    compra_vaga_id: compra.id,
  }
  await creditInscriptionSplit({
    ...pagamento,
    meta,
    payload_criacao: { ...(pagamento.payload_criacao || {}), dropzone: meta },
  })
  return compra
}

export async function getVacancyPurchaseByToken(token: string) {
  const normalized = String(token || '').trim().toUpperCase()
  if (!normalized) throw new Error('Token inválido.')

  const { data: compra, error } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('*')
    .eq('token', normalized)
    .maybeSingle()
  if (error) throw error
  if (!compra) throw new Error('Compra não encontrada.')

  const { data: champ } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,banner_url,status')
    .eq('id', compra.campeonato_id)
    .maybeSingle()

  let payment = null
  if (compra.pagamento_id) {
    const { data: pay } = await supabaseAdmin
      .from('sistema_pagamentos')
      .select(
        'id,status,valor_centavos,asaas_invoice_url,asaas_pix_qrcode,asaas_pix_payload,asaas_status,pago_em,created_at,asaas_payment_id',
      )
      .eq('id', compra.pagamento_id)
      .maybeSingle()
    payment = pay
  }

  // Poll sem depender só de webhook: consulta ASAAS e libera se já pagou.
  if (
    payment?.asaas_payment_id
    && !isPaidStatus(payment.status)
    && compra.status === 'pendente'
    && isAsaasConfigured()
  ) {
    try {
      const remote = await getPayment(payment.asaas_payment_id)
      const { applyAsaasPaymentUpdate } = await import('./payments')
      const applied = await applyAsaasPaymentUpdate(remote)
      if (applied?.payment) {
        payment = {
          ...payment,
          ...applied.payment,
          asaas_pix_qrcode: applied.payment.asaas_pix_qrcode || payment.asaas_pix_qrcode,
          asaas_pix_payload: applied.payment.asaas_pix_payload || payment.asaas_pix_payload,
        }
      } else {
        const { data: payAgain } = await supabaseAdmin
          .from('sistema_pagamentos')
          .select(
            'id,status,valor_centavos,asaas_invoice_url,asaas_pix_qrcode,asaas_pix_payload,asaas_status,pago_em,created_at,asaas_payment_id',
          )
          .eq('id', payment.id)
          .maybeSingle()
        if (payAgain) payment = payAgain
      }

      // liberarCompraVagaComSplit pode ter atualizado a compra — re-lê
      const { data: compraAgain } = await supabaseAdmin
        .from('sistema_compras_vaga')
        .select('*')
        .eq('id', compra.id)
        .maybeSingle()
      if (compraAgain) Object.assign(compra, compraAgain)
    } catch {
      // silencioso no poll
    }
  }

  // Garante QR na resposta mesmo se a criação original falhou no getPixQrCode
  if (
    payment?.asaas_payment_id
    && (!payment.asaas_pix_qrcode || !payment.asaas_pix_payload)
    && !isPaidStatus(payment.status)
  ) {
    try {
      const pix = await fetchPixQrWithRetry(payment.asaas_payment_id, 2)
      if (pix.encodedImage || pix.payload) {
        const { data: withPix } = await supabaseAdmin
          .from('sistema_pagamentos')
          .update({
            asaas_pix_qrcode: pix.encodedImage || payment.asaas_pix_qrcode,
            asaas_pix_payload: pix.payload || payment.asaas_pix_payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id)
          .select(
            'id,status,valor_centavos,asaas_invoice_url,asaas_pix_qrcode,asaas_pix_payload,asaas_status,pago_em,created_at,asaas_payment_id',
          )
          .single()
        if (withPix) payment = withPix
      }
    } catch {
      // opcional
    }
  }

  // Se pagamento já está pago no sistema_pagamentos mas compra ainda pendente, sincroniza
  if (payment && isPaidStatus(payment.status) && compra.status === 'pendente') {
    const synced = await markVacancyPurchasePaid(compra.id, payment.id)
    if (synced) Object.assign(compra, synced)
  }

  let grupo: any = null
  let slotsLivres: any[] = []
  if (['pago', 'liberado'].includes(compra.status) || (payment && isPaidStatus(payment.status))) {
    let grupoId = compra.grupo_id
    const open = await findNextOpenGroup(compra.campeonato_id)
    if (open) {
      // se o grupo original encheu, reatribui
      if (!grupoId || grupoId !== open.id) {
        const freeInOriginal = grupoId
          ? await listFreeSlotsInGroup(compra.campeonato_id, grupoId)
          : []
        if (!freeInOriginal.length) {
          grupoId = open.id
          await supabaseAdmin
            .from('sistema_compras_vaga')
            .update({
              grupo_id: open.id,
              meta: { ...(compra.meta || {}), grupo_nome: open.nome },
              updated_at: new Date().toISOString(),
            })
            .eq('id', compra.id)
          compra.grupo_id = open.id
          compra.meta = { ...(compra.meta || {}), grupo_nome: open.nome }
        }
      }
    }

    if (compra.grupo_id) {
      const { data: g } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('id,nome')
        .eq('id', compra.grupo_id)
        .maybeSingle()
      grupo = g
        ? {
            id: g.id,
            nome: g.nome,
            vagas_livres: (await listFreeSlotsInGroup(compra.campeonato_id, g.id)).length,
          }
        : open
          ? { id: open.id, nome: open.nome, vagas_livres: open.vagas_livres }
          : null
      if (grupo?.id) {
        slotsLivres = await listFreeSlotsInGroup(compra.campeonato_id, grupo.id)
      }
    } else if (open) {
      grupo = { id: open.id, nome: open.nome, vagas_livres: open.vagas_livres }
      slotsLivres = await listFreeSlotsInGroup(compra.campeonato_id, open.id)
    }
  }

  return {
    compra: {
      id: compra.id,
      token: compra.token,
      status: compra.status,
      valor_centavos: compra.valor_centavos,
      campeonato_id: compra.campeonato_id,
      grupo_id: compra.grupo_id,
      pago_em: compra.pago_em,
      liberado_em: compra.liberado_em,
      consumido_em: compra.consumido_em,
      expira_em: compra.expira_em,
      campeonato_equipe_id: compra.campeonato_equipe_id,
      slot_id: compra.slot_id,
    },
    campeonato: champ
      ? { id: champ.id, nome: champ.nome, logo_url: champ.logo_url, banner_url: champ.banner_url }
      : null,
    grupo,
    slots_livres: slotsLivres,
    payment: payment
      ? {
          id: payment.id,
          status: payment.status,
          valor_centavos: payment.valor_centavos,
          invoice_url: payment.asaas_invoice_url,
          pix_qrcode: payment.asaas_pix_qrcode,
          pix_payload: payment.asaas_pix_payload,
          asaas_status: payment.asaas_status,
          pago_em: payment.pago_em,
        }
      : null,
    liberado: ['pago', 'liberado'].includes(compra.status),
    consumido: compra.status === 'consumido',
    asaas_configured: isAsaasConfigured(),
  }
}

/**
 * Após pagamento: usuário escolhe equipe/line/slot e entra no campeonato.
 */
export async function claimVacancyPurchase(input: {
  token: string
  authUserId: string
  accounts: Array<{ id: string; profile_type?: string | null; name?: string | null; username?: string | null; data?: any }>
  equipeId: string
  lineId?: string | null
  nomeLine?: string | null
  slotId: string
}) {
  const detail = await getVacancyPurchaseByToken(input.token)
  const compra = detail.compra

  if (compra.status === 'consumido') {
    throw new Error('Esta compra já foi utilizada. Sua line já está no campeonato.')
  }
  if (!['pago', 'liberado'].includes(compra.status)) {
    throw new Error('Pagamento ainda não confirmado. Conclua o pagamento e aguarde a liberação.')
  }
  if (compra.expira_em && new Date(compra.expira_em).getTime() < Date.now()) {
    throw new Error('Esta compra expirou. Entre em contato com a organização.')
  }

  // Só o comprador pode consumir
  const { data: full } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('auth_user_id')
    .eq('id', compra.id)
    .single()
  if (full?.auth_user_id !== input.authUserId) {
    throw new Error('Esta compra pertence a outra conta.')
  }

  const equipes = await listControllableEquipes(input.authUserId, input.accounts)
  const equipe = equipes.find((e) => e.id === input.equipeId)
  if (!equipe) throw new Error('Você não controla esta equipe.')

  // Valida slot livre no grupo liberado (ou reatribui se necessário)
  let grupoId = detail.grupo?.id || compra.grupo_id
  if (!grupoId) {
    const open = await findNextOpenGroup(compra.campeonato_id)
    if (!open) throw new Error('Não há mais vagas livres neste campeonato.')
    grupoId = open.id
  }

  const { data: slot, error: slotErr } = await supabaseAdmin
    .from('campeonato_slots')
    .select('id,campeonato_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status')
    .eq('id', input.slotId)
    .eq('campeonato_id', compra.campeonato_id)
    .maybeSingle()
  if (slotErr) throw slotErr
  if (!slot) throw new Error('Slot não encontrado.')
  if (slot.equipe_id || slot.line_id) throw new Error('Este slot já está ocupado. Escolha outro.')
  if (slot.grupo_id !== grupoId) {
    // permite se o slot for de outro grupo aberto e o original encheu
    const freeInTarget = await listFreeSlotsInGroup(compra.campeonato_id, slot.grupo_id)
    if (!freeInTarget.some((s) => s.id === slot.id)) {
      throw new Error('Slot inválido para o grupo liberado.')
    }
    grupoId = slot.grupo_id
  }

  const resolvedLine = await resolveLineForInscricao({
    equipeId: equipe.id,
    campeonatoId: compra.campeonato_id,
    lineId: input.lineId,
    nomeLine: input.nomeLine,
  })

  const participacao = await inserirParticipacaoNoSlot({
    campeonatoId: compra.campeonato_id,
    slotId: slot.id,
    lineId: resolvedLine.id,
    equipeId: equipe.id,
    nomeExibicao: resolvedLine.nome,
    origem: 'compra_online',
    criadoPor: input.authUserId,
  })

  const now = new Date().toISOString()
  const { data: consumed, error: consErr } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .update({
      status: 'consumido',
      equipe_id: equipe.id,
      line_id: resolvedLine.id,
      slot_id: slot.id,
      grupo_id: grupoId,
      campeonato_equipe_id: participacao.id,
      consumido_em: now,
      updated_at: now,
    })
    .eq('id', compra.id)
    .eq('status', compra.status) // evita double-claim
    .select('*')
    .single()

  if (consErr) {
    // participação já criada — tenta marcar mesmo assim
    await supabaseAdmin
      .from('sistema_compras_vaga')
      .update({
        status: 'consumido',
        equipe_id: equipe.id,
        line_id: resolvedLine.id,
        slot_id: slot.id,
        grupo_id: grupoId,
        campeonato_equipe_id: participacao.id,
        consumido_em: now,
        updated_at: now,
      })
      .eq('id', compra.id)
  }

  return {
    ok: true,
    compra: consumed || { ...compra, status: 'consumido', campeonato_equipe_id: participacao.id },
    participacao,
    campeonato_equipe_id: participacao.id,
    line: { id: resolvedLine.id, nome: resolvedLine.nome, criada_agora: resolvedLine.criada_agora },
    slot: {
      id: slot.id,
      slot_letra: slot.slot_letra || String.fromCharCode(64 + Number(slot.slot_numero || 0)),
      slot_numero: slot.slot_numero,
    },
    grupo_id: grupoId,
    mensagem: `Line "${resolvedLine.nome}" inscrita no slot ${slot.slot_letra || slot.slot_numero}.`,
  }
}

/** Dados auxiliares para a tela de claim (equipes + lines). */
export async function loadClaimContext(input: {
  token: string
  authUserId: string
  accounts: Array<{ id: string; profile_type?: string | null; name?: string | null; username?: string | null; data?: any }>
  equipeId?: string | null
}) {
  const detail = await getVacancyPurchaseByToken(input.token)
  const equipes = await listControllableEquipes(input.authUserId, input.accounts)

  let lines: any[] = []
  const selectedEquipeId = input.equipeId || equipes[0]?.id || null
  if (selectedEquipeId && detail.compra.campeonato_id) {
    lines = await listLinesDisponiveisNoCampeonato(selectedEquipeId, detail.compra.campeonato_id)
  }

  return {
    ...detail,
    equipes,
    lines,
    equipe_selecionada_id: selectedEquipeId,
  }
}
