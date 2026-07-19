import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { getOrCreateWallet, listWalletMovements } from '@backend/billing/wallet'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function resolveOwner(account: any, userId: string) {
  let donoTipo: 'manager' | 'produtora' | 'auth_user' = 'auth_user'
  let donoId: string | null = account?.id || userId
  if (account?.profile_type === 'manager') {
    donoTipo = 'manager'
    donoId = account.id
  } else if (account?.profile_type === 'produtora') {
    donoTipo = 'produtora'
    donoId = account.id
  }
  return { donoTipo, donoId }
}

/**
 * Carteira do perfil ativo (manager/vendedor ou produtora).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const { donoTipo, donoId } = resolveOwner(account, user.id)

    const wallet = await getOrCreateWallet({
      donoTipo,
      donoId,
      authUserId: user.id,
    })

    const [movements, saques, pagamentos] = await Promise.all([
      listWalletMovements(wallet.id, 80),
      supabaseAdmin
        .from('sistema_saques')
        .select('id,valor_centavos,status,pix_chave,pix_tipo,titular_nome,created_at,pago_em,rejeicao_motivo,analisado_em')
        .eq('carteira_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabaseAdmin
        .from('sistema_pagamentos')
        .select(
          'id,finalidade,status,valor_centavos,descricao,asaas_invoice_url,asaas_status,billing_type,pago_em,created_at,referencia_tipo,referencia_id,external_reference',
        )
        .eq('pagador_auth_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    return NextResponse.json({
      perfil: {
        tipo: account?.profile_type || null,
        nome: account?.name || user.email || 'Conta',
        username: account?.username || null,
      },
      carteira: {
        id: wallet.id,
        saldo_disponivel_centavos: wallet.saldo_disponivel_centavos,
        saldo_bloqueado_centavos: wallet.saldo_bloqueado_centavos,
        dono_tipo: wallet.dono_tipo,
        pix_chave: wallet.pix_chave || null,
        pix_tipo: wallet.pix_tipo || null,
        pix_titular: wallet.pix_titular || null,
      },
      lancamentos: movements,
      saques: saques.data || [],
      pagamentos: pagamentos.error ? [] : pagamentos.data || [],
    })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/42P01|PGRST205|does not exist|42703|PGRST204/i.test(msg)) {
      return NextResponse.json({
        error: 'Rode o SQL de carteira (DOWNLOAD_carteira_asaas.sql + pix keys).',
        needs_migration: true,
      }, { status: 503 })
    }
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

/** PATCH — cadastrar/atualizar chave PIX da carteira */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json().catch(() => ({}))
    const { donoTipo, donoId } = resolveOwner(account, user.id)

    const wallet = await getOrCreateWallet({
      donoTipo,
      donoId,
      authUserId: user.id,
    })

    const pixChave = String(body.pix_chave || '').trim()
    const pixTipo = String(body.pix_tipo || 'aleatoria').trim()
    const pixTitular = String(body.pix_titular || account?.name || '').trim()

    if (!pixChave || pixChave.length < 5) throw new Error('Informe uma chave PIX válida.')

    const tipoOk = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'].includes(pixTipo)
      ? pixTipo
      : 'aleatoria'

    const { data, error } = await supabaseAdmin
      .from('sistema_carteiras')
      .update({
        pix_chave: pixChave,
        pix_tipo: tipoOk,
        pix_titular: pixTitular || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id)
      .select('id,pix_chave,pix_tipo,pix_titular,saldo_disponivel_centavos')
      .single()

    if (error) {
      if (['42703', 'PGRST204'].includes(error.code || '')) {
        throw new Error('Rode o SQL: database/migrations/20260719_carteira_pix_keys.sql')
      }
      throw error
    }

    return NextResponse.json({ carteira: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao salvar PIX' }, { status: 400 })
  }
}
