import { useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { kdLabel } from '@/lib/rank'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type TabId = 'info' | 'teams' | 'players' | 'agenda' | 'table'

export function ChampionshipPublicScreen({ selectedChampionship, onNavigate, requireAuth }: ScreenProps) {
  const championship = selectedChampionship
  const [tab, setTab] = useState<TabId>('info')
  const [structure, setStructure] = useState<any>(null)
  const [teamsPayload, setTeamsPayload] = useState<any>(null)
  const [playersPayload, setPlayersPayload] = useState<any>(null)
  const [teamStats, setTeamStats] = useState<any[]>([])
  const [mvpStats, setMvpStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!championship?.id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      mobileApi.championshipStructure(championship.id),
      mobileApi.championshipTeams(championship.id),
      mobileApi.championshipPlayers(championship.id),
      mobileApi.championshipTeamStats(championship.id),
      mobileApi.championshipMvpStats(championship.id),
    ])
      .then(([structureResult, teamsResult, playersResult, teamStatsResult, mvpResult]) => {
        if (!mounted) return
        setStructure(structureResult)
        setTeamsPayload(teamsResult)
        setPlayersPayload(playersResult)
        setTeamStats(teamStatsResult?.equipes || [])
        setMvpStats(mvpResult?.jogadores || [])
        setError('')
      })
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar o campeonato.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [championship?.id])

  const publicTeams = useMemo(() => {
    const rows = Array.isArray(teamsPayload?.vagas) ? teamsPayload.vagas : []
    return rows.filter((row:any) => row?.campeonato_equipe || row?.equipe_id || row?.line_id)
  }, [teamsPayload])

  const publicPlayers = useMemo(() => {
    const participations = Array.isArray(playersPayload?.participacoes) ? playersPayload.participacoes : []
    return participations.flatMap((participation:any) =>
      (participation.jogadores || []).map((player:any) => ({
        ...player,
        equipe_nome: participation.nome_exibicao || participation.line?.nome || participation.equipe?.nome || 'Equipe',
      })),
    )
  }, [playersPayload])

  if (!championship) {
    return <View style={styles.center}><Text style={styles.empty}>Campeonato não selecionado.</Text></View>
  }

  const heroImage = championship.bannerUrl
    ? { uri: externalUrl(championship.bannerUrl) }
    : require('../../assets/directory-campeonatos.png')

  function buySlot() {
    requireAuth?.(() => onNavigate('purchase_claim'))
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero
        image={heroImage}
        eyebrow={championship.mode}
        title={championship.name}
        description={championship.nextMatchLabel || 'Informações públicas do campeonato'}
        actionLabel={championship.freeSlots > 0 ? 'Garantir vaga' : undefined}
        actionIcon="ticket-outline"
        onAction={championship.freeSlots > 0 ? buySlot : undefined}
        compact
      />

      <View style={styles.tabs}>
        {([
          ['info', 'Info'],
          ['teams', 'Equipes'],
          ['players', 'Jogadores'],
          ['agenda', 'Agenda'],
          ['table', 'Tabela'],
        ] as Array<[TabId, string]>).map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando...</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && tab === 'info' ? (
        <View style={styles.infoGrid}>
          <Info label="Tipo" value={championship.mode} />
          <Info label="Vagas" value={String(championship.freeSlots || 0)} />
          <Info label="Inscrição" value={championship.priceLabel} />
          <Info label="Premiação" value={championship.prizeLabel || '—'} />
          <Info label="Fases" value={String(structure?.resumo?.fases || 0)} />
          <Info label="Jogos" value={String(structure?.resumo?.jogos || 0)} />
        </View>
      ) : null}

      {!loading && tab === 'teams' ? (
        <View style={styles.list}>
          {publicTeams.map((row:any, index:number) => {
            const display = row.campeonato_equipe || {}
            const logo = externalUrl(display.line_logo_url || row.line_logo_url || display.equipe_logo_url || '')
            return (
              <View key={String(row.id || row.slot_id || index)} style={styles.row}>
                {logo ? <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" /> : <View style={[styles.logo, styles.logoFallback]}><Ionicons name="shield-outline" size={18} color={colors.brand} /></View>}
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>{display.nome_exibicao || display.line_nome || row.line_nome || row.equipe_nome || 'Equipe'}</Text>
                  <Text style={styles.meta}>Slot {Number(row.slot_numero || row.numero_vaga || index + 1)}</Text>
                </View>
              </View>
            )
          })}
          {!publicTeams.length ? <Text style={styles.empty}>Nenhuma equipe publicada ainda.</Text> : null}
        </View>
      ) : null}

      {!loading && tab === 'players' ? (
        <View style={styles.list}>
          {publicPlayers.map((player:any, index:number) => (
            <View key={String(player.id || player.id_jogo || index)} style={styles.row}>
              <View style={[styles.logo, styles.logoFallback]}><Ionicons name="person-outline" size={18} color={colors.brand} /></View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>{player.nick || 'Jogador'}</Text>
                <Text style={styles.meta} numberOfLines={1}>{player.equipe_nome}{player.id_jogo ? ` · ID ${player.id_jogo}` : ''}</Text>
              </View>
            </View>
          ))}
          {!publicPlayers.length ? <Text style={styles.empty}>Nenhum jogador publicado ainda.</Text> : null}
        </View>
      ) : null}

      {!loading && tab === 'agenda' ? (
        <View style={styles.list}>
          {(structure?.jogos || []).map((game:any, index:number) => (
            <View key={String(game.id || index)} style={styles.row}>
              <View style={[styles.logo, styles.logoFallback]}><Ionicons name="calendar-outline" size={18} color={colors.brand} /></View>
              <View style={styles.copy}>
                <Text style={styles.name}>{game.nome || `Jogo ${index + 1}`}</Text>
                <Text style={styles.meta}>{[game.data_jogo, game.horario, game.numero_partidas ? `${game.numero_partidas} partidas` : '', Array.isArray(game.mapas) ? game.mapas.join(', ') : ''].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ))}
          {!(structure?.jogos || []).length ? <Text style={styles.empty}>Nenhum jogo agendado ainda.</Text> : null}
        </View>
      ) : null}

      {!loading && tab === 'table' ? (
        <View style={styles.tableBlock}>
          <Text style={styles.sectionTitle}>CLASSIFICAÇÃO</Text>
          <View style={styles.list}>
            {teamStats.map((team:any, index:number) => (
              <View key={String(team.campeonato_equipe_id || index)} style={styles.row}>
                <Text style={styles.position}>{team.colocacao || index + 1}</Text>
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>{team.nome || 'Equipe'}</Text>
                  <Text style={styles.meta}>{Number(team.quedas || 0)} partidas · {Number(team.booyahs || 0)} booyahs · {Number(team.abates || 0)} kills</Text>
                </View>
                <Text style={styles.points}>{Number(team.pontos_total || 0)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, styles.mvpTitle]}>MVP</Text>
          <View style={styles.list}>
            {mvpStats.slice(0, 20).map((player:any, index:number) => (
              <View key={String(player.campeonato_jogador_id || index)} style={styles.row}>
                <Text style={styles.position}>{player.colocacao || index + 1}</Text>
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>{player.nick || 'Jogador'}</Text>
                  <Text style={styles.meta}>{Number(player.quedas || 0)} partidas · K.D {kdLabel(player.abates, player.quedas)}</Text>
                </View>
                <View style={styles.killMetric}>
                  <Text style={styles.killValue}>{Number(player.abates || 0)}</Text>
                  <Text style={styles.killLabel}>KILLS</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  tabs: { margin: spacing.md, marginBottom: 8, flexDirection: 'row', backgroundColor: '#cfc8be', gap: 1 },
  tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7e1d8' },
  tabActive: { backgroundColor: colors.brandDark },
  tabText: { color: colors.ink, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  tabTextActive: { color: colors.surface },
  loading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  error: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: '800' },
  infoGrid: { marginHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: '#cfc8be' },
  info: { width: '49.8%', minHeight: 62, padding: 10, backgroundColor: '#e8e2d8' },
  infoLabel: { color: colors.brand, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { marginTop: 4, color: colors.ink, fontSize: 12, fontWeight: '900' },
  list: { marginHorizontal: spacing.md, gap: 1, backgroundColor: '#cfc8be' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  logo: { width: 40, height: 40, backgroundColor: '#f7f3ec' },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 11.5, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: '#706b64', fontSize: 8.5, fontWeight: '700' },
  empty: { padding: 16, color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800', backgroundColor: '#e7e1d8' },
  tableBlock: { gap: 8 },
  sectionTitle: { marginHorizontal: spacing.md, color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  mvpTitle: { marginTop: 8 },
  position: { width: 25, color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  points: { minWidth: 42, color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right' },
  killMetric: { minWidth: 48, alignItems: 'flex-end', paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.brand },
  killValue: { color: colors.brand, fontSize: 18, fontWeight: '900' },
  killLabel: { color: colors.brand, fontSize: 7, fontWeight: '900' },
})
