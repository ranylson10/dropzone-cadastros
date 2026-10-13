import { getAccountsForUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from '@backend/lili/types'
import { AuthUser, liliMoney } from './common'

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
