import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { getOrCreateWallet, listWalletMovements } from '@backend/billing/wallet'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Carteira do perfil ativo (manager/vendedor ou produtora).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)

    let donoTipo: 'manager' | 'produtora' | 'auth_user' = 'auth_user'
    let donoId: string | null = account?.id || user.id

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

    const [movements, saques] = await Promise.all([
      listWalletMovements(wallet.id, 40),
      supabaseAdmin
        .from('sistema_saques')
        .select('id,valor_centavos,status,pix_chave,created_at,pago_em,rejeicao_motivo')
        .eq('carteira_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({
      carteira: {
        id: wallet.id,
        saldo_disponivel_centavos: wallet.saldo_disponivel_centavos,
        saldo_bloqueado_centavos: wallet.saldo_bloqueado_centavos,
        dono_tipo: wallet.dono_tipo,
      },
      lancamentos: movements,
      saques: saques.data || [],
    })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/42P01|PGRST205|does not exist/i.test(msg)) {
      return NextResponse.json({
        error: 'Rode o SQL: database/migrations/20260719_carteira_asaas.sql',
        needs_migration: true,
      }, { status: 503 })
    }
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
