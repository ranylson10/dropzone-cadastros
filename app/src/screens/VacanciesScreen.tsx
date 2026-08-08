import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { addMobileCart, getMobileCart, getMobileWishlist, mobileCommerceFromApi, MobileCommerceItem, toggleMobileWishlist } from '@/lib/commerce'
import { dateLabel, fallbackVacancies, money, toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: 'free', label: 'Grátis' },
  { id: 'live', label: 'Com live' },
  { id: 'last', label: 'Últimas vagas' },
] as const

type FilterId = typeof filters[number]['id']

export function VacanciesScreen({ onBack, onSelectChampionship }: ScreenProps) {
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
        setVacancies(fallbackVacancies)
        setError(err?.message || 'Não foi possível carregar as vagas agora.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
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
    return () => {
      mounted = false
    }
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
    <ScreenShell
      eyebrow="Vitrine"
      title="Campeonatos com vagas"
      description="Preço, premiação, vagas livres, live e próximo jogo em uma tela rápida para decidir onde entrar."
      onBack={onBack}
    >
      <View style={styles.filters}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filter, activeFilter === filter.id && styles.filterActive]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[styles.filterText, activeFilter === filter.id && styles.filterTextActive]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.commerceSummary}>
        <Text style={styles.commerceTitle}>Carrinho</Text>
        <Text style={styles.commerceText}>{cartQuantity} vaga(s) separada(s) para comprar</Text>
        <Text style={styles.commerceTitle}>Favoritos</Text>
        <Text style={styles.commerceText}>{wishlist.length} campeonato(s) salvo(s)</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.meta}>Buscando vagas abertas...</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.warning}>Usei dados de demonstração porque a vitrine não respondeu: {error}</Text>
      ) : null}

      {!loading && visibleVacancies.length === 0 ? (
        <ActionCard
          title="Nenhuma vaga nesse filtro"
          description="Troque o filtro ou volte mais tarde. A vitrine só mostra campeonatos ativos, aprovados e com vagas livres."
          cta="Ver todos"
          onPress={() => setActiveFilter('all')}
        />
      ) : null}

      {visibleVacancies.map((item) => {
        const championship = toChampionshipCard(item)
        const isFavorite = wishlistIds.has(championship.id)
        return (
        <TouchableOpacity key={item.id} style={styles.card} onPress={() => onSelectChampionship?.(championship)}>
          <View style={styles.banner}>
            {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.bannerImage} /> : null}
            <Text style={styles.badge}>{item.tem_live ? 'LIVE' : String(item.tipo || 'VAGA').toUpperCase()}</Text>
            <TouchableOpacity
              style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
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
              <Text style={styles.favoriteText}>{isFavorite ? '♥' : '♡'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            <Text style={styles.name}>{item.nome || 'Campeonato'}</Text>
            <View style={styles.metrics}>
              <MetricPill label="inscrição" value={money(item.valor_inscricao)} />
              <MetricPill label="premiação" value={item.descricao_premiacao || money(item.premiacao)} />
            </View>
            <Text style={styles.meta}>{Number(item.vagas_livres || 0)} de {Number(item.total_vagas || 0)} vagas livres · {dateLabel(item)}</Text>
            <Text style={styles.meta}>{[item.plataforma, item.servidor].filter(Boolean).join(' · ') || 'Formato competitivo'}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.secondaryAction}
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
                <Text style={styles.secondaryActionText}>Adicionar ao carrinho</Text>
              </TouchableOpacity>
              <Text style={styles.cta}>Garantir vaga</Text>
            </View>
          </View>
        </TouchableOpacity>
        )
      })}

      <ActionCard
        title="Compra guiada"
        description="Depois do pagamento, o app leva direto para equipe, elenco, vaga no grupo e escalação."
        cta="Fluxo planejado"
      />
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filter: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: typography.caption,
  },
  filterTextActive: {
    color: colors.surface,
  },
  loading: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
  commerceSummary: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
    gap: spacing.xs,
  },
  commerceTitle: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  commerceText: {
    color: colors.surface,
    fontWeight: '800',
  },
  card: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  banner: {
    height: 150,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    height: undefined,
    width: undefined,
    resizeMode: 'cover',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    color: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.tiny,
    fontWeight: '900',
  },
  favoriteButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,.72)',
  },
  favoriteButtonActive: {
    backgroundColor: colors.brand,
  },
  favoriteText: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '900',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  name: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  meta: {
    color: colors.muted,
    fontWeight: '700',
  },
  cta: {
    color: colors.brand,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cardActions: {
    gap: spacing.sm,
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
