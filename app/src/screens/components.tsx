import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme/tokens'

export function ScreenShell(props: {
  title: string
  eyebrow?: string
  description?: string
  onBack?: () => void
  children: ReactNode
}) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {props.onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={props.onBack}>
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>
        ) : null}
        {props.eyebrow ? <Text style={styles.eyebrow}>{props.eyebrow}</Text> : null}
        <Text style={styles.title}>{props.title}</Text>
        {props.description ? <Text style={styles.description}>{props.description}</Text> : null}
      </View>
      {props.children}
    </ScrollView>
  )
}

export function ActionCard(props: {
  title: string
  description: string
  cta?: string
  tone?: 'default' | 'warning' | 'success' | 'dark'
  onPress?: () => void
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        props.tone === 'warning' && styles.cardWarning,
        props.tone === 'success' && styles.cardSuccess,
        props.tone === 'dark' && styles.cardDark,
      ]}
      onPress={props.onPress}
    >
      <Text style={[styles.cardTitle, props.tone === 'dark' && styles.cardTitleLight]}>{props.title}</Text>
      <Text style={[styles.cardDescription, props.tone === 'dark' && styles.cardDescriptionLight]}>
        {props.description}
      </Text>
      {props.cta ? <Text style={styles.cardCta}>{props.cta}</Text> : null}
    </TouchableOpacity>
  )
}

export function MetricPill(props: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.ink,
    fontWeight: '800',
  },
  eyebrow: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardWarning: {
    borderColor: colors.warning,
  },
  cardSuccess: {
    borderColor: colors.success,
    backgroundColor: 'rgba(101, 185, 130, 0.12)',
  },
  cardDark: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  cardTitleLight: {
    color: colors.ink,
  },
  cardDescription: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  cardDescriptionLight: {
    color: colors.muted,
  },
  cardCta: {
    color: colors.brand,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metric: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  metricValue: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})

export const commonStyles = styles
