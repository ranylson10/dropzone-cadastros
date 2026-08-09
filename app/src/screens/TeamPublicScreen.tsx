import { useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type TabId = 'lines' | 'players' | 'championships'

export function TeamPublicScreen({ selectedTeamId, onSelectChampionship, onSelectPlayer, onManageTeam }: ScreenProps) {
  const auth = useAuth()
  const [payload, setPayload] = useState<any>(null)
  const [tab, setTab] = useState<TabId>('lines')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)

  useEffect(() => {
    if (!selectedTeamId) return
    let mounted = true
    mobileApi.publicTeam(selectedTeamId)
      .then((result) => {
        if (!mounted) return
        setPayload(result)
        setError('')
      })
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar a equipe.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [selectedTeamId])

  useEffect(() => {
    if (!selectedTeamId || !auth.session?.access_token) { setCanManage(false); return }
    mobileApi.teams(auth.session.access_token).then((result:any) => setCanManage((result.items || []).some((item:any) => String(item.id) === String(selectedTeamId) && (item.papel === 'dono' || item.permissoes?.pode_editar)))).catch(() => setCanManage(false))
  }, [auth.session?.access_token, selectedTeamId])

  const team = payload?.team || {}
  const lines = Array.isArray(payload?.lines) ? payload.lines : []
  const players = useMemo(() => lines.flatMap((line:any) => (line.jogadores || []).map((player:any) => ({ ...player, line_nome: line.nome }))), [lines])
  const championships = useMemo(() => {
    const map = new Map<string, any>()
    for (const line of lines) {
      for (const championship of line.campeonatos || []) {
        if (!map.has(String(championship.campeonato_id))) map.set(String(championship.campeonato_id), { ...championship, line_nome: line.nome })
      }
    }
    return [...map.values()]
  }, [lines])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero
        image={require('../../assets/directory-equipes.png')}
        eyebrow={team.tag || 'Equipe'}
        title={team.nome || 'Equipe'}
        description={[team.username ? `@${team.username}` : '', team.localidade || [team.cidade, team.estado, team.pais].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')}
        compact
      />

      {team.logo_url ? (
        <View style={styles.identity}>
          <Image source={{ uri: externalUrl(team.logo_url) }} style={styles.teamLogo} resizeMode="contain" />
          <View style={styles.identityCopy}>
            <Text style={styles.identityName}>{team.nome || 'Equipe'}</Text>
            <Text style={styles.identityMeta}>{team.tag || 'Organização competitiva'}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {([
          ['lines', 'Lines'],
          ['players', 'Jogadores'],
          ['championships', 'Campeonatos'],
        ] as Array<[TabId, string]>).map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {canManage ? <TouchableOpacity style={styles.manageButton} onPress={() => selectedTeamId && onManageTeam?.(selectedTeamId)}><Ionicons name="settings-outline" size={17} color={colors.surface} /><Text style={styles.manageButtonText}>Editar equipe, lines e elenco</Text></TouchableOpacity> : null}

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando equipe...</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && tab === 'lines' ? (
        <View style={styles.list}>
          {lines.map((line:any, index:number) => (
            <TouchableOpacity key={String(line.id || index)} style={styles.lineBlock} onPress={() => setSelectedLineId(selectedLineId === String(line.id) ? null : String(line.id))}>
              <View style={styles.row}>
              {line.logo_url ? <Image source={{ uri: externalUrl(line.logo_url) }} style={styles.logo} resizeMode="contain" /> : <View style={[styles.logo, styles.logoFallback]}><Ionicons name="shield-outline" size={18} color={colors.brand} /></View>}
              <View style={styles.copy}>
                <Text style={styles.name}>{line.nome || 'Line'}</Text>
                <Text style={styles.meta}>{(line.jogadores || []).length} jogadores · {(line.campeonatos || []).length} campeonatos</Text>
              </View>
              <Ionicons name={selectedLineId === String(line.id) ? 'chevron-up' : 'chevron-down'} size={18} color="#737c86" />
              </View>
              {selectedLineId === String(line.id) ? <View style={styles.lineDetails}>
                <Text style={styles.detailTitle}>JOGADORES</Text>
                {(line.jogadores || []).map((player:any, playerIndex:number) => <TouchableOpacity key={String(player.id || playerIndex)} style={styles.detailRow} onPress={() => player.jogador_id && onSelectPlayer?.(String(player.jogador_id))}><Ionicons name="person-outline" size={15} color={colors.brand}/><Text style={styles.detailText}>{player.nick || 'Jogador'}{player.funcao ? ` · ${player.funcao}` : ''}</Text></TouchableOpacity>)}
                {!(line.jogadores || []).length ? <Text style={styles.detailEmpty}>Nenhum jogador nesta line.</Text> : null}
                <Text style={styles.detailTitle}>EVENTOS E AGENDA</Text>
                {(line.campeonatos || []).map((event:any, eventIndex:number) => <TouchableOpacity key={String(event.campeonato_id || eventIndex)} style={styles.detailRow} onPress={() => onSelectChampionship?.({id:String(event.campeonato_id),name:event.nome||'Campeonato',mode:event.tipo||'competitivo',logoUrl:event.logo_url||null,priceLabel:'Ver campeonato',freeSlots:0})}><Ionicons name="calendar-outline" size={15} color={colors.brand}/><Text style={styles.detailText}>{event.nome || 'Campeonato'}</Text><Ionicons name="chevron-forward" size={14} color="#737c86"/></TouchableOpacity>)}
                {!(line.campeonatos || []).length ? <Text style={styles.detailEmpty}>Nenhum evento ativo.</Text> : null}
              </View> : null}
            </TouchableOpacity>
          ))}
          {!lines.length ? <Text style={styles.empty}>Nenhuma line pública.</Text> : null}
        </View>
      ) : null}

      {!loading && tab === 'players' ? (
        <View style={styles.list}>
          {players.map((player:any, index:number) => (
            <TouchableOpacity key={String(player.id || index)} style={styles.row} onPress={() => player.jogador_id && onSelectPlayer?.(String(player.jogador_id))}>
              {player.foto_url ? <Image source={{ uri: externalUrl(player.foto_url) }} style={styles.logo} resizeMode="cover" /> : <View style={[styles.logo, styles.logoFallback]}><Ionicons name="person-outline" size={18} color={colors.brand} /></View>}
              <View style={styles.copy}>
                <Text style={styles.name}>{player.nick || 'Jogador'}</Text>
                <Text style={styles.meta}>{player.line_nome}{player.funcao ? ` · ${player.funcao}` : ''}{player.id_jogo ? ` · ID ${player.id_jogo}` : ''}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {!players.length ? <Text style={styles.empty}>Nenhum jogador público.</Text> : null}
        </View>
      ) : null}

      {!loading && tab === 'championships' ? (
        <View style={styles.list}>
          {championships.map((championship:any, index:number) => (
            <TouchableOpacity
              key={String(championship.campeonato_id || index)}
              style={styles.row}
              onPress={() => onSelectChampionship?.({
                id: String(championship.campeonato_id),
                name: championship.nome || 'Campeonato',
                mode: 'competitivo',
                logoUrl: championship.logo_url || null,
                priceLabel: 'Ver campeonato',
                freeSlots: 0,
              })}
            >
              {championship.logo_url ? <Image source={{ uri: externalUrl(championship.logo_url) }} style={styles.logo} resizeMode="contain" /> : <View style={[styles.logo, styles.logoFallback]}><Ionicons name="trophy-outline" size={18} color={colors.brand} /></View>}
              <View style={styles.copy}>
                <Text style={styles.name}>{championship.nome || 'Campeonato'}</Text>
                <Text style={styles.meta}>{championship.line_nome || 'Participação da equipe'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#737c86" />
            </TouchableOpacity>
          ))}
          {!championships.length ? <Text style={styles.empty}>Nenhum campeonato público.</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  identity: { marginHorizontal: spacing.md, marginTop: 10, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, backgroundColor: '#e8e2d8' },
  teamLogo: { width: 48, height: 48, backgroundColor: '#f7f3ec' },
  identityCopy: { flex: 1 },
  identityName: { color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  identityMeta: { marginTop: 3, color: colors.brand, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  tabs: { margin: spacing.md, marginBottom: 8, flexDirection: 'row', backgroundColor: '#cfc8be', gap: 1 },
  tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7e1d8' },
  tabActive: { backgroundColor: colors.brandDark },
  tabText: { color: colors.ink, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  tabTextActive: { color: colors.surface },
  loading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  error: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: '800' },
  list: { marginHorizontal: spacing.md, gap: 1, backgroundColor: '#cfc8be' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  logo: { width: 40, height: 40, backgroundColor: '#f7f3ec' },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 11.5, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: '#706b64', fontSize: 8.5, fontWeight: '700' },
  empty: { padding: 16, color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800', backgroundColor: '#e7e1d8' },
  manageButton: { marginHorizontal: spacing.md, marginBottom: 8, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.brandDark },
  manageButtonText: { color: colors.surface, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  lineBlock: { backgroundColor: '#e8e2d8' },
  lineDetails: { padding: 10, gap: 5, backgroundColor: '#f4efe7', borderTopWidth: 1, borderTopColor: '#d4cdc3' },
  detailTitle: { marginTop: 4, color: colors.brand, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  detailRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 7, backgroundColor: '#e8e2d8' },
  detailText: { flex: 1, color: colors.ink, fontSize: 9.5, fontWeight: '800' },
  detailEmpty: { paddingVertical: 5, color: colors.muted, fontSize: 9, fontWeight: '700' },
})
