import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fallbackLineups, lineupDateLabel, LineupSummary, lineupSubtitle } from '@/lib/lineups'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function LineupScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [lineups, setLineups] = useState<LineupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<Record<string, string>>({})
  const accessToken = auth.session?.access_token

  useEffect(() => {
    let mounted = true
    mobileApi.lineups(accessToken)
      .then((response) => {
        if (!mounted) return
        setLineups((response.escalacoes as LineupSummary[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setLineups(fallbackLineups)
        setError(err?.message || 'Não foi possível carregar as escalações.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [accessToken])

  async function generateInvite(lineup: LineupSummary) {
    const participationId = String(lineup.campeonato_equipe_id || '')
    if (!participationId || participationId.startsWith('demo')) {
      setCreatedToken((current) => ({ ...current, [participationId || 'demo']: 'exemplo-token' }))
      return
    }
    const created = await mobileApi.createLineupInvite(participationId, accessToken)
    setCreatedToken((current) => ({ ...current, [participationId]: created.token }))
  }

  return (
    <ScreenShell
      eyebrow="Escalação"
      title="Escalar jogadores"
      description="Completar elenco, gerar convite e acompanhar prazo por jogo sem precisar procurar a tela certa no site."
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Carregando escalações da sua equipe...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>Mostrando exemplo porque a API não respondeu: {error}</Text> : null}

      {!loading && lineups.length === 0 ? (
        <ActionCard
          title="Nenhuma line inscrita ainda"
          description="Primeiro entre em um campeonato com vaga. Depois a escalação aparece aqui automaticamente."
          cta="Buscar campeonatos com vagas"
          onPress={() => onNavigate('vacancies')}
        />
      ) : null}

      {lineups.map((lineup) => {
        const id = String(lineup.campeonato_equipe_id || lineup.campeonato_nome || Math.random())
        const limit = Number(lineup.limite_jogadores || 6)
        const confirmed = Number(lineup.jogadores_confirmados || lineup.jogadores?.length || 0)
        const free = Math.max(0, Number(lineup.vagas_disponiveis ?? limit - confirmed))
        const token = createdToken[id] || lineup.link_token || null
        return (
          <View key={id} style={styles.lineupCard}>
            <Text style={styles.title}>{lineup.campeonato_nome || 'Campeonato'}</Text>
            <Text style={styles.subtitle}>{lineupSubtitle(lineup)}</Text>
            <View style={styles.metrics}>
              <MetricPill label="jogadores" value={`${confirmed}/${limit}`} />
              <MetricPill label="vagas livres" value={free} />
              <MetricPill label="jogo" value={lineupDateLabel(lineup)} />
            </View>
            {token ? (
              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>Token ativo</Text>
                <Text style={styles.tokenText}>{token}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.primary} onPress={() => generateInvite(lineup)}>
              <Text style={styles.primaryText}>{token ? 'Renovar convite' : 'Gerar convite de escalação'}</Text>
            </TouchableOpacity>
          </View>
        )
      })}

      <ActionCard
        title="Regras protegidas"
        description="O backend segue validando prazo por jogo, limite de jogadores, troca bloqueada e jogador inscrito em outra equipe."
        tone="dark"
      />
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
  lineupCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
    padding: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tokenBox: {
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tokenLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tokenText: {
    color: colors.ink,
    fontWeight: '900',
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
})
