import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cents, compactDate, movementStatus, movementTitle, WalletMovement, WalletReceipt, WalletSummary } from '@/lib/wallet'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type ReceiptTarget = { id: string; tipo: 'pagamento' | 'saque' | 'lancamento' }
type Tab = 'extrato' | 'pagamentos' | 'saques' | 'pix'

export function WalletScreen({ onBack }: ScreenProps) {
  const auth = useAuth()
  const accessToken = auth.session?.access_token
  const [tab, setTab] = useState<Tab>('extrato')
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [payments, setPayments] = useState<WalletMovement[]>([])
  const [movements, setMovements] = useState<WalletMovement[]>([])
  const [withdrawals, setWithdrawals] = useState<WalletMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<WalletReceipt | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    mobileApi.wallet(accessToken, auth.activeProfileType)
      .then((response) => {
        if (!mounted) return
        setWallet((response.carteira as WalletSummary) || null)
        setMovements((response.lancamentos as WalletMovement[]) || [])
        setPayments((response.pagamentos as WalletMovement[]) || [])
        setWithdrawals((response.saques as WalletMovement[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setWallet(null)
        setMovements([])
        setPayments([])
        setWithdrawals([])
        setError(err?.message || 'Não foi possível carregar a carteira.')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [accessToken, auth.activeProfileType])

  const allItems = useMemo(() => {
    const typedPayments = payments.map((item) => ({ ...item, receiptTipo: 'pagamento' as const }))
    const typedMovements = movements.map((item) => ({ ...item, receiptTipo: 'lancamento' as const }))
    const typedWithdrawals = withdrawals.map((item) => ({ ...item, receiptTipo: 'saque' as const }))
    return [...typedPayments, ...typedMovements, ...typedWithdrawals].slice(0, 20)
  }, [movements, payments, withdrawals])

  const visibleItems = tab === 'pagamentos'
    ? payments.map((item) => ({ ...item, receiptTipo: 'pagamento' as const }))
    : tab === 'saques'
      ? withdrawals.map((item) => ({ ...item, receiptTipo: 'saque' as const }))
      : allItems

  async function openReceipt(target: ReceiptTarget) {
    setReceiptLoading(true)
    try {
      const response = await mobileApi.receipt(target.id, target.tipo, accessToken)
      setReceipt(response.comprovante as WalletReceipt)
    } catch (err: any) {
      setReceipt({
        id: target.id,
        tipo: target.tipo,
        status: 'indisponível',
        valor_centavos: 0,
        descricao: err?.message || 'Comprovante indisponível agora.',
        autenticacao: target.id.replaceAll('-', '').slice(0, 24).toUpperCase(),
      })
    } finally {
      setReceiptLoading(false)
    }
  }

  return (
    <ScreenShell eyebrow="Conta digital" title="Carteira" onBack={onBack}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo disponível</Text>
        <Text style={styles.balanceValue}>{cents(wallet?.saldo_disponivel_centavos)}</Text>
        <View style={styles.balanceRow}>
          <View><Text style={styles.smallLabel}>bloqueado</Text><Text style={styles.smallValue}>{cents(wallet?.saldo_bloqueado_centavos)}</Text></View>
          <View><Text style={styles.smallLabel}>PIX</Text><Text style={styles.smallValue} numberOfLines={1}>{wallet?.pix_chave ? 'cadastrado' : 'pendente'}</Text></View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionPrimary}><Text style={styles.actionPrimaryText}>Solicitar saque</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action}><Text style={styles.actionText}>Chave PIX</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action}><Text style={styles.actionText}>Comprovantes</Text></TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['extrato', 'pagamentos', 'saques', 'pix'] as Tab[]).map((item) => (
          <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.muted}>Carregando carteira...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {tab === 'pix' ? (
        <View style={styles.pixCard}>
          <Text style={styles.sectionTitle}>Chave PIX</Text>
          <Text style={styles.pixValue}>{wallet?.pix_chave || 'Nenhuma chave cadastrada'}</Text>
          <Text style={styles.muted}>{wallet?.pix_chave ? `Tipo: ${wallet.pix_tipo || 'pix'}` : 'Cadastre uma chave para liberar solicitações de saque.'}</Text>
        </View>
      ) : null}

      {receipt ? (
        <View style={styles.receipt}>
          <View style={styles.receiptHead}>
            <View><Text style={styles.receiptKicker}>Comprovante</Text><Text style={styles.receiptValue}>{cents(receipt.valor_centavos)}</Text></View>
            <TouchableOpacity onPress={() => setReceipt(null)}><Text style={styles.close}>Fechar</Text></TouchableOpacity>
          </View>
          <Text style={styles.receiptLine}>{receipt.descricao || 'Movimento DropZone'}</Text>
          <Text style={styles.receiptLine}>Status: {String(receipt.status || '-').replaceAll('_', ' ')}</Text>
          <Text style={styles.receiptLine}>Data: {compactDate(receipt.data_movimento)}</Text>
          <Text style={styles.authCode}>{receipt.autenticacao || receipt.id}</Text>
        </View>
      ) : null}

      {receiptLoading ? <Text style={styles.muted}>Abrindo comprovante...</Text> : null}

      {tab !== 'pix' && visibleItems.length ? visibleItems.map((item) => (
        <TouchableOpacity key={`${item.receiptTipo}-${item.id}`} style={styles.movement} onPress={() => item.id && openReceipt({ id: String(item.id), tipo: item.receiptTipo })}>
          <View style={styles.movementText}>
            <Text style={styles.movementTitle} numberOfLines={1}>{movementTitle(item)}</Text>
            <Text style={styles.movementMeta}>{compactDate(item.pago_em || item.created_at)} · {movementStatus(item)}</Text>
          </View>
          <Text style={styles.movementValue}>{cents(item.valor_centavos)}</Text>
        </TouchableOpacity>
      )) : null}

      {tab !== 'pix' && !loading && visibleItems.length === 0 ? (
        <ActionCard title="Sem movimentos" description="Pagamentos, comissões, repasses e saques aparecem aqui." />
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: colors.brandDark, borderBottomWidth: 3, borderBottomColor: colors.brand, padding: spacing.lg, gap: spacing.sm },
  balanceLabel: { color: '#aeb6c0', fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  balanceValue: { color: colors.surface, fontSize: 42, fontWeight: '900' },
  balanceRow: { flexDirection: 'row', gap: spacing.xl },
  smallLabel: { color: '#aeb6c0', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  smallValue: { color: colors.surface, fontSize: typography.body, fontWeight: '900' },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  actionPrimary: { flex: 1.3, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  actionPrimaryText: { color: colors.surface, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
  action: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  actionText: { color: colors.ink, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabActive: { borderBottomWidth: 3, borderBottomColor: colors.brand },
  tabText: { color: colors.muted, fontSize: typography.tiny, fontWeight: '900', textTransform: 'uppercase' },
  tabTextActive: { color: colors.ink },
  loading: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: spacing.sm, padding: spacing.lg },
  muted: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  warning: { backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: '800', padding: spacing.md },
  pixCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: typography.subtitle, fontWeight: '900', textTransform: 'uppercase' },
  pixValue: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  receipt: { backgroundColor: colors.brandDark, borderBottomWidth: 3, borderBottomColor: colors.brand, padding: spacing.md, gap: spacing.sm },
  receiptHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  receiptKicker: { color: colors.gold, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  receiptValue: { color: colors.surface, fontSize: typography.title, fontWeight: '900' },
  close: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase' },
  receiptLine: { color: '#d6dae2', fontWeight: '700' },
  authCode: { color: colors.surface, fontSize: typography.caption, fontWeight: '900', letterSpacing: 1 },
  movement: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  movementText: { flex: 1 },
  movementTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  movementMeta: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', marginTop: 2 },
  movementValue: { color: colors.ink, fontWeight: '900' },
})
