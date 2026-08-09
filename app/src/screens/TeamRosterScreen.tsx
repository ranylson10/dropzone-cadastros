import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { colors, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'
import { TeamStaffPanel } from '@/screens/TeamStaffPanel'
import { TeamPlayersPanel } from '@/screens/TeamPlayersPanel'

type TeamItem = {
  id: string
  nome: string
  username?: string | null
  logo_url?: string | null
  tag?: string | null
  papel?: 'dono' | 'staff'
  permissoes?: { pode_ver?: boolean; pode_editar?: boolean; pode_escalar?: boolean; pode_gerar_token?: boolean }
}

type TeamOverview = {
  lines?: any[]
  players?: any[]
  staff?: any[]
  activeRegistrations?: any[]
  issues?: Array<{ level?: 'attention' | 'info'; title?: string; detail?: string }>
}

type TeamDetail = { team: TeamItem; overview: TeamOverview }
type TeamSection = 'resumo' | 'elenco' | 'lines' | 'staff' | 'eventos'

export function TeamRosterScreen({ onNavigate, selectedTeamId, onManageLine }: ScreenProps) {
  const auth = useAuth()
  const token = auth.session?.access_token
  const [teams, setTeams] = useState<TeamItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(selectedTeamId || null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [section, setSection] = useState<TeamSection>('resumo')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [creatingLine, setCreatingLine] = useState(false)
  const [lineName, setLineName] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const loadTeams = useCallback(async (refresh = false) => {
    if (!token) return
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const response = await mobileApi.teams(token)
      const items = (response.items || []) as TeamItem[]
      setTeams(items)
      if (selectedId && !items.some((item) => item.id === selectedId)) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar suas equipes.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedId, token])

  const openTeam = useCallback(async (team: TeamItem, quiet = false) => {
    setSelectedId(team.id)
    if (!quiet) {
      setSection('resumo')
      setLoading(true)
      setDetail(null)
    }
    setError('')
    try {
      const response = await mobileApi.team(team.id, token)
      setDetail(response as TeamDetail)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir a equipe.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { void loadTeams() }, [loadTeams])

  useEffect(() => {
    if (!selectedId || detail || loading || !teams.length) return
    const team = teams.find((item) => item.id === selectedId)
    if (team) void openTeam(team)
  }, [detail, loading, openTeam, selectedId, teams])

  const selected = useMemo(
    () => detail?.team || teams.find((team) => team.id === selectedId) || null,
    [detail?.team, selectedId, teams],
  )
  const overview = detail?.overview || {}
  const counts = {
    players: overview.players?.length || 0,
    lines: overview.lines?.length || 0,
    staff: overview.staff?.length || 0,
    events: overview.activeRegistrations?.length || 0,
  }

  async function createLine() {
    if (!selected || !lineName.trim() || saving) return
    setSaving(true)
    setFeedback('')
    try {
      await mobileApi.createTeamLine(selected.id, lineName.trim(), token)
      setLineName('')
      setCreatingLine(false)
      setFeedback('Line criada com sucesso.')
      await openTeam(selected, true)
      setSection('lines')
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível criar a line.')
    } finally {
      setSaving(false)
    }
  }

  if (!selectedId) {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadTeams(true)} tintColor={colors.brand} />}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Central de equipes</Text>
          <Text style={styles.title}>Minhas equipes</Text>
          <Text style={styles.description}>Gerencie elenco, lines, staff e campeonatos em uma experiência feita para o app.</Text>
        </View>

        {loading ? <Loading label="Carregando equipes..." /> : null}
        {error ? <Feedback text={error} error /> : null}

        {!loading && !teams.length ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="shield-outline" size={30} color={colors.brand} /></View>
            <Text style={styles.emptyTitle}>Você ainda não controla uma equipe</Text>
            <Text style={styles.emptyText}>Quando criar uma equipe ou aceitar um convite de staff, ela aparecerá aqui.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => onNavigate('invites')}>
              <Ionicons name="mail-outline" size={18} color={colors.surface} />
              <Text style={styles.primaryButtonText}>Ver convites</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.teamList}>
          {teams.map((team) => (
            <TouchableOpacity key={team.id} style={styles.teamCard} activeOpacity={0.8} onPress={() => void openTeam(team)}>
              <TeamLogo team={team} size={64} />
              <View style={styles.teamCopy}>
                <Text style={styles.teamName} numberOfLines={1}>{team.nome}</Text>
                <Text style={styles.teamMeta} numberOfLines={1}>{team.tag || `@${team.username || 'equipe'}`}</Text>
                <View style={styles.roleBadge}><Text style={styles.roleText}>{team.papel === 'dono' ? 'Dono' : 'Staff'}</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={23} color={colors.brand} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => selected && void openTeam(selected, true)} tintColor={colors.brand} />}
    >
      <View style={styles.teamHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('team_directory')}>
          <Ionicons name="arrow-back" size={21} color={colors.surface} />
        </TouchableOpacity>
        {selected ? <TeamLogo team={selected} size={58} /> : null}
        <View style={styles.teamHeaderCopy}>
          <Text style={styles.teamHeaderName} numberOfLines={1}>{selected?.nome || 'Equipe'}</Text>
          <Text style={styles.teamHeaderMeta}>{selected?.tag || `@${selected?.username || 'equipe'}`} · {selected?.papel === 'dono' ? 'Dono' : 'Staff'}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sections}>
        {([
          ['resumo', 'grid-outline', 'Resumo'],
          ['elenco', 'people-outline', 'Elenco'],
          ['lines', 'layers-outline', 'Lines'],
          ['staff', 'shield-checkmark-outline', 'Staff'],
          ['eventos', 'trophy-outline', 'Eventos'],
        ] as Array<[TeamSection, any, string]>).map(([id, icon, label]) => (
          <TouchableOpacity key={id} style={[styles.sectionButton, section === id && styles.sectionButtonActive]} onPress={() => setSection(id)}>
            <Ionicons name={icon} size={19} color={section === id ? colors.surface : colors.muted} />
            <Text style={[styles.sectionLabel, section === id && styles.sectionLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <Loading label="Carregando equipe..." /> : null}
      {error ? <Feedback text={error} error /> : null}
      {feedback ? <Feedback text={feedback} /> : null}

      {!loading && detail && section === 'resumo' ? (
        <>
          <View style={styles.metrics}>
            <Metric value={counts.players} label="Jogadores" />
            <Metric value={counts.lines} label="Lines" />
            <Metric value={counts.staff} label="Staff" />
            <Metric value={counts.events} label="Eventos" />
          </View>
          {(overview.issues || []).map((issue, index) => (
            <View key={`${issue.title}-${index}`} style={[styles.issueCard, issue.level === 'attention' && styles.issueAttention]}>
              <Ionicons name={issue.level === 'attention' ? 'alert-circle-outline' : 'information-circle-outline'} size={22} color={issue.level === 'attention' ? colors.warning : colors.brand} />
              <View style={styles.issueCopy}><Text style={styles.issueTitle}>{issue.title}</Text><Text style={styles.issueText}>{issue.detail}</Text></View>
            </View>
          ))}
          <View style={styles.quickActions}>
            {selected?.permissoes?.pode_editar ? <QuickAction icon="add-circle-outline" label="Nova line" onPress={() => { setCreatingLine(true); setSection('lines') }} /> : null}
            <QuickAction icon="person-add-outline" label="Convites" onPress={() => onNavigate('invites')} />
            {selected?.permissoes?.pode_escalar ? <QuickAction icon="football-outline" label="Escalar" onPress={() => onNavigate('lineup')} /> : null}
          </View>
        </>
      ) : null}

      {!loading && detail && section === 'elenco' && selected ? <TeamPlayersPanel
        teamId={selected.id}
        players={overview.players || []}
        lines={overview.lines || []}
        registrations={overview.activeRegistrations || []}
        accessToken={token}
        canInvite={selected.papel === 'dono' || Boolean(selected.permissoes?.pode_gerar_token)}
      /> : null}

      {!loading && detail && section === 'lines' ? (
        <View style={styles.sectionContent}>
          <View style={styles.sectionTitleRow}>
            <View><Text style={styles.blockTitle}>Lines</Text><Text style={styles.blockSubtitle}>{counts.lines} time(s) da equipe</Text></View>
            {selected?.permissoes?.pode_editar ? <TouchableOpacity style={styles.smallAction} onPress={() => setCreatingLine((value) => !value)}><Ionicons name="add" size={19} color={colors.surface} /><Text style={styles.smallActionText}>Nova</Text></TouchableOpacity> : null}
          </View>
          {creatingLine ? (
            <View style={styles.inlineForm}>
              <TextInput value={lineName} onChangeText={setLineName} placeholder="Nome da line" placeholderTextColor="#8992a0" style={styles.input} editable={!saving} />
              <TouchableOpacity style={[styles.saveButton, (!lineName.trim() || saving) && styles.buttonDisabled]} disabled={!lineName.trim() || saving} onPress={() => void createLine()}>
                {saving ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={styles.saveButtonText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
          {!counts.lines ? <EntityList empty="Nenhuma line criada." items={[]} kind="line" /> : <View style={styles.entityList}>{(overview.lines || []).map((line:any,index:number)=><TouchableOpacity key={String(line.id||index)} style={styles.entityRow} onPress={()=>selected&&onManageLine?.(selected.id,String(line.id))}>{line.logo_url?<Image source={{uri:externalUrl(line.logo_url)}} style={styles.entityImage}/>:<View style={[styles.entityImage,styles.entityFallback]}><Ionicons name="layers-outline" size={21} color={colors.surface}/></View>}<View style={styles.entityCopy}><Text style={styles.entityTitle}>{line.nome||'Line'}</Text><Text style={styles.entitySubtitle}>{line.tag||'Toque para gerenciar elenco e escalações'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.brand}/></TouchableOpacity>)}</View>}
        </View>
      ) : null}

      {!loading && detail && section === 'staff' && selected ? <TeamStaffPanel teamId={selected.id} accessToken={token} isOwner={selected.papel === 'dono'} /> : null}
      {!loading && detail && section === 'eventos' ? <EntityList empty="A equipe não está em campeonatos ativos." items={overview.activeRegistrations || []} kind="event" /> : null}
    </ScrollView>
  )
}

function TeamLogo({ team, size }: { team: TeamItem; size: number }) {
  const logo = team.logo_url ? externalUrl(team.logo_url) : ''
  if (logo) return <Image source={{ uri: logo }} style={[styles.teamLogo, { width: size, height: size }]} resizeMode="contain" />
  return <View style={[styles.teamLogo, styles.teamLogoFallback, { width: size, height: size }]}><Text style={styles.teamLogoText}>{String(team.tag || team.nome || 'DZ').slice(0, 2).toUpperCase()}</Text></View>
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
}

function QuickAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.quickAction} onPress={onPress}><Ionicons name={icon} size={23} color={colors.brand} /><Text style={styles.quickActionText}>{label}</Text></TouchableOpacity>
}

function Loading({ label }: { label: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>{label}</Text></View>
}

function Feedback({ text, error = false }: { text: string; error?: boolean }) {
  return <View style={[styles.feedback, error && styles.feedbackError]}><Text style={[styles.feedbackText, error && styles.feedbackErrorText]}>{text}</Text></View>
}

function EntityList({ items, kind, empty }: { items: any[]; kind: 'player' | 'line' | 'staff' | 'event'; empty: string }) {
  if (!items.length) return <View style={styles.emptyCompact}><Ionicons name="file-tray-outline" size={28} color={colors.muted} /><Text style={styles.emptyCompactText}>{empty}</Text></View>
  return <View style={styles.entityList}>{items.map((item, index) => {
    const source = kind === 'staff' ? item.manager || item : kind === 'event' ? item.campeonato || item : item
    const title = source.nome || source.nick || source.username || item.nome_exibicao || (kind === 'player' ? 'Jogador' : kind === 'line' ? 'Line' : kind === 'staff' ? 'Staff' : 'Campeonato')
    const subtitle = kind === 'player'
      ? `${source.funcao || 'Função não informada'} · ID ${source.id_jogo || 'pendente'}`
      : kind === 'line'
        ? source.tag || 'Sem tag'
        : kind === 'staff'
          ? `${item.pode_editar ? 'Pode editar' : 'Visualização'} · ${item.pode_escalar ? 'Pode escalar' : 'Sem escalação'}`
          : `${item.line?.nome || 'Sem line'} · Slot ${item.slot_numero || '-'}`
    const image = source.logo_url || source.avatar_url || source.foto_url
    return <View key={String(item.id || source.id || `${kind}-${index}`)} style={styles.entityRow}>
      {image ? <Image source={{ uri: externalUrl(image) }} style={styles.entityImage} resizeMode="cover" /> : <View style={[styles.entityImage, styles.entityFallback]}><Text style={styles.entityInitial}>{String(title).slice(0, 1).toUpperCase()}</Text></View>}
      <View style={styles.entityCopy}><Text style={styles.entityTitle} numberOfLines={1}>{title}</Text><Text style={styles.entitySubtitle} numberOfLines={1}>{subtitle}</Text></View>
    </View>
  })}</View>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  heading: { gap: spacing.sm },
  eyebrow: { color: colors.brand, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: typography.title, fontWeight: '900', textTransform: 'uppercase' },
  description: { color: colors.muted, fontSize: typography.body, lineHeight: 21 },
  loading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  loadingText: { color: colors.muted, fontWeight: '700' },
  feedback: { padding: spacing.md, backgroundColor: '#effaf3', borderLeftWidth: 3, borderLeftColor: colors.success },
  feedbackError: { backgroundColor: '#fff7ed', borderLeftColor: colors.warning },
  feedbackText: { color: '#166534', fontWeight: '800' },
  feedbackErrorText: { color: '#9a3412' },
  teamList: { gap: spacing.md },
  teamCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderTopWidth: 3, borderTopColor: colors.brand },
  teamLogo: { backgroundColor: '#111827', borderRadius: 8 },
  teamLogoFallback: { alignItems: 'center', justifyContent: 'center' },
  teamLogoText: { color: colors.surface, fontSize: 18, fontWeight: '900' },
  teamCopy: { flex: 1, minWidth: 0, gap: 3 },
  teamName: { color: colors.ink, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  teamMeta: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  roleBadge: { alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#fff0f2' },
  roleText: { color: colors.brand, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  emptyCard: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  emptyIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff0f2', borderRadius: 30 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.muted, lineHeight: 20, textAlign: 'center' },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.lg, backgroundColor: colors.brandDark },
  primaryButtonText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase' },
  teamHeader: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.brandDark, borderBottomWidth: 3, borderBottomColor: colors.brand },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.18)' },
  teamHeaderCopy: { flex: 1, minWidth: 0 },
  teamHeaderName: { color: colors.surface, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  teamHeaderMeta: { marginTop: 4, color: '#b6bfca', fontSize: typography.caption, fontWeight: '700' },
  sections: { gap: 7 },
  sectionButton: { minWidth: 88, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  sectionButtonActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sectionLabelActive: { color: colors.surface },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: colors.line },
  metric: { width: '49%', flexGrow: 1, padding: spacing.md, backgroundColor: colors.surface },
  metricValue: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  issueCard: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: '#eff6ff', borderLeftWidth: 3, borderLeftColor: colors.brand },
  issueAttention: { backgroundColor: '#fff7ed', borderLeftColor: colors.warning },
  issueCopy: { flex: 1, gap: 3 },
  issueTitle: { color: colors.ink, fontWeight: '900' },
  issueText: { color: colors.muted, fontSize: typography.caption, lineHeight: 17 },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  quickActionText: { color: colors.ink, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sectionContent: { gap: spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  blockSubtitle: { color: colors.muted, fontSize: typography.caption },
  smallAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, backgroundColor: colors.brandDark },
  smallActionText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase' },
  inlineForm: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  saveButton: { minWidth: 78, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  saveButtonText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase' },
  buttonDisabled: { opacity: 0.5 },
  entityList: { gap: spacing.sm },
  entityRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  entityImage: { width: 52, height: 52, borderRadius: 6, backgroundColor: colors.brandDark },
  entityFallback: { alignItems: 'center', justifyContent: 'center' },
  entityInitial: { color: colors.surface, fontSize: 18, fontWeight: '900' },
  entityCopy: { flex: 1, minWidth: 0 },
  entityTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  entitySubtitle: { marginTop: 4, color: colors.muted, fontSize: typography.caption },
  emptyCompact: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  emptyCompactText: { color: colors.muted, textAlign: 'center', fontWeight: '700' },
})
