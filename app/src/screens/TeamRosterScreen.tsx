import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { lineupSubtitle, LineupSummary } from '@/lib/lineups'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, spacing, typography } from '@/theme/tokens'
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
        setLineups([])
        setError(err?.message || 'Não foi possível carregar equipe e lines.')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [auth.session?.access_token])

  const totalPlayers = lineups.reduce((sum, item) => sum + Number(item.jogadores_confirmados || item.jogadores?.length || 0), 0)
  const totalSlots = lineups.reduce((sum, item) => sum + Number(item.limite_jogadores || 6), 0)

  return (
    <ScreenShell eyebrow="Equipe" title="Equipes" onBack={onBack}>
      <View style={styles.areaActions}>
        <TouchableOpacity style={[styles.areaButton, styles.areaButtonActive]}>
          <Text style={[styles.areaButtonText, styles.areaButtonTextActive]}>Lines</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.areaButton} onPress={() => onNavigate('lineup')}>
          <Text style={styles.areaButtonText}>Escalar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.areaButton} onPress={() => onNavigate('invites')}>
          <Text style={styles.areaButtonText}>Convites</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroItem}><Text style={styles.heroValue}>{lineups.length}</Text><Text style={styles.heroLabel}>lines</Text></View>
        <View style={styles.heroItem}><Text style={styles.heroValue}>{totalPlayers}/{totalSlots || 0}</Text><Text style={styles.heroLabel}>jogadores</Text></View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.muted}>Carregando equipe...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {lineups.map((lineup) => {
        const confirmed = Number(lineup.jogadores_confirmados || lineup.jogadores?.length || 0)
        const limit = Number(lineup.limite_jogadores || 6)
        return (
          <TouchableOpacity key={String(lineup.campeonato_equipe_id || lineup.campeonato_nome)} style={styles.lineCard} onPress={() => onNavigate('lineup')}>
            <View style={styles.lineBadge}><Text style={styles.lineBadgeValue}>{confirmed}</Text><Text style={styles.lineBadgeLabel}>/{limit}</Text></View>
            <View style={styles.lineText}>
              <Text style={styles.lineTitle} numberOfLines={1}>{lineup.line_nome || lineup.equipe_nome || 'Line da equipe'}</Text>
              <Text style={styles.lineMeta} numberOfLines={1}>{lineup.campeonato_nome || 'Campeonato'} · {lineupSubtitle(lineup)}</Text>
              <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(5, Math.min(100, (confirmed / Math.max(1, limit)) * 100))}%` }]} /></View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )
      })}

      {!loading && lineups.length === 0 ? (
        <ActionCard title="Nenhuma line ativa" description="Entre em um campeonato para organizar lines, elenco e escalação." cta="Buscar vagas" onPress={() => onNavigate('vacancies')} />
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  areaActions: { flexDirection: 'row', gap: spacing.sm },
  areaButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  areaButtonActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  areaButtonText: { color: colors.ink, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
  areaButtonTextActive: { color: colors.surface },
  hero: { flexDirection: 'row', backgroundColor: colors.brandDark, borderBottomWidth: 3, borderBottomColor: colors.brand },
  heroItem: { flex: 1, padding: spacing.md },
  heroValue: { color: colors.surface, fontSize: 28, fontWeight: '900' },
  heroLabel: { color: '#aeb6c0', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  loading: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: spacing.sm, padding: spacing.lg },
  muted: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  warning: { backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: '800', padding: spacing.md },
  lineCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 3, borderTopColor: colors.brand, padding: spacing.sm },
  lineBadge: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandDark },
  lineBadgeValue: { color: colors.surface, fontSize: 19, fontWeight: '900' },
  lineBadgeLabel: { color: '#cbd5e1', fontSize: 9, fontWeight: '900' },
  lineText: { flex: 1, gap: 4 },
  lineTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900', textTransform: 'uppercase' },
  lineMeta: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  progress: { height: 5, overflow: 'hidden', backgroundColor: '#ece7df' },
  progressFill: { height: '100%', backgroundColor: colors.brand },
  chevron: { color: colors.brand, fontSize: 26, fontWeight: '900' },
})
