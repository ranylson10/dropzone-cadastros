import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { fallbackRank, kdLabel, RankedPlayer, RankedTeam } from '@/lib/rank'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function RankScreen({ onBack, onNavigate }: ScreenProps) {
  const [teams, setTeams] = useState<RankedTeam[]>([])
  const [players, setPlayers] = useState<RankedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.rank()
      .then((response) => {
        if (!mounted) return
        setTeams((response.teams as RankedTeam[]) || [])
        setPlayers((response.players as RankedPlayer[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setTeams(fallbackRank.teams)
        setPlayers(fallbackRank.players)
        setError(err?.message || 'Não foi possível carregar o ranking.')
      })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  return (
    <ScreenShell
      eyebrow="Rank"
      title="Ranking competitivo"
      description="Ranking global calculado a partir dos campeonatos ativos e aprovados no DropZone."
      onBack={onBack}
    >
      <View style={styles.metrics}>
        <MetricPill label="equipes" value={teams.length} />
        <MetricPill label="jogadores" value={players.length} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Carregando ranking...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Top equipes</Text>
      {teams.slice(0, 10).map((team) => (
        <ActionCard
          key={String(team.key || team.nome)}
          title={`#${team.rank || '-'} · ${team.nome || 'Equipe'}`}
          description={`${Number(team.pontos || 0)} pts · ${Number(team.abates || 0)} abates · ${Number(team.booyahs || 0)} booyahs · KD ${kdLabel(team.abates, team.quedas)}`}
          cta="Ver campeonatos"
          onPress={() => onNavigate('my_championships')}
        />
      ))}

      <Text style={styles.sectionTitle}>Top jogadores</Text>
      {players.slice(0, 10).map((player) => (
        <ActionCard
          key={String(player.key || player.nick)}
          title={`#${player.rank || '-'} · ${player.nick || 'Jogador'}`}
          description={`${Number(player.abates || 0)} abates · ${Number(player.dano || 0)} dano · ${Number(player.assistencias || 0)} assist. · KD ${kdLabel(player.abates, player.quedas)}`}
          cta="Ver agenda"
          onPress={() => onNavigate('agenda')}
        />
      ))}

      {!loading && !teams.length && !players.length ? (
        <ActionCard
          title="Ranking ainda vazio"
          description="Assim que houver pontuação salva nos campeonatos públicos, equipes e jogadores aparecem aqui."
          cta="Ver campeonatos"
          onPress={() => onNavigate('my_championships')}
          tone="warning"
        />
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
})
