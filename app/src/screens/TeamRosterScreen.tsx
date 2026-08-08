import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fallbackLineups, lineupSubtitle, LineupSummary } from '@/lib/lineups'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function TeamRosterScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [lineups, setLineups] = useState<LineupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.lineups(auth.session?.access_token)
      .then((response) => {
        if (!mounted) return
        setLineups((response.escalacoes as LineupSummary[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setLineups(fallbackLineups)
        setError(err?.message || 'Não foi possível carregar equipe e lines.')
      })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [auth.session?.access_token])

  const totalPlayers = lineups.reduce((sum, item) => sum + Number(item.jogadores_confirmados || item.jogadores?.length || 0), 0)
  const totalSlots = lineups.reduce((sum, item) => sum + Number(item.limite_jogadores || 6), 0)

  return (
    <ScreenShell
      eyebrow="Equipe"
      title="Equipe e lines"
      description="Resumo prático das lines inscritas, jogadores confirmados e atalhos para escalação."
      onBack={onBack}
    >
      <View style={styles.metrics}>
        <MetricPill label="lines" value={lineups.length} />
        <MetricPill label="jogadores" value={`${totalPlayers}/${totalSlots || 0}`} />
      </View>

      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? <Text style={styles.warning}>Mostrando exemplo porque a API não respondeu: {error}</Text> : null}

      {lineups.map((lineup) => (
        <ActionCard
          key={String(lineup.campeonato_equipe_id || lineup.campeonato_nome)}
          title={lineup.line_nome || lineup.equipe_nome || 'Line da equipe'}
          description={`${lineup.campeonato_nome || 'Campeonato'} · ${lineupSubtitle(lineup)} · ${Number(lineup.jogadores_confirmados || 0)}/${Number(lineup.limite_jogadores || 6)} jogadores`}
          cta="Escalar elenco"
          tone={Number(lineup.jogadores_confirmados || 0) < Number(lineup.limite_jogadores || 6) ? 'warning' : 'success'}
          onPress={() => onNavigate('lineup')}
        />
      ))}

      {!loading && lineups.length === 0 ? (
        <ActionCard
          title="Nenhuma line ativa"
          description="Quando a equipe entrar em um campeonato, as lines aparecem aqui para organizar elenco e escalação."
          cta="Buscar vagas"
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

