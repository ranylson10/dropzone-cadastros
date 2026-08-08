import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cents, compactDate, fallbackWallet, movementStatus, movementTitle, WalletMovement, WalletReceipt, WalletSummary } from '@/lib/wallet'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type ReceiptTarget = {
  id: string
  tipo: 'pagamento' | 'saque' | 'lancamento'
}

export function WalletScreen({ onBack }: ScreenProps) {
  const auth = useAuth()
  const accessToken = auth.session?.access_token
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
    mobileApi.wallet(accessToken)
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
        setWallet(fallbackWallet.carteira)
        setMovements(fallbackWallet.lancamentos)
        setPayments(fallbackWallet.pagamentos)
        setWithdrawals([])
        setError(err?.message || 'Não foi possível carregar a carteira.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [accessToken])

  const recentItems = useMemo(() => {
    const typedPayments = payments.map((item) => ({ ...item, receiptTipo: 'pagamento' as const }))
    const typedMovements = movements.map((item) => ({ ...item, receiptTipo: 'lancamento' as const }))
    const typedWithdrawals = withdrawals.map((item) => ({ ...item, receiptTipo: 'saque' as const }))
    return [...typedPayments, ...typedMovements, ...typedWithdrawals].slice(0, 8)
  }, [movements, payments, withdrawals])

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
    <ScreenShell
      eyebrow="Carteira"
      title="Saldo e comprovantes"
      description="Resumo curto para comprador, vendedor e produtora acompanharem pagamentos, comissões, saques e comprovantes."
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Carregando carteira...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>Mostrando exemplo porque a API não respondeu: {error}</Text> : null}

      <View style={styles.metrics}>
        <MetricPill label="disponível" value={cents(wallet?.saldo_disponivel_centavos)} />
        <MetricPill label="bloqueado" value={cents(wallet?.saldo_bloqueado_centavos)} />
      </View>

      <ActionCard
        title={wallet?.pix_chave ? 'PIX cadastrado' : 'PIX ainda não cadastrado'}
        description={wallet?.pix_chave ? `${wallet.pix_tipo || 'pix'} · ${wallet.pix_chave}` : 'Cadastre sua chave no site para conseguir solicitar saque quando houver saldo.'}
        cta={wallet?.pix_chave ? 'Ver dados' : 'Configurar no site'}
        tone={wallet?.pix_chave ? 'success' : 'warning'}
      />

      {receipt ? (
        <View style={styles.receipt}>
          <View style={styles.receiptHeader}>
            <View>
              <Text style={styles.receiptEyebrow}>Comprovante</Text>
              <Text style={styles.receiptTitle}>{cents(receipt.valor_centavos)}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setReceipt(null)}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.receiptLine}>{receipt.descricao || 'Movimento DropZone'}</Text>
          <Text style={styles.receiptLine}>Status: {String(receipt.status || '-').replaceAll('_', ' ')}</Text>
          <Text style={styles.receiptLine}>Data: {compactDate(receipt.data_movimento)}</Text>
          <Text style={styles.receiptAuth}>{receipt.autenticacao || receipt.id}</Text>
        </View>
      ) : null}

      {receiptLoading ? <Text style={styles.muted}>Abrindo comprovante...</Text> : null}

      {recentItems.length ? (
        recentItems.map((item) => (
          <TouchableOpacity
            key={`${item.receiptTipo}-${item.id}`}
            style={styles.movement}
            onPress={() => item.id && openReceipt({ id: String(item.id), tipo: item.receiptTipo })}
          >
            <View style={styles.movementText}>
              <Text style={styles.movementTitle}>{movementTitle(item)}</Text>
              <Text style={styles.movementMeta}>{compactDate(item.pago_em || item.created_at)} · {movementStatus(item)}</Text>
            </View>
            <Text style={styles.movementValue}>{cents(item.valor_centavos)}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <ActionCard
          title="Sem movimentos ainda"
          description="Pagamentos de vaga, comissões de vendedor, repasses e saques aparecerão aqui."
          cta="Tudo pronto"
        />
      )}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: {
    color: colors.muted,
    fontWeight: '700',
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  receipt: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  receiptEyebrow: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  receiptTitle: {
    color: colors.surface,
    fontSize: typography.title,
    fontWeight: '900',
  },
  closeButton: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeText: {
    color: colors.ink,
    fontWeight: '900',
  },
  receiptLine: {
    color: '#d6dae2',
    fontWeight: '700',
  },
  receiptAuth: {
    color: colors.surface,
    fontWeight: '900',
    letterSpacing: 1,
  },
  movement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
    padding: spacing.md,
  },
  movementText: {
    flex: 1,
    gap: spacing.xs,
  },
  movementTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  movementMeta: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  movementValue: {
    color: colors.ink,
    fontWeight: '900',
  },
})
