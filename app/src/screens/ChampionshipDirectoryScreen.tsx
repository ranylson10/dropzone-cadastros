import { useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { money, toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const typeLabels: Record<string, string> = {
  diario: 'Diário',
  copa: 'Copa',
  liga: 'Liga',
  xtreino: 'Xtreino',
}

export function ChampionshipDirectoryScreen({ onSelectChampionship }: ScreenProps) {
  const [items, setItems] = useState<VacancyApiItem[]>([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    mobileApi.championshipsPublic()
      .then((response) => {
        if (!mounted) return
        setItems((response.announcements || []) as VacancyApiItem[])
        setError('')
      })
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar os campeonatos.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => {
      if (type !== 'todos' && String(item.tipo || '').toLowerCase() !== type) return false
      if (!term) return true
      return [item.nome, item.tipo, item.plataforma, item.servidor].some((value) => String(value || '').toLowerCase().includes(term))
    })
  }, [items, query, type])

  const types = useMemo(() => ['todos', ...Array.from(new Set(items.map((item) => String(item.tipo || '').trim().toLowerCase()).filter(Boolean)))], [items])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <DirectoryHero
        image={require('../../assets/directory-campeonatos.png')}
        eyebrow="Diretório público"
        title="Campeonatos"
        description="Competições ativas do cenário DropZone."
        compact
      />

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={19} color="#7c838c" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar campeonato..."
          placeholderTextColor="#938d84"
          style={styles.searchInput}
        />
        {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color="#8b857d" /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {types.map((item) => (
          <TouchableOpacity key={item} style={[styles.filter, type === item && styles.filterActive]} onPress={() => setType(item)}>
            <Text style={[styles.filterText, type === item && styles.filterTextActive]}>
              {item === 'todos' ? 'Todos' : typeLabels[item] || item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando campeonatos...</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        {visible.map((item) => {
          const logo = item.logo_url ? externalUrl(item.logo_url) : ''
          return (
            <TouchableOpacity key={String(item.id)} style={styles.row} onPress={() => onSelectChampionship?.(toChampionshipCard(item))}>
              {logo ? <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" /> : (
                <View style={[styles.logo, styles.logoFallback]}><Ionicons name="trophy-outline" size={21} color={colors.brand} /></View>
              )}
              <View style={styles.copy}>
                <Text style={styles.type}>{typeLabels[String(item.tipo || '').toLowerCase()] || String(item.tipo || 'Campeonato')}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.nome || 'Campeonato'}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {money(item.valor_inscricao)}{Number(item.vagas_livres || 0) > 0 ? ` · ${Number(item.vagas_livres)} vagas` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#737c86" />
            </TouchableOpacity>
          )
        })}
      </View>

      {!loading && !visible.length ? <Text style={styles.empty}>Nenhum campeonato encontrado.</Text> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  searchBox: { margin: spacing.md, marginBottom: 8, height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, backgroundColor: '#ebe6dd', borderWidth: 1, borderColor: '#d2cbc1' },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700', paddingVertical: 0 },
  filterRow: { paddingHorizontal: spacing.md, paddingBottom: 10, gap: 6 },
  filter: { minHeight: 32, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5dfd5', borderWidth: 1, borderColor: '#d0c9be' },
  filterActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  filterText: { color: colors.ink, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  filterTextActive: { color: colors.surface },
  loading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  error: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: '800' },
  list: { marginHorizontal: spacing.md, gap: 1, backgroundColor: '#cfc8be' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  logo: { width: 46, height: 46, backgroundColor: '#f8f4ed', borderWidth: 1, borderColor: 'rgba(17,24,39,.08)' },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  type: { color: colors.brand, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .6 },
  name: { marginTop: 2, color: colors.ink, fontSize: 12.5, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: '#706b64', fontSize: 9, fontWeight: '700' },
  empty: { margin: spacing.md, padding: 15, backgroundColor: '#e7e1d8', color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800' },
})
