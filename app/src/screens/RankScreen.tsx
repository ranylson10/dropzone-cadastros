import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { kdLabel, RankedPlayer, RankedTeam } from '@/lib/rank'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type RankTab = 'teams' | 'players'

export function RankScreen({ onNavigate }: ScreenProps) {
  const [teams, setTeams] = useState<RankedTeam[]>([])
  const [players, setPlayers] = useState<RankedPlayer[]>([])
  const [tab, setTab] = useState<RankTab>('teams')
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
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar o ranking.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero
        image={require('../../assets/directory-rank.png')}
        eyebrow="Cenário competitivo"
        title="Rank"
        description="Desempenho global de equipes e jogadores."
        compact
      />

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'teams' && styles.tabActive]} onPress={() => setTab('teams')}>
          <Ionicons name="shield-outline" size={16} color={tab === 'teams' ? colors.surface : colors.ink} />
          <Text style={[styles.tabText, tab === 'teams' && styles.tabTextActive]}>Equipes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'players' && styles.tabActive]} onPress={() => setTab('players')}>
          <Ionicons name="person-outline" size={16} color={tab === 'players' ? colors.surface : colors.ink} />
          <Text style={[styles.tabText, tab === 'players' && styles.tabTextActive]}>MVP</Text>
        </TouchableOpacity>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando rank...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      <View style={styles.list}>
        {tab === 'teams' ? teams.slice(0, 50).map((team, index) => (
          <TouchableOpacity key={String(team.key || team.nome || index)} style={styles.row} onPress={() => onNavigate('team_directory')}>
            <Text style={styles.position}>{team.rank || index + 1}</Text>
            <View style={styles.rankIcon}><Ionicons name="shield-outline" size={18} color={colors.brand} /></View>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>{team.nome || 'Equipe'}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {Number(team.quedas || 0)} partidas · {Number(team.booyahs || 0)} booyahs · {Number(team.abates || 0)} abates
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{Number(team.pontos || 0)}</Text>
              <Text style={styles.metricLabel}>PTS</Text>
            </View>
          </TouchableOpacity>
        )) : players.slice(0, 50).map((player, index) => (
          <View key={String(player.key || player.nick || index)} style={styles.row}>
            <Text style={styles.position}>{player.rank || index + 1}</Text>
            <View style={styles.rankIcon}><Ionicons name="person-outline" size={18} color={colors.brand} /></View>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>{player.nick || 'Jogador'}</Text>
              <Text style={styles.teamName} numberOfLines={1}>
                {player.equipe_tag ? `${player.equipe_tag} · ` : ''}{player.equipe_nome || 'Equipe não informada'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {Number(player.quedas || 0)} partidas · K.D {kdLabel(player.abates, player.quedas)}
              </Text>
            </View>
            <View style={[styles.metric, styles.killMetric]}>
              <Text style={[styles.metricValue, styles.killValue]}>{Number(player.abates || 0)}</Text>
              <Text style={[styles.metricLabel, styles.killLabel]}>KILLS</Text>
            </View>
          </View>
        ))}
      </View>

      {!loading && !teams.length && !players.length ? <Text style={styles.empty}>Ranking ainda sem dados.</Text> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  tabs: { margin: spacing.md, marginBottom: 8, flexDirection: 'row', backgroundColor: '#cfc8be', gap: 1 },
  tab: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#e7e1d8' },
  tabActive: { backgroundColor: colors.brandDark },
  tabText: { color: colors.ink, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tabTextActive: { color: colors.surface },
  loading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  warning: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: '800' },
  list: { marginHorizontal: spacing.md, backgroundColor: '#cfc8be', gap: 1 },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  position: { width: 24, color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  rankIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f0e8' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  teamName: { marginTop: 2, color: colors.brand, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: '#706b64', fontSize: 8.5, fontWeight: '700' },
  metric: { minWidth: 48, alignItems: 'flex-end' },
  metricValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  metricLabel: { marginTop: 1, color: '#756f68', fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  killMetric: { paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.brand },
  killValue: { color: colors.brand, fontSize: 19 },
  killLabel: { color: colors.brand },
  empty: { margin: spacing.md, padding: 16, backgroundColor: '#e7e1d8', color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800' },
})
