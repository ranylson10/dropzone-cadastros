import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fallbackLineups, lineupDateLabel, LineupSummary, lineupSubtitle } from '@/lib/lineups'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function MyChampionshipsScreen({ onBack, onNavigate, profileType }: ScreenProps) {
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
        setError(err?.message || 'Não foi possível carregar seus campeonatos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [auth.session?.access_token])

  const grouped = useMemo(() => {
    const map = new Map<string, LineupSummary[]>()
    for (const lineup of lineups) {
      const key = String(lineup.campeonato_nome || 'Campeonato')
      map.set(key, [...(map.get(key) || []), lineup])
    }
    return Array.from(map.entries())
  }, [lineups])

  return (
    <ScreenShell
      eyebrow="Minha jornada"
      title="Meus campeonatos"
      description="Campeonatos onde seu perfil tem ação: ver agenda, consultar line, gerar escalação e abrir detalhes quando precisar."
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Buscando campeonatos do perfil {profileType}...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>Mostrando exemplo porque a API não respondeu: {error}</Text> : null}

      {!loading && grouped.length === 0 ? (
        <ActionCard
          title="Você ainda não tem campeonatos aqui"
          description="Entre em um campeonato com vaga aberta ou aceite um convite para começar."
          cta="Ver vagas abertas"
          onPress={() => onNavigate('vacancies')}
        />
      ) : null}

      {grouped.map(([championshipName, items]) => {
        const first = items[0]
        const confirmed = items.reduce((sum, item) => sum + Number(item.jogadores_confirmados || item.jogadores?.length || 0), 0)
        const limit = items.reduce((sum, item) => sum + Number(item.limite_jogadores || 6), 0)
        return (
          <ActionCard
            key={championshipName}
            title={championshipName}
            description={`${items.length} line${items.length === 1 ? '' : 's'} · ${lineupSubtitle(first)} · ${confirmed}/${limit} jogadores · ${lineupDateLabel(first)}`}
            cta="Ações do campeonato"
            tone={confirmed < limit ? 'warning' : 'success'}
            onPress={() => onNavigate('lineup')}
          />
        )
      })}

      <ActionCard
        title="Gestão avançada fica no site"
        description="Fases, grupos, pontuação e transmissão continuam no painel completo. O app fica focado nas ações rápidas."
        cta="Abrir quando necessário"
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
})
