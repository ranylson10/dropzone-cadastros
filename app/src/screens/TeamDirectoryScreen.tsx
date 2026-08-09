import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type PublicTeam = {
  id: string
  nome: string
  username?: string | null
  logo_url?: string | null
  tag?: string | null
  public_id?: string | number | null
  localidade?: string | null
  cidade?: string | null
  estado?: string | null
  pais?: string | null
}

type ManagedTeam = PublicTeam & {
  papel?: 'dono' | 'staff'
}

export function TeamDirectoryScreen({ onNavigate, onSelectTeam, onManageTeam }: ScreenProps) {
  const auth = useAuth()
  const token = auth.session?.access_token
  const [teams, setTeams] = useState<PublicTeam[]>([])
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      // O diretório é público por definição. Nunca envie Bearer aqui: versões antigas
      // do endpoint tratavam a presença/ausência de sessão de forma diferente.
      const directory = await mobileApi.publicTeams('')
      let publicItems = (directory.items || []) as PublicTeam[]
      if (!publicItems.length && token) {
        const fallback = await mobileApi.publicTeamsFallback(token)
        publicItems = (fallback.rows || []).map((row: any) => ({
          id: String(row.id || ''),
          nome: String(row.name || row.nome || 'Equipe'),
          tag: row.data?.tag || null,
          logo_url: row.data?.logo_url || null,
        })).filter((row: PublicTeam) => row.id)
      }
      setTeams(publicItems)

      if (token) {
        const managed = await mobileApi.teams(token)
        setManagedTeams((managed.items || []) as ManagedTeam[])
      } else {
        setManagedTeams([])
      }
    } catch (err: any) {
      const message = String(err?.message || '')
      setError(/sess[aã]o ausente/i.test(message) ? 'O diretório público precisa ser atualizado no servidor. Publique a API web desta rodada e tente novamente.' : (message || 'Não foi possível carregar as equipes.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const visibleTeams = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return teams
    return teams.filter((team) => [
      team.nome,
      team.username,
      team.tag,
      team.public_id,
      team.localidade,
      team.cidade,
      team.estado,
      team.pais,
    ].some((value) => String(value || '').toLowerCase().includes(term)))
  }, [query, teams])

  const preferredManagedTeam = useMemo(() => {
    const activeId = auth.activeAccount?.profile_type === 'equipe' ? auth.activeAccount.id : null
    return managedTeams.find((team) => team.id === activeId) || managedTeams[0] || null
  }, [auth.activeAccount, managedTeams])

  function handlePrimaryAction() {
    if (preferredManagedTeam) {
      onManageTeam?.(preferredManagedTeam.id)
      return
    }
    onNavigate('team_create')
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />}
    >
      <DirectoryHero
        image={require('../../assets/directory-equipes.png')}
        eyebrow="Diretório público"
        title="Equipes"
        description="Organizações e lines do cenário competitivo."
        actionLabel={preferredManagedTeam ? 'Minha equipe' : 'Criar equipe'}
        actionIcon={preferredManagedTeam ? 'shield-checkmark-outline' : 'add-outline'}
        onAction={handlePrimaryAction}
      />

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#77808d" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nome, usuário, tag ou localidade..."
          placeholderTextColor="#969087"
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={19} color="#8b857d" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.brand} size="small" />
          <Text style={styles.loadingText}>Carregando equipes...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !visibleTeams.length ? (
        <View style={styles.emptyRow}>
          <Ionicons name="people-outline" size={24} color={colors.muted} />
          <Text style={styles.emptyText}>Nenhuma equipe encontrada.</Text>
        </View>
      ) : null}

      <View style={styles.teamList}>
        {visibleTeams.map((team) => {
          return (
            <TouchableOpacity
              key={team.id}
              style={styles.teamRow}
              activeOpacity={0.78}
              onPress={() => onSelectTeam?.(team.id)}
            >
              <TeamLogo team={team} />
              <View style={styles.teamCopy}>
                <View style={styles.teamTitleRow}>
                  {team.tag ? <Text style={styles.teamTag}>{team.tag}</Text> : null}
                  <Text style={styles.teamName} numberOfLines={1}>{team.nome}</Text>
                </View>
                <Text style={styles.teamMeta} numberOfLines={1}>{teamMeta(team)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#717b87" />
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

function TeamLogo({ team }: { team: PublicTeam }) {
  const logo = team.logo_url ? externalUrl(team.logo_url) : ''
  if (logo) return <Image source={{ uri: logo }} style={styles.teamLogo} resizeMode="contain" />
  return (
    <View style={[styles.teamLogo, styles.teamLogoFallback]}>
      <Text style={styles.teamInitial}>{String(team.tag || team.nome || 'DZ').slice(0, 2).toUpperCase()}</Text>
    </View>
  )
}

function teamMeta(team: PublicTeam) {
  const handle = team.username ? `@${team.username}` : ''
  const location = team.localidade || [team.cidade, team.estado, team.pais].filter(Boolean).join(' · ')
  return [handle, location].filter(Boolean).join(' · ') || 'Equipe competitiva'
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  searchBox: { margin: spacing.md, marginBottom: 9, height: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, backgroundColor: '#ebe6dd', borderWidth: 1, borderColor: '#d2cbc1' },
  searchInput: { flex: 1, paddingVertical: 0, color: colors.ink, fontSize: 12, fontWeight: '700' },
  loadingRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  error: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, color: '#9a3412', backgroundColor: '#fff7ed', fontSize: 11, fontWeight: '800' },
  emptyRow: { marginHorizontal: spacing.md, minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#e7e1d8' },
  emptyText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  teamList: { marginHorizontal: spacing.md, backgroundColor: '#cfc8be', gap: 1 },
  teamRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  teamLogo: { width: 46, height: 46, backgroundColor: '#f7f3ec', borderWidth: 1, borderColor: 'rgba(17,24,39,.08)' },
  teamLogoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#171d28' },
  teamInitial: { color: colors.surface, fontSize: 12, fontWeight: '900' },
  teamCopy: { flex: 1, minWidth: 0 },
  teamTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamTag: { color: colors.brand, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  teamName: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  teamMeta: { marginTop: 3, color: '#706b64', fontSize: 9, fontWeight: '700' },
})
