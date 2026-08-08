import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text } from 'react-native'
import { apiUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cents, compactDate } from '@/lib/wallet'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'
import { View } from 'react-native'

type Sale = {
  id?: string
  token?: string
  status?: string
  valor_centavos?: number
  quantidade_vagas?: number
  vagas_restantes?: number
  created_at?: string
  payment_url?: string
  claim_url?: string
  campeonato?: { nome?: string } | null
}

export function SellerSalesScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const managerId = auth.activeAccount?.profile_type === 'manager' ? auth.activeAccount.id : ''
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (!managerId) {
      setSales([])
      setError('Entre com um perfil de vendedor para ver vendas.')
      setLoading(false)
      return
    }
    mobileApi.sellerSales(managerId, auth.session?.access_token)
      .then((response) => {
        if (!mounted) return
        setSales((response.sales as Sale[]) || [])
        setError(null)
      })
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar vendas.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [auth.session?.access_token, managerId])

  const totals = useMemo(() => ({
    count: sales.length,
    paid: sales.filter((sale) => ['pago', 'liberado', 'consumido'].includes(String(sale.status))).length,
    value: sales.reduce((sum, sale) => sum + Number(sale.valor_centavos || 0), 0),
  }), [sales])

  function openSale(sale: Sale) {
    const target = sale.vagas_restantes ? sale.claim_url : sale.payment_url || sale.claim_url
    if (!target) return
    void Linking.openURL(target.startsWith('http') ? target : apiUrl(target))
  }

  return (
    <ScreenShell
      eyebrow="Vendedor"
      title="Vendas de vagas"
      description="Acompanhe pagamentos gerados, vagas compradas e links liberados após confirmação."
      onBack={onBack}
    >
      <View style={styles.metrics}>
        <MetricPill label="vendas" value={totals.count} />
        <MetricPill label="pagas" value={totals.paid} />
        <MetricPill label="volume" value={cents(totals.value)} />
      </View>
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {sales.slice(0, 12).map((sale) => (
        <ActionCard
          key={String(sale.id)}
          title={sale.campeonato?.nome || 'Venda de vaga'}
          description={`${cents(sale.valor_centavos)} · ${Number(sale.quantidade_vagas || 1)} vaga(s) · ${sale.status || 'registrada'} · ${compactDate(sale.created_at)}`}
          cta={sale.vagas_restantes ? 'Link de inscrição liberado' : 'Ver venda'}
          tone={String(sale.status) === 'pago' || String(sale.status) === 'liberado' ? 'success' : 'default'}
          onPress={() => openSale(sale)}
        />
      ))}
      {!loading && !sales.length ? (
        <ActionCard
          title="Nenhuma venda registrada"
          description="Quando você gerar cobrança e o comprador pagar, a venda aparece aqui com controle de vagas restantes."
          cta="Ver campeonatos com vagas"
          onPress={() => onNavigate('vacancies')}
        />
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: spacing.sm },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
})
