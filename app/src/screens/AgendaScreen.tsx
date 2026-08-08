import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { agendaDateLabel, agendaDescription, AgendaItem, agendaTitle, fallbackAgenda } from '@/lib/agenda'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function AgendaScreen({ onBack, profileType, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.agenda(auth.session?.access_token)
      .then((response) => {
        if (!mounted) return
        setItems((response.items as AgendaItem[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setItems(fallbackAgenda)
        setError(err?.message || 'Não foi possível carregar a agenda.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [auth.session?.access_token])

  return (
    <ScreenShell
      eyebrow="Agenda"
      title="Próximos jogos"
      description={`Agenda do perfil ativo (${profileType}): jogos, compromissos e atalhos para escalação quando precisar agir.`}
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Carregando sua agenda...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>Mostrando exemplo porque a API não respondeu: {error}</Text> : null}

      {!loading && items.length === 0 ? (
        <ActionCard
          title="Nada agendado por enquanto"
          description="Quando sua equipe entrar em campeonatos ou tiver jogos configurados, eles aparecem aqui."
          cta="Ver campeonatos com vagas"
          onPress={() => onNavigate('vacancies')}
        />
      ) : null}

      {items.slice(0, 20).map((item, index) => (
        <ActionCard
          key={String(item.id || `${agendaTitle(item)}-${index}`)}
          title={`${agendaDateLabel(item)} · ${agendaTitle(item)}`}
          description={agendaDescription(item)}
          cta={String(item.source || '').includes('jogo') ? 'Ver escalação' : 'Ver detalhes'}
          tone={index === 0 ? 'warning' : 'default'}
          onPress={() => onNavigate(String(item.source || '').includes('jogo') ? 'lineup' : 'my_championships')}
        />
      ))}
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
})
