import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function PurchaseClaimScreen({ onBack, onNavigate, selectedChampionship, profileType }: ScreenProps) {
  const championship = selectedChampionship

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
          <View style={styles.steps}>
            <Step index="1" title="Pagamento seguro" description="O app deve abrir o checkout oficial e só liberar inscrição quando o pagamento confirmar." active />
            <Step index="2" title={profileType === 'equipe' ? 'Confirmar equipe' : 'Criar ou vincular equipe'} description="Se a conta ainda não tiver perfil/equipe válida, o app guia o cadastro antes da inscrição." />
            <Step index="3" title="Escolher grupo e slot" description="Só mostra grupos com vaga livre real e respeita reservas/pagamentos pendentes." />
            <Step index="4" title="Escalar elenco" description="Depois da vaga, leva direto para line, jogadores e prazo de escalação por jogo." />
          </View>

          <TouchableOpacity style={styles.primary} onPress={() => onNavigate('wallet')}>
            <Text style={styles.primaryText}>Continuar compra</Text>
          </TouchableOpacity>
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
