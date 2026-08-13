import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { kdLabel } from '@/lib/rank'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type TabId = 'info' | 'teams' | 'players' | 'agenda' | 'table' | 'rulebook'
type StatisticsView = 'champion' | 'table' | 'mvp'

export function ChampionshipPublicScreen({ selectedChampionship, onNavigate, requireAuth }: ScreenProps) {
  const championship = selectedChampionship
  const [tab, setTab] = useState<TabId>('info')
  const [statisticsView, setStatisticsView] = useState<StatisticsView>('champion')
  const [statisticsGameId, setStatisticsGameId] = useState('')
  const [statisticsFallId, setStatisticsFallId] = useState('')
  const [structure, setStructure] = useState<any>(null)
  const [teamsPayload, setTeamsPayload] = useState<any>(null)
  const [playersPayload, setPlayersPayload] = useState<any>(null)
  const [teamStats, setTeamStats] = useState<any[]>([])
  const [mvpStats, setMvpStats] = useState<any[]>([])
  const [championSummary, setChampionSummary] = useState<any>(null)
  const [rulebook, setRulebook] = useState<any>(null)
  const [rulebookLoading, setRulebookLoading] = useState(false)
  const [rulebookError, setRulebookError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const loadChampionship = useCallback(async (refresh = false) => {
    if (!championship?.id) return
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const [structureResult, teamsResult, playersResult, teamStatsResult, mvpResult, championResult] = await Promise.all([
        mobileApi.championshipStructure(championship.id),
        mobileApi.championshipTeams(championship.id),
        mobileApi.championshipPlayers(championship.id),
        mobileApi.championshipTeamStats(championship.id, { jogoId: statisticsGameId, partidaId: statisticsFallId }),
        mobileApi.championshipMvpStats(championship.id, { jogoId: statisticsGameId, partidaId: statisticsFallId }),
        mobileApi.championshipChampionSummary(championship.id),
      ])
      setStructure(structureResult)
      setTeamsPayload(teamsResult)
      setPlayersPayload(playersResult)
      setTeamStats(teamStatsResult?.equipes || [])
      setMvpStats(mvpResult?.jogadores || [])
      setChampionSummary(championResult)
      if (!championResult?.final_concluida || !championResult?.campeao) setStatisticsView((current) => current === 'champion' ? 'table' : current)
      setLastUpdatedAt(new Date())
      setError('')
    } catch (err:any) {
      setError(err?.message || 'Não foi possível carregar o campeonato.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [championship?.id, statisticsGameId, statisticsFallId])

  useEffect(() => {
    void loadChampionship()
    const timer = setInterval(() => { void loadChampionship(true) }, 30000)
    return () => clearInterval(timer)
  }, [loadChampionship])

  async function loadRulebook() {
    if (!championship?.id || rulebook || rulebookLoading) return
    setRulebookLoading(true)
    setRulebookError('')
    try {
      const result = await mobileApi.publicChampionshipRulebook(championship.id)
      setRulebook(result)
    } catch (err:any) {
      setRulebookError(err?.message || 'O regulamento ainda não foi publicado.')
    } finally {
      setRulebookLoading(false)
    }
  }

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
  const statisticGames = useMemo(() => Array.isArray(structure?.jogos) ? structure.jogos : [], [structure])
  const statisticFalls = useMemo(() => {
    const game = statisticGames.find((item:any) => String(item.id) === statisticsGameId)
    return statisticsGameId && Array.isArray(game?.quedas) ? game.quedas : []
  }, [statisticGames, statisticsGameId])

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
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadChampionship(true)} tintColor={colors.brand} />}
    >
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

      <View style={styles.liveStrip}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>ATUALIZAÇÃO AUTOMÁTICA · 30S</Text>
        <Text style={styles.liveTime}>{lastUpdatedAt ? `Atualizado ${lastUpdatedAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Sincronizando'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {([
          ['info', 'Info'],
          ['teams', 'Equipes'],
          ['players', 'Jogadores'],
          ['agenda', 'Agenda'],
          ['table', 'Tabela'],
          ['rulebook', 'Regulamento'],
        ] as Array<[TabId, string]>).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => {
              setTab(id)
              if (id === 'rulebook') void loadRulebook()
            }}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
          {(structure?.jogos || []).map((game:any, index:number) => {
            const gameStatus = String(game.status || '').toLowerCase()
            const live = ['ao_vivo','em_andamento','iniciado'].includes(gameStatus)
            const finished = ['finalizado','encerrado','concluido'].includes(gameStatus)
            const label = live ? 'AO VIVO' : finished ? 'FINALIZADO' : 'AGENDADO'
            const falls = Array.isArray(game.quedas) ? game.quedas : []
            return <View key={String(game.id || index)} style={styles.gameCard}>
              <View style={styles.row}>
                <View style={[styles.logo, styles.logoFallback]}><Ionicons name={live ? 'radio-outline' : finished ? 'checkmark-circle-outline' : 'calendar-outline'} size={18} color={colors.brand} /></View>
                <View style={styles.copy}>
                  <View style={styles.gameTitleRow}>
                    <Text style={styles.name}>{game.nome || `Jogo ${index + 1}`}</Text>
                    <Text style={[styles.statusBadge, live && styles.statusLive, finished && styles.statusFinished]}>{label}</Text>
                  </View>
                  <Text style={styles.meta}>{[game.data_jogo, game.horario, game.numero_partidas ? `${game.numero_partidas} partidas` : '', Array.isArray(game.mapas) ? game.mapas.join(', ') : ''].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
              {falls.length ? <View style={styles.fallsRow}>{falls.map((fall:any,fallIndex:number)=><View key={String(fall.id || fallIndex)} style={styles.fallChip}><Text style={styles.fallChipText}>{fall.mapa || fall.nome_mapa || `Queda ${fall.numero || fallIndex + 1}`}</Text></View>)}</View> : null}
            </View>
          })}
          {!(structure?.jogos || []).length ? <Text style={styles.empty}>Nenhum jogo agendado ainda.</Text> : null}
        </View>
      ) : null}

      {!loading && tab === 'table' ? (
        <View style={styles.tableBlock}>
          <View style={styles.statisticsControls}>
            {championSummary?.final_concluida&&championSummary?.campeao?<TouchableOpacity style={[styles.statisticsTab,statisticsView==='champion'&&styles.statisticsTabActive]} onPress={()=>setStatisticsView('champion')}><Text style={[styles.statisticsTabText,statisticsView==='champion'&&styles.statisticsTabTextActive]}>Campeão</Text></TouchableOpacity>:null}
            <TouchableOpacity style={[styles.statisticsTab,statisticsView==='table'&&styles.statisticsTabActive]} onPress={()=>setStatisticsView('table')}><Text style={[styles.statisticsTabText,statisticsView==='table'&&styles.statisticsTabTextActive]}>Tabela</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.statisticsTab,statisticsView==='mvp'&&styles.statisticsTabActive]} onPress={()=>setStatisticsView('mvp')}><Text style={[styles.statisticsTabText,statisticsView==='mvp'&&styles.statisticsTabTextActive]}>MVP</Text></TouchableOpacity>
          </View>
          {statisticsView!=='champion'?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip,!statisticsGameId&&styles.filterChipActive]} onPress={()=>{setStatisticsGameId('');setStatisticsFallId('')}}><Text style={[styles.filterChipText,!statisticsGameId&&styles.filterChipTextActive]}>Geral</Text></TouchableOpacity>
            {statisticGames.map((game:any,index:number)=><TouchableOpacity key={String(game.id||index)} style={[styles.filterChip,statisticsGameId===String(game.id)&&styles.filterChipActive]} onPress={()=>{setStatisticsGameId(String(game.id));setStatisticsFallId('')}}><Text style={[styles.filterChipText,statisticsGameId===String(game.id)&&styles.filterChipTextActive]}>{game.nome||`Jogo ${index+1}`}</Text></TouchableOpacity>)}
          </ScrollView>:null}
          {statisticsView!=='champion'&&statisticsGameId&&statisticFalls.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}><TouchableOpacity style={[styles.filterChip,!statisticsFallId&&styles.filterChipActive]} onPress={()=>setStatisticsFallId('')}><Text style={[styles.filterChipText,!statisticsFallId&&styles.filterChipTextActive]}>Todas quedas</Text></TouchableOpacity>{statisticFalls.map((fall:any,index:number)=><TouchableOpacity key={String(fall.id||index)} style={[styles.filterChip,statisticsFallId===String(fall.id)&&styles.filterChipActive]} onPress={()=>setStatisticsFallId(String(fall.id))}><Text style={[styles.filterChipText,statisticsFallId===String(fall.id)&&styles.filterChipTextActive]}>{`Queda ${fall.numero_partida||fall.numero||index+1}`}</Text></TouchableOpacity>)}</ScrollView>:null}
          {statisticsView==='champion'&&championSummary?.campeao?<View style={styles.championCard}><Text style={styles.championEyebrow}>CAMPEÃO DA GRANDE FINAL</Text><View style={styles.championMain}>{championSummary.campeao.logo_url?<Image source={{uri:externalUrl(championSummary.campeao.logo_url)}} style={styles.championLogo} resizeMode="contain"/>:<View style={[styles.championLogo,styles.logoFallback]}><Ionicons name="trophy-outline" size={28} color={colors.brand}/></View>}<View style={styles.copy}><Text style={styles.championName}>{championSummary.campeao.nome}</Text><Text style={styles.meta}>{championSummary.campeao.pontos_total} PTS · {championSummary.campeao.booyahs} BOOYAH · {championSummary.campeao.abates} KILLS · {championSummary.resumo?.quedas||championSummary.campeao.quedas} QUEDAS</Text></View></View><Text style={styles.sectionTitle}>LINE CAMPEÃ</Text><View style={styles.championPlayers}>{(championSummary.jogadores||[]).map((player:any)=><View key={String(player.campeonato_jogador_id)} style={styles.championPlayer}>{player.foto_url?<Image source={{uri:externalUrl(player.foto_url)}} style={styles.championPlayerAvatar}/>:<View style={[styles.championPlayerAvatar,styles.logoFallback]}><Ionicons name="person-outline" size={14} color={colors.brand}/></View>}<Text style={styles.championPlayerName} numberOfLines={1}>{player.nick}</Text><Text style={styles.meta}>{player.abates} K</Text></View>)}</View><View style={styles.championActions}><TouchableOpacity style={styles.statisticsTabActiveButton} onPress={()=>setStatisticsView('mvp')}><Text style={styles.statisticsTabTextActive}>Ver MVP</Text></TouchableOpacity><TouchableOpacity style={styles.statisticsTabOutlineButton} onPress={()=>setStatisticsView('table')}><Text style={styles.statisticsTabText}>Estatísticas do campeonato</Text></TouchableOpacity></View></View>:null}
          {statisticsView==='table'?<>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>CLASSIFICAÇÃO</Text><Text style={styles.sectionUpdated}>ATUAL</Text></View>
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

          </>:null}
          {statisticsView==='mvp'?<>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>MVP</Text><Text style={styles.sectionUpdated}>ATUAL</Text></View>
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
          </>:null}
        </View>
      ) : null}

      {!loading && tab === 'rulebook' ? (
        <View style={styles.rulebookBlock}>
          <View style={styles.rulebookHeader}>
            <View style={styles.rulebookIcon}><Ionicons name="document-text-outline" size={20} color={colors.brand} /></View>
            <View style={styles.copy}>
              <Text style={styles.sectionTitleInline}>REGULAMENTO OFICIAL</Text>
              <Text style={styles.meta}>Versão publicada pela organização do campeonato.</Text>
            </View>
          </View>

          {rulebookLoading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando regulamento...</Text></View> : null}
          {rulebookError ? <View style={styles.rulebookNotice}><Ionicons name="information-circle-outline" size={18} color={colors.brand}/><Text style={styles.rulebookNoticeText}>{rulebookError}</Text></View> : null}

          {!rulebookLoading && rulebook ? (
            <View style={styles.rulebookContent}>
              <Text style={styles.rulebookTitle}>{rulebook.titulo || rulebook.documento?.titulo || championship.name}</Text>
              {rulebook.publicado_em ? <Text style={styles.rulebookPublished}>Publicado em {new Date(rulebook.publicado_em).toLocaleDateString('pt-BR')}</Text> : null}
              {String(rulebook.conteudo_markdown || rulebook.documento?.conteudo_markdown || rulebook.conteudo || '').trim() ? (
                <Text style={styles.rulebookText}>{String(rulebook.conteudo_markdown || rulebook.documento?.conteudo_markdown || rulebook.conteudo || '').trim()}</Text>
              ) : (
                <Text style={styles.empty}>O regulamento publicado não possui texto disponível para exibição nativa.</Text>
              )}
            </View>
          ) : null}
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
  tabs: { margin: spacing.md, marginBottom: 8, paddingRight: spacing.md, flexDirection: 'row', gap: 7 },
  tab: { minWidth: 86, minHeight: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.ink, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  tabTextActive: { color: colors.onBrand },
  loading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  error: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, backgroundColor: 'rgba(224, 122, 122, .12)', color: colors.danger, fontSize: 11, fontWeight: '800' },
  infoGrid: { marginHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { width: '48.8%', minHeight: 62, padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  infoLabel: { color: colors.brand, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { marginTop: 4, color: colors.ink, fontSize: 12, fontWeight: '900' },
  list: { marginHorizontal: spacing.md, gap: 8 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  logo: { width: 40, height: 40, backgroundColor: colors.surfaceRaised, borderRadius: 10 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 11.5, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: colors.muted, fontSize: 8.5, fontWeight: '700' },
  empty: { padding: 16, color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  rulebookBlock: { marginHorizontal: spacing.md, gap: 9 },
  rulebookHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  rulebookIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  rulebookNotice: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: 'rgba(143, 179, 216, .12)' },
  rulebookNoticeText: { flex: 1, color: colors.ink, fontSize: 9, lineHeight: 14, fontWeight: '700' },
  rulebookContent: { padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  rulebookTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  rulebookPublished: { marginTop: 4, color: colors.muted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  rulebookText: { marginTop: 12, color: colors.ink, fontSize: 11, lineHeight: 18, fontWeight: '600' },
  sectionTitleInline: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  liveStrip: { marginHorizontal: spacing.md, marginTop: spacing.sm, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
  liveText: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  liveTime: { marginLeft: 'auto', color: colors.muted, fontSize: 8, fontWeight: '800' },
  gameCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  gameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusBadge: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.surfaceRaised, color: colors.muted, fontSize: 7, fontWeight: '900' },
  statusLive: { backgroundColor: 'rgba(201, 183, 102, .16)', color: colors.brandLight },
  statusFinished: { backgroundColor: 'rgba(101, 185, 130, .14)', color: colors.success },
  fallsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
  fallChip: { paddingHorizontal: 7, paddingVertical: 4, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.line },
  fallChipText: { color: colors.ink, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionUpdated: { color: colors.brand, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  tableBlock: { gap: 8 },
  statisticsControls:{flexDirection:'row',gap:7,marginHorizontal:spacing.md},
  statisticsTab:{flex:1,minHeight:42,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.line},
  statisticsTabActive:{backgroundColor:colors.brand,borderColor:colors.brand},
  statisticsTabText:{color:colors.ink,fontSize:10,fontWeight:'900',textTransform:'uppercase'},
  statisticsTabTextActive:{color:colors.onBrand},
  filterRow:{gap:6,paddingHorizontal:spacing.md,paddingVertical:2},
  filterChip:{minHeight:32,justifyContent:'center',paddingHorizontal:11,borderRadius:16,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.line},
  filterChipActive:{backgroundColor:colors.brand},
  filterChipText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  filterChipTextActive:{color:colors.onBrand},
  sectionTitle: { marginHorizontal: spacing.md, color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  mvpTitle: { marginTop: 8 },
  position: { width: 25, color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  points: { minWidth: 42, color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right' },
  killMetric: { minWidth: 48, alignItems: 'flex-end', paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.brand },
  killValue: { color: colors.brand, fontSize: 18, fontWeight: '900' },
  killLabel: { color: colors.brand, fontSize: 7, fontWeight: '900' },
  championCard:{gap:10,padding:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},championEyebrow:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.2},championMain:{flexDirection:'row',alignItems:'center',gap:10},championLogo:{width:72,height:72,backgroundColor:colors.surfaceRaised},championName:{color:colors.ink,fontSize:20,fontWeight:'900',textTransform:'uppercase'},championPlayers:{flexDirection:'row',flexWrap:'wrap',gap:6},championPlayer:{width:'31%',alignItems:'center',gap:3,padding:7,backgroundColor:colors.surfaceRaised},championPlayerAvatar:{width:40,height:40,borderRadius:20,backgroundColor:colors.surfaceSoft},championPlayerName:{maxWidth:'100%',color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},championActions:{flexDirection:'row',gap:6},statisticsTabActiveButton:{flex:1,minHeight:40,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand,borderRadius:6},statisticsTabOutlineButton:{flex:1,minHeight:40,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:6}})
