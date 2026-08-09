import { useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { mobileCommerceFromApi, MobileCommerceItem } from '@/lib/commerce'
import { dateLabel, money, toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: 'free', label: 'Grátis' },
  { id: 'live', label: 'Live' },
  { id: 'last', label: 'Últimas' },
] as const

type FilterId = typeof filters[number]['id']

export function VacanciesScreen({ onNavigate, onSelectChampionship, profileType, requireAuth }: ScreenProps) {
  const auth = useAuth()
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [vacancies, setVacancies] = useState<VacancyApiItem[]>([])
  const [, setCart] = useState<MobileCommerceItem[]>([])
  const [wishlist, setWishlist] = useState<MobileCommerceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.vacancies()
      .then((response) => {
        if (!mounted) return
        setVacancies((response.announcements as VacancyApiItem[]) || [])
        setError(null)
      })
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar os campeonatos.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const accessToken = auth.session?.access_token
    if (!accessToken) {
      setCart([])
      setWishlist([])
      return () => { mounted = false }
    }
    const cartPromise = mobileApi.commerceCart(accessToken).then((payload) => payload.items.map(mobileCommerceFromApi))
    const wishlistPromise = mobileApi.commerceWishlist(accessToken).then((payload) => payload.items.map(mobileCommerceFromApi))
    Promise.all([cartPromise.catch(() => []), wishlistPromise.catch(() => [])]).then(([cartItems, wishlistItems]) => {
      if (!mounted) return
      setCart(cartItems)
      setWishlist(wishlistItems)
    })
    return () => { mounted = false }
  }, [auth.session?.access_token])

  const visibleVacancies = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return vacancies.filter((item) => {
      if (activeFilter === 'today') return item.proxima_data === today
      if (activeFilter === 'free') return Number(item.valor_inscricao || 0) <= 0
      if (activeFilter === 'live') return Boolean(item.tem_live)
      if (activeFilter === 'last') return Number(item.vagas_livres || 0) > 0 && Number(item.vagas_livres || 0) <= 8
      return true
    })
  }, [activeFilter, vacancies])

  const wishlistIds = useMemo(() => new Set(wishlist.map((item) => item.id)), [wishlist])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero
        image={require('../../assets/directory-campeonatos.png')}
        eyebrow="Diretório competitivo"
        title="Campeonatos"
        description="Vagas abertas, inscrições e seus campeonatos."
        actionLabel="Meus campeonatos"
        actionIcon="trophy-outline"
        onAction={() => onNavigate('my_championships')}
      />

      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((filter) => (
            <TouchableOpacity key={filter.id} style={[styles.filter, activeFilter === filter.id && styles.filterActive]} onPress={() => setActiveFilter(filter.id)}>
              <Text style={[styles.filterText, activeFilter === filter.id && styles.filterTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {profileType === 'produtora' ? (
          <TouchableOpacity style={styles.createButton} onPress={() => onNavigate('producer_overview')}>
            <Ionicons name="add" size={18} color={colors.surface} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {!loading && visibleVacancies.length === 0 ? <Text style={styles.empty}>Nenhum campeonato neste filtro.</Text> : null}

      <View style={styles.list}>
        {visibleVacancies.map((item) => {
          const championship = toChampionshipCard(item)
          const isFavorite = wishlistIds.has(championship.id)
          return (
            <TouchableOpacity key={item.id || item.nome} style={styles.row} activeOpacity={0.82} onPress={() => onSelectChampionship?.(championship)}>
              <View style={styles.media}>
                {item.logo_url ? <Image source={{ uri: item.logo_url }} style={styles.logo} resizeMode="contain" /> : <Ionicons name="trophy-outline" size={23} color={colors.surface} />}
              </View>
              <View style={styles.rowCopy}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.type}>{String(item.tipo || 'Campeonato').toUpperCase()}</Text>
                  {item.tem_live ? <Text style={styles.live}>LIVE</Text> : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>{item.nome || 'Campeonato'}</Text>
                <Text style={styles.meta} numberOfLines={1}>{dateLabel(item)} · {money(item.valor_inscricao)} · {Number(item.vagas_livres || 0)} vagas</Text>
              </View>
              <TouchableOpacity
                hitSlop={8}
                style={styles.wish}
                onPress={async () => {
                  const accessToken = auth.session?.access_token
                  if (!accessToken) {
                    requireAuth?.()
                    return
                  }
                  try {
                    const payload = await mobileApi.toggleCommerceWishlist(championship.id, accessToken)
                    setWishlist(payload.items.map(mobileCommerceFromApi))
                  } catch {}
                }}
              >
                <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={19} color={colors.brand} />
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={8}
                style={styles.cart}
                onPress={async () => {
                  const accessToken = auth.session?.access_token
                  if (!accessToken) {
                    requireAuth?.()
                    return
                  }
                  try {
                    const payload = await mobileApi.addCommerceCart(championship.id, 1, accessToken)
                    setCart(payload.items.map(mobileCommerceFromApi))
                  } catch {}
                }}
              >
                <Ionicons name="cart-outline" size={18} color={colors.ink} />
              </TouchableOpacity>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  toolbar: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  filters: { gap: 6, paddingVertical: 8 },
  filter: { height: 32, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#e7e1d8', borderWidth: 1, borderColor: '#d3ccc2' },
  filterActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  filterText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  filterTextActive: { color: colors.surface },
  createButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  loading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  warning: { marginHorizontal: spacing.md, marginBottom: 8, padding: 10, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: '800' },
  empty: { marginHorizontal: spacing.md, padding: 16, backgroundColor: '#e7e1d8', color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  list: { marginHorizontal: spacing.md, backgroundColor: '#cfc8be', gap: 1 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  media: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171d28', borderWidth: 1, borderColor: 'rgba(17,24,39,.08)' },
  logo: { width: 44, height: 44, backgroundColor: '#f8f5ef' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  type: { color: colors.brand, fontSize: 8, fontWeight: '900' },
  live: { color: colors.surface, backgroundColor: colors.brand, paddingHorizontal: 4, paddingVertical: 1, fontSize: 7, fontWeight: '900' },
  name: { marginTop: 2, color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: '#706b64', fontSize: 9, fontWeight: '700' },
  wish: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  cart: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
})
