import { useState } from 'react'
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PaymentMethod, paymentMethodLabel, VacancyPaymentResult } from '@/lib/payments'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function PurchaseClaimScreen({ onBack, onNavigate, selectedChampionship }: ScreenProps) {
  const auth = useAuth()
  const championship = selectedChampionship
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<VacancyPaymentResult | null>(null)
  const checkoutUrl = payment?.payment?.paypal_approval_url || payment?.payment?.invoice_url || ''
  const claimUrl = payment?.claim_url ? externalUrl(payment.claim_url) : ''

  async function startPayment() {
    if (!championship) return
    setLoading(true)
    setError(null)
    try {
      const response = await mobileApi.createVacancyPayment({ campeonato_id: championship.id, method }, auth.session?.access_token)
      setPayment(response)
      const url = response.payment?.paypal_approval_url || response.payment?.invoice_url
      if (url) await Linking.openURL(url)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o pagamento.')
    } finally {
      setLoading(false)
    }
  }

  if (!championship) {
    return (
      <ScreenShell eyebrow="Compra" title="Escolha uma vaga" onBack={onBack}>
        <ActionCard title="Nenhum campeonato selecionado" description="Volte para a vitrine e escolha uma vaga." cta="Ver vagas" onPress={() => onNavigate('vacancies')} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell eyebrow="Garantir vaga" title={championship.name} onBack={onBack}>
      <View style={styles.hero}>
        {championship.bannerUrl ? <Image source={{ uri: championship.bannerUrl }} style={styles.heroImage} /> : null}
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          {championship.logoUrl ? <Image source={{ uri: championship.logoUrl }} style={styles.logo} /> : null}
          <Text style={styles.mode}>{championship.mode}</Text>
          <Text style={styles.name}>{championship.name}</Text>
          <View style={styles.pills}>
            <Pill label="inscrição" value={championship.priceLabel} />
            <Pill label="prêmio" value={championship.prizeLabel || '-'} />
            <Pill label="vagas" value={String(championship.freeSlots)} />
          </View>
        </View>
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.sectionTitle}>Pagamento</Text>
        <View style={styles.methodRow}>
          {(['pix', 'cartao', 'paypal'] as PaymentMethod[]).map((item) => (
            <TouchableOpacity key={item} style={[styles.method, method === item && styles.methodActive]} onPress={() => setMethod(item)}>
              <Text style={[styles.methodText, method === item && styles.methodTextActive]}>{paymentMethodLabel[item]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.warning}>{error}</Text> : null}
        <TouchableOpacity style={styles.primary} disabled={loading} onPress={startPayment}>
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>{payment ? 'Atualizar cobrança' : 'Gerar pagamento'}</Text>}
        </TouchableOpacity>
      </View>

      {payment ? (
        <View style={styles.result}>
          <Text style={styles.resultKicker}>Pagamento criado</Text>
          <Text style={styles.token}>Token {payment.compra.token}</Text>
          <Text style={styles.resultLine}>Status: {payment.compra.status}</Text>
          <Text style={styles.resultLine}>Valor: {(payment.compra.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          {payment.payment?.pix_payload ? <Text style={styles.copyBox} selectable>{payment.payment.pix_payload}</Text> : null}
          <View style={styles.resultActions}>
            {checkoutUrl ? <TouchableOpacity style={styles.secondary} onPress={() => Linking.openURL(checkoutUrl)}><Text style={styles.secondaryText}>Abrir pagamento</Text></TouchableOpacity> : null}
            {claimUrl ? <TouchableOpacity style={styles.secondaryDark} onPress={() => Linking.openURL(claimUrl)}><Text style={styles.secondaryDarkText}>Continuar inscrição</Text></TouchableOpacity> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.steps}>
        <Step number="1" text="Pague pelo método escolhido" active />
        <Step number="2" text="Confirme ou crie a equipe" />
        <Step number="3" text="Escolha grupo, slot e finalize" />
        <Step number="4" text="Escalone o elenco dentro do prazo" />
      </View>
    </ScreenShell>
  )
}

function Pill(props: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue} numberOfLines={1}>{props.value}</Text>
      <Text style={styles.pillLabel}>{props.label}</Text>
    </View>
  )
}

function Step(props: { number: string; text: string; active?: boolean }) {
  return (
    <View style={styles.step}>
      <Text style={[styles.stepNumber, props.active && styles.stepNumberActive]}>{props.number}</Text>
      <Text style={styles.stepText}>{props.text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { minHeight: 230, backgroundColor: colors.brandDark, overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  heroOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,12,18,.58)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: spacing.md, gap: spacing.sm },
  logo: { width: 58, height: 58, backgroundColor: 'rgba(255,255,255,.9)' },
  mode: { color: colors.gold, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  name: { color: colors.surface, fontSize: 28, lineHeight: 31, fontWeight: '900', textTransform: 'uppercase' },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: { flex: 1, backgroundColor: 'rgba(255,255,255,.1)', padding: spacing.sm },
  pillValue: { color: colors.surface, fontSize: typography.caption, fontWeight: '900' },
  pillLabel: { color: '#cbd5e1', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  paymentCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: typography.subtitle, fontWeight: '900', textTransform: 'uppercase' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  method: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background },
  methodActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  methodText: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  methodTextActive: { color: colors.surface },
  warning: { backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: '800', padding: spacing.md },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase' },
  result: { backgroundColor: colors.brandDark, padding: spacing.md, gap: spacing.sm, borderBottomWidth: 3, borderBottomColor: colors.brand },
  resultKicker: { color: colors.gold, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  token: { color: colors.surface, fontSize: typography.subtitle, fontWeight: '900' },
  resultLine: { color: '#d6dae2', fontWeight: '700' },
  copyBox: { backgroundColor: colors.surface, color: colors.ink, fontSize: typography.caption, fontWeight: '800', padding: spacing.md },
  resultActions: { flexDirection: 'row', gap: spacing.sm },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryText: { color: colors.ink, fontWeight: '900', textTransform: 'uppercase', fontSize: typography.caption },
  secondaryDark: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  secondaryDarkText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase', fontSize: typography.caption },
  steps: { gap: 6 },
  step: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.background, color: colors.ink, textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  stepNumberActive: { backgroundColor: colors.brand, color: colors.surface },
  stepText: { flex: 1, color: colors.ink, fontWeight: '800' },
})
