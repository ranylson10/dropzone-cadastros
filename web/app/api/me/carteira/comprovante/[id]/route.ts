import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { getOrCreateWallet } from '@backend/billing/wallet'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Dados do comprovante (pagamento ou saque) no estilo extrato bancário.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const { id } = await context.params
    const tipo = req.nextUrl.searchParams.get('tipo') || 'pagamento' // pagamento | saque | lancamento

    const base = {
      instituicao: 'DropZone Pagamentos',
      cnpj: '—',
      gerado_em: new Date().toISOString(),
      titular: account?.name || user.email || 'Cliente DropZone',
      perfil: account?.profile_type || null,
    }

    if (tipo === 'saque') {
      const { data: saque, error } = await supabaseAdmin
        .from('sistema_saques')
        .select('*')
        .eq('id', id)
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!saque) throw new Error('Comprovante não encontrado.')

      return NextResponse.json({
        comprovante: {
          ...base,
          tipo: 'saque',
          id: saque.id,
          status: saque.status,
          valor_centavos: saque.valor_centavos,
          descricao: 'Transferência PIX · Saque carteira DropZone',
          data_movimento: saque.pago_em || saque.created_at,
          destino: {
            nome: saque.titular_nome || base.titular,
            chave_pix: saque.pix_chave,
            tipo_chave: saque.pix_tipo,
          },
          origem: {
            nome: 'DropZone Carteira',
            instituicao: 'DropZone',
          },
          autenticacao: String(saque.id).replace(/-/g, '').slice(0, 32).toUpperCase(),
        },
      })
    }

    if (tipo === 'lancamento') {
      let donoTipo: 'manager' | 'produtora' | 'auth_user' = 'auth_user'
      let donoId = account?.id || user.id
      if (account?.profile_type === 'manager') donoTipo = 'manager'
      if (account?.profile_type === 'produtora') donoTipo = 'produtora'
      const wallet = await getOrCreateWallet({ donoTipo, donoId, authUserId: user.id })

      const { data: lanc, error } = await supabaseAdmin
        .from('sistema_carteira_lancamentos')
        .select('*')
        .eq('id', id)
        .eq('carteira_id', wallet.id)
        .maybeSingle()
      if (error) throw error
      if (!lanc) throw new Error('Lançamento não encontrado.')

      return NextResponse.json({
        comprovante: {
          ...base,
          tipo: 'lancamento',
          id: lanc.id,
          status: lanc.direcao === 'credito' ? 'creditado' : 'debitado',
          valor_centavos: lanc.valor_centavos,
          descricao: lanc.descricao || String(lanc.tipo || '').replaceAll('_', ' '),
          data_movimento: lanc.created_at,
          direcao: lanc.direcao,
          saldo_apos_centavos: lanc.saldo_apos_centavos,
          autenticacao: String(lanc.id).replace(/-/g, '').slice(0, 32).toUpperCase(),
          origem: { nome: 'DropZone Carteira', instituicao: 'DropZone' },
          destino: { nome: base.titular },
        },
      })
    }

    // pagamento
    const { data: pag, error } = await supabaseAdmin
      .from('sistema_pagamentos')
      .select('*')
      .eq('id', id)
      .eq('pagador_auth_user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!pag) throw new Error('Pagamento não encontrado.')

    return NextResponse.json({
      comprovante: {
        ...base,
        tipo: 'pagamento',
        id: pag.id,
        status: pag.status,
        valor_centavos: pag.valor_centavos,
        descricao: pag.descricao || String(pag.finalidade || '').replaceAll('_', ' '),
        data_movimento: pag.pago_em || pag.created_at,
        billing_type: pag.billing_type,
        asaas_id: pag.asaas_payment_id,
        invoice_url: pag.asaas_invoice_url,
        autenticacao: String(pag.asaas_payment_id || pag.id).replace(/-/g, '').slice(0, 32).toUpperCase(),
        origem: {
          nome: base.titular,
          instituicao: 'Pagador',
        },
        destino: {
          nome: 'DropZone / Organizador',
          instituicao: 'ASAAS / DropZone',
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
