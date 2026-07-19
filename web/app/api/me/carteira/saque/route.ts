import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { debitWallet, getOrCreateWallet } from '@backend/billing/wallet'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const MIN_SAQUE_CENTAVOS = 1000 // R$ 10,00

/**
 * Solicita saque do saldo disponível (PIX).
 * Admin processa manualmente na 1ª versão (status solicitado → pago).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json().catch(() => ({}))

    const valorCentavos = Math.floor(Number(body.valor_centavos))

    let donoTipo: 'manager' | 'produtora' | 'auth_user' = 'auth_user'
    let donoId: string = account?.id || user.id
    if (account?.profile_type === 'manager') {
      donoTipo = 'manager'
      donoId = account.id
    } else if (account?.profile_type === 'produtora') {
      donoTipo = 'produtora'
      donoId = account.id
    }

    const wallet = await getOrCreateWallet({
      donoTipo,
      donoId,
      authUserId: user.id,
    })

    const pixChave = String(body.pix_chave || wallet.pix_chave || '').trim()
    const pixTipo = String(body.pix_tipo || wallet.pix_tipo || 'aleatoria').trim()
    const titular = String(body.titular_nome || wallet.pix_titular || account?.name || '').trim()

    if (!Number.isFinite(valorCentavos) || valorCentavos < MIN_SAQUE_CENTAVOS) {
      throw new Error('Valor mínimo para saque: R$ 10,00.')
    }
    if (!pixChave || pixChave.length < 5) {
      throw new Error('Cadastre uma chave PIX na carteira antes de sacar.')
    }

    // debita e cria solicitação (saldo sai na hora — fica “em trânsito”)
    const { data: saque, error } = await supabaseAdmin
      .from('sistema_saques')
      .insert({
        carteira_id: wallet.id,
        auth_user_id: user.id,
        valor_centavos: valorCentavos,
        status: 'solicitado',
        pix_chave: pixChave,
        pix_tipo: ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'].includes(pixTipo)
          ? pixTipo
          : 'aleatoria',
        titular_nome: titular || null,
      })
      .select('*')
      .single()
    if (error) throw error

    try {
      await debitWallet({
        carteiraId: wallet.id,
        valorCentavos,
        tipo: 'debito_saque',
        descricao: 'Saque solicitado',
        referenciaTipo: 'saque',
        referenciaId: saque.id,
        criadoPor: user.id,
      })
    } catch (debitErr) {
      await supabaseAdmin.from('sistema_saques').delete().eq('id', saque.id)
      throw debitErr
    }

    return NextResponse.json({ saque })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao solicitar saque.' }, { status: 400 })
  }
}
