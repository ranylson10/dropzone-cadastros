import { useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { apiUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PaymentMethod, paymentMethodLabel, VacancyPaymentResult } from '@/lib/payments'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function PurchaseClaimScreen({ onBack, onNavigate, selectedChampionship, profileType }: ScreenProps) {
  const auth = useAuth()
  const championship = selectedChampionship
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<VacancyPaymentResult | null>(null)
  const checkoutUrl = payment?.payment?.paypal_approval_url || payment?.payment?.invoice_url || ''
  const claimUrl = payment?.claim_url ? apiUrl(payment.claim_url) : ''

  async function startPayment() {
    if (!championship) return
    setLoading(true)
    setError(null)
    try {
      const response = await mobileApi.createVacancyPayment({
        campeonato_id: championship.id,
        method,
      }, auth.session?.access_token)
      setPayment(response)
      const url = response.payment?.paypal_approval_url || response.payment?.invoice_url
      if (url) await Linking.openURL(url)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o pagamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenShell
      eyebrow="Garantir vaga"
      title={championship?.name || 'Escolha um campeonato'}
      description="Fluxo guiado: pagar vaga, confirmar equipe, escolher grupo/slot e liberar inscrição sem o usuário se perder no site."
      onBack={onBack}
    >
      {championship ? (
        <View style={styles.summary}>
          <Text style={styles.mode}>{championship.mode}</Text>
          <View style={styles.metrics}>
            <MetricPill label="inscrição" value={championship.priceLabel} />
            <MetricPill label="premiação" value={championship.prizeLabel || '-'} />
            <MetricPill label="vagas" value={String(championship.freeSlots)} />
          </View>
          <Text style={styles.when}>{championship.nextMatchLabel || 'Data a confirmar'}</Text>
        </View>
      ) : (
        <ActionCard
          title="Nenhum campeonato selecionado"
          description="Volte para a vitrine e escolha uma vaga antes de iniciar a compra."
          cta="Ver vagas"
          onPress={() => onNavigate('vacancies')}
        />
      )}

      {championship ? (
        <>
          <View style={styles.methodBox}>
            <Text style={styles.methodTitle}>Como quer pagar?</Text>
            <View style={styles.methodRow}>
              {(['pix', 'cartao', 'paypal'] as PaymentMethod[]).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.methodButton, method === item && styles.methodButtonActive]}
                  onPress={() => setMethod(item)}
                >
                  <Text style={[styles.methodText, method === item && styles.methodTextActive]}>{paymentMethodLabel[item]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error ? <Text style={styles.warning}>{error}</Text> : null}

          {payment ? (
            <View style={styles.paymentBox}>
              <Text style={styles.paymentEyebrow}>Pagamento criado</Text>
              <Text style={styles.paymentTitle}>Token {payment.compra.token}</Text>
              <Text style={styles.paymentLine}>Status: {payment.compra.status}</Text>
              <Text style={styles.paymentLine}>Método: {payment.payment?.metodo || method}</Text>
              {payment.payment?.pix_payload ? <Text style={styles.paymentCode}>{payment.payment.pix_payload}</Text> : null}
              {payment.payment?.invoice_url || payment.payment?.paypal_approval_url ? (
                <Text style={styles.paymentLine}>Checkout: {payment.payment.paypal_approval_url || payment.payment.invoice_url}</Text>
              ) : null}
              <Text style={styles.paymentLine}>Depois de confirmar, a inscrição continua em {payment.claim_url}</Text>
            </View>
          ) : null}

          <View style={styles.steps}>
            <Step index="1" title="Pagamento seguro" description="O app cria a cobrança oficial e só libera inscrição quando o pagamento confirmar." active />
            <Step index="2" title={profileType === 'equipe' ? 'Confirmar equipe' : 'Criar ou vincular equipe'} description="Se a conta ainda não tiver perfil/equipe válida, o app guia o cadastro antes da inscrição." />
            <Step index="3" title="Escolher grupo e slot" description="Só mostra grupos com vaga livre real e respeita reservas/pagamentos pendentes." />
            <Step index="4" title="Escalar elenco" description="Depois da vaga, leva direto para line, jogadores e prazo de escalação por jogo." />
          </View>

          <TouchableOpacity style={styles.primary} disabled={loading} onPress={startPayment}>
            {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>{payment ? 'Atualizar pagamento' : 'Continuar compra'}</Text>}
          </TouchableOpacity>
          {payment ? (
            <TouchableOpacity style={styles.secondary} onPress={() => checkoutUrl ? Linking.openURL(checkoutUrl) : undefined} disabled={!checkoutUrl}>
              <Text style={styles.secondaryText}>{checkoutUrl ? 'Abrir checkout novamente' : 'Aguardando checkout do provedor'}</Text>
            </TouchableOpacity>
          ) : null}
          {payment ? (
            <TouchableOpacity style={styles.secondary} onPress={() => claimUrl ? Linking.openURL(claimUrl) : undefined} disabled={!claimUrl}>
              <Text style={styles.secondaryText}>Abrir inscrição da vaga</Text>
            </TouchableOpacity>
          ) : null}
          {payment ? (
            <TouchableOpacity style={styles.secondary} onPress={() => onNavigate('wallet')}>
              <Text style={styles.secondaryText}>Ver carteira e comprovantes</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.secondary} onPress={() => onNavigate('lineup')}>
            <Text style={styles.secondaryText}>Já tenho vaga, ir para escalação</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <ActionCard
        title="Por que essa tela existe?"
        description="Ela evita o problema antigo: o usuário pagava, logava, voltava e o sistema esquecia o campeonato. Aqui o app segura o contexto da vaga até terminar o fluxo."
        cta="Entendido"
      />
    </ScreenShell>
  )
}

function Step(props: { index: string; title: string; description: string; active?: boolean }) {
  return (
    <View style={[styles.step, props.active && styles.stepActive]}>
      <Text style={[styles.stepIndex, props.active && styles.stepIndexActive]}>{props.index}</Text>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{props.title}</Text>
        <Text style={styles.stepDescription}>{props.description}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    padding: spacing.lg,
    gap: spacing.md,
  },
  mode: {
    color: colors.gold,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  when: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  methodBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.md,
  },
  methodTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  methodButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  methodText: {
    color: colors.ink,
    fontWeight: '900',
  },
  methodTextActive: {
    color: colors.surface,
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
  paymentBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  paymentEyebrow: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  paymentTitle: {
    color: colors.surface,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  paymentLine: {
    color: '#d6dae2',
    fontWeight: '700',
  },
  paymentCode: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '800',
    padding: spacing.md,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  stepActive: {
    borderColor: colors.brand,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    color: colors.ink,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '900',
  },
  stepIndexActive: {
    backgroundColor: colors.brand,
    color: colors.surface,
  },
  stepText: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  stepDescription: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    padding: spacing.md,
  },
  primaryText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  secondary: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '900',
  },
})
