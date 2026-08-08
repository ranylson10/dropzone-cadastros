import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cents } from '@/lib/wallet'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type ProducerSeller = { id?: string; status?: string; vendas?: number; nome_publico?: string; manager?: { nome?: string } }
type Wallet = { saldo_disponivel_centavos?: number; saldo_bloqueado_centavos?: number }

export function ProducerOverviewScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [sellers, setSellers] = useState<ProducerSeller[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([
      mobileApi.producerSellers(auth.session?.access_token),
      mobileApi.wallet(auth.session?.access_token),
    ]).then((results) => {
      if (!mounted) return
      const sellerResult = results[0]
      const walletResult = results[1]
      if (sellerResult.status === 'fulfilled') setSellers((sellerResult.value.vendedores as ProducerSeller[]) || [])
      if (walletResult.status === 'fulfilled') setWallet((walletResult.value.carteira as Wallet) || null)
      const rejected = results.find((item) => item.status === 'rejected') as PromiseRejectedResult | undefined
      setError(rejected?.reason?.message || null)
    }).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [auth.session?.access_token])

  const activeSellers = useMemo(() => sellers.filter((seller) => String(seller.status || 'ativo') === 'ativo').length, [sellers])

  return (
    <ScreenShell
      eyebrow="Produtora"
      title="Painel rápido"
      description="Resumo móvel para olhar vendas, vendedores, carteira e abrir as partes pesadas no site quando precisar."
      onBack={onBack}
    >
      <View style={styles.metrics}>
        <MetricPill label="vendedores" value={sellers.length} />
        <MetricPill label="ativos" value={activeSellers} />
        <MetricPill label="saldo" value={cents(wallet?.saldo_disponivel_centavos)} />
      </View>
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      <ActionCard title="Carteira da produtora" description={`Disponível ${cents(wallet?.saldo_disponivel_centavos)} · bloqueado ${cents(wallet?.saldo_bloqueado_centavos)}`} cta="Abrir carteira" onPress={() => onNavigate('wallet')} />
      <ActionCard title="Equipe comercial" description={`${sellers.length} vendedor(es) cadastrados. Convites e comissão seguem controlados pelo backend.`} cta="Ver convites" onPress={() => onNavigate('invites')} />
      <ActionCard title="Campeonatos e estrutura" description="Criação, fases, grupos, jogos e pontuação continuam no painel completo para evitar tela poluída no app." cta="Ver campeonatos" onPress={() => onNavigate('my_championships')} tone="dark" />
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

