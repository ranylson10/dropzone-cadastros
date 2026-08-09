import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { addMobileCart, getMobileCart, getMobileWishlist, mobileCommerceFromApi, MobileCommerceItem, toggleMobileWishlist } from '@/lib/commerce'
import { dateLabel, money, toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: 'free', label: 'Grátis' },
  { id: 'live', label: 'Live' },
  { id: 'last', label: 'Últimas' },
] as const

type FilterId = typeof filters[number]['id']

export function VacanciesScreen({ onBack, onNavigate, onSelectChampionship, profileType }: ScreenProps) {
  const auth = useAuth()
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [vacancies, setVacancies] = useState<VacancyApiItem[]>([])
  const [cart, setCart] = useState<MobileCommerceItem[]>([])
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
      .catch((err) => {
        if (!mounted) return
        setVacancies([])
        setError(err?.message || 'Não foi possível carregar as vagas agora.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const accessToken = auth.session?.access_token
    const cartPromise = accessToken ? mobileApi.commerceCart(accessToken).then((payload) => payload.items.map(mobileCommerceFromApi)) : getMobileCart()
    const wishlistPromise = accessToken ? mobileApi.commerceWishlist(accessToken).then((payload) => payload.items.map(mobileCommerceFromApi)) : getMobileWishlist()
    Promise.all([
      cartPromise.catch(() => getMobileCart()),
      wishlistPromise.catch(() => getMobileWishlist()),
    ]).then(([cartItems, wishlistItems]) => {
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
  const cartQuantity = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0)

  return (
    <ScreenShell eyebrow="Vitrine" title="Vagas abertas" onBack={onBack}>
      <View style={styles.areaActions}>
        <TouchableOpacity style={[styles.areaButton, styles.areaButtonActive]} onPress={() => setActiveFilter('all')}>
          <Text style={[styles.areaButtonText, styles.areaButtonTextActive]}>Vagas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.areaButton} onPress={() => onNavigate('my_championships')}>
          <Text style={styles.areaButtonText}>Meus</Text>
        </TouchableOpacity>
        {profileType === 'produtora' ? (
          <TouchableOpacity style={styles.areaButton} onPress={() => onNavigate('producer_overview')}>
            <Text style={styles.areaButtonText}>Criar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{visibleVacancies.length}</Text><Text style={styles.summaryLabel}>resultados</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{cartQuantity}</Text><Text style={styles.summaryLabel}>carrinho</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{wishlist.length}</Text><Text style={styles.summaryLabel}>favoritos</Text></View>
      </View>

      <View style={styles.filters}>
        {filters.map((filter) => (
          <TouchableOpacity key={filter.id} style={[styles.filter, activeFilter === filter.id && styles.filterActive]} onPress={() => setActiveFilter(filter.id)}>
            <Text style={[styles.filterText, activeFilter === filter.id && styles.filterTextActive]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.meta}>Buscando vagas abertas...</Text></View>
      ) : null}

      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {!loading && visibleVacancies.length === 0 ? (
        <ActionCard title="Nenhuma vaga nesse filtro" description="Troque o filtro ou volte mais tarde." cta="Ver todos" onPress={() => setActiveFilter('all')} />
      ) : null}

      {visibleVacancies.map((item) => {
        const championship = toChampionshipCard(item)
        const isFavorite = wishlistIds.has(championship.id)
        return (
          <TouchableOpacity key={item.id || item.nome} style={styles.card} onPress={() => onSelectChampionship?.(championship)}>
            <View style={styles.media}>
              {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.mediaImage} /> : null}
              <Text style={styles.badge}>{item.tem_live ? 'LIVE' : String(item.tipo || 'VAGA').toUpperCase()}</Text>
              {item.logo_url ? <Image source={{ uri: item.logo_url }} style={styles.logo} /> : null}
            </View>

            <View style={styles.body}>
              <View>
                <Text style={styles.type}>{item.tipo || 'Campeonato'}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.nome || 'Campeonato'}</Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>{dateLabel(item)} · {item.proximo_horario || 'Horário a confirmar'}</Text>
              <View style={styles.infoRow}>
                <View style={styles.infoBox}><Text style={styles.infoValue}>{money(item.valor_inscricao)}</Text><Text style={styles.infoLabel}>inscrição</Text></View>
                <View style={styles.infoBox}><Text style={styles.infoValue} numberOfLines={1}>{item.descricao_premiacao || money(item.premiacao)}</Text><Text style={styles.infoLabel}>prêmio</Text></View>
              </View>
              <Text style={styles.meta}>{Number(item.vagas_livres || 0)} de {Number(item.total_vagas || 0)} vagas livres</Text>
              <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(5, Math.min(100, (Number(item.vagas_livres || 0) / Math.max(1, Number(item.total_vagas || 1))) * 100))}%` }]} /></View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={async () => {
                    const accessToken = auth.session?.access_token
                    if (accessToken) {
                      try {
                        const payload = await mobileApi.toggleCommerceWishlist(championship.id, accessToken)
                        setWishlist(payload.items.map(mobileCommerceFromApi))
                        return
                      } catch {}
                    }
                    setWishlist(await toggleMobileWishlist(championship))
                  }}
                >
                  <Text style={styles.iconText}>{isFavorite ? '♥' : '♡'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cartButton}
                  onPress={async () => {
                    const accessToken = auth.session?.access_token
                    if (accessToken) {
                      try {
                        const payload = await mobileApi.addCommerceCart(championship.id, 1, accessToken)
                        setCart(payload.items.map(mobileCommerceFromApi))
                        return
                      } catch {}
                    }
                    setCart(await addMobileCart(championship, 1))
                  }}
                >
                  <Text style={styles.cartText}>Carrinho</Text>
                </TouchableOpacity>
                <Text style={styles.cta}>Ver vaga ›</Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  areaActions: { flexDirection: 'row', gap: spacing.sm },
  areaButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  areaButtonActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  areaButtonText: { color: colors.ink, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
  areaButtonTextActive: { color: colors.surface },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.brandDark,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
  },
  summaryItem: { flex: 1, padding: spacing.md },
  summaryNumber: { color: colors.surface, fontSize: 22, fontWeight: '900' },
  summaryLabel: { color: '#aeb6c0', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: { borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { color: colors.ink, fontWeight: '900', fontSize: typography.caption },
  filterTextActive: { color: colors.surface },
  loading: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: spacing.sm, padding: spacing.lg },
  warning: { backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: '800', padding: spacing.md },
  card: { minHeight: 190, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.surface, borderTopWidth: 3, borderTopColor: colors.brand, elevation: 2 },
  media: { width: 128, minHeight: 190, backgroundColor: colors.brandDark, padding: spacing.sm, justifyContent: 'flex-end' },
  mediaImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.brand, color: colors.surface, fontSize: 8, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 4 },
  logo: { width: 42, height: 42, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,.9)' },
  body: { flex: 1, padding: spacing.sm, gap: 7, justifyContent: 'center' },
  type: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  name: { color: colors.ink, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  meta: { color: colors.muted, fontSize: typography.tiny, fontWeight: '700' },
  infoRow: { flexDirection: 'row', gap: 6 },
  infoBox: { flex: 1, backgroundColor: colors.background, padding: spacing.xs },
  infoValue: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  infoLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  progress: { height: 5, overflow: 'hidden', backgroundColor: '#ece7df' },
  progressFill: { height: '100%', backgroundColor: colors.brand },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  iconText: { color: colors.brand, fontSize: 20, fontWeight: '900' },
  cartButton: { paddingHorizontal: spacing.sm, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  cartText: { color: colors.ink, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cta: { marginLeft: 'auto', color: colors.brand, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
})
