import { useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { MobileAccount, useAuth } from '@/lib/auth'
import { getMobileCart, getMobileWishlist, mobileCommerceFromApi, MobileCommerceItem } from '@/lib/commerce'
import { toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { actionsForProfile } from '@/navigation/mobileExperience'
import { ProfileSwitcher } from '@/screens/ProfileSwitcher'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute, ProfileType } from '@/types/dropzone'

const fallbackProfiles: Array<{ id: ProfileType; label: string }> = [
  { id: 'equipe', label: 'Equipe' },
  { id: 'jogador', label: 'Jogador' },
  { id: 'manager', label: 'Vendedor' },
  { id: 'produtora', label: 'Produtora' },
]

const priorityActionsByProfile: Record<ProfileType, string[]> = {
  equipe: ['my_championships', 'lineup', 'team_roster', 'agenda'],
  jogador: ['my_championships', 'browse_vacancies', 'agenda', 'invites'],
  manager: ['seller_sales', 'browse_vacancies', 'my_championships', 'wallet'],
  produtora: ['producer_overview', 'my_championships', 'agenda', 'wallet'],
  broadcast: ['my_championships', 'agenda', 'lili', 'rank'],
}

function routeForAction(action: string): MobileRoute {
  if (action === 'browse_vacancies' || action === 'buy_slot') return 'vacancies'
  return action as MobileRoute
}

export function HomeScreen(props: {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
  onNavigate: (route: MobileRoute) => void
  accounts?: MobileAccount[]
  activeAccount?: MobileAccount | null
  onSelectAccount?: (id: string) => void
  onSignOut?: () => void
  onSelectChampionship?: (championship: ChampionshipCard) => void
}) {
  const { profile, onProfileChange, onNavigate } = props
  const auth = useAuth()
  const allActions = useMemo(() => actionsForProfile(profile), [profile])
  const mainActions = useMemo(() => {
    const order = priorityActionsByProfile[profile] || []
    return order
      .map((id) => allActions.find((action) => action.id === id))
      .filter(Boolean)
      .slice(0, 4) as typeof allActions
  }, [allActions, profile])
  const secondaryActions = useMemo(() => allActions.filter((action) => !mainActions.some((main) => main.id === action.id)).slice(0, 5), [allActions, mainActions])
  const [vacancies, setVacancies] = useState<ChampionshipCard[]>([])
  const [cart, setCart] = useState<MobileCommerceItem[]>([])
  const [wishlist, setWishlist] = useState<MobileCommerceItem[]>([])

  useEffect(() => {
    let mounted = true
    mobileApi.vacancies()
      .then((response) => {
        if (!mounted) return
        setVacancies(((response.announcements as VacancyApiItem[]) || []).slice(0, 2).map(toChampionshipCard))
      })
      .catch(() => mounted && setVacancies([]))
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const accessToken = auth.session?.access_token
    const cartPromise = accessToken ? mobileApi.commerceCart(accessToken).then((payload) => payload.items.map(mobileCommerceFromApi)) : getMobileCart()
    const wishlistPromise = accessToken ? mobileApi.commerceWishlist(accessToken).then((payload) => payload.items.map(mobileCommerceFromApi)) : getMobileWishlist()
    Promise.all([cartPromise.catch(() => getMobileCart()), wishlistPromise.catch(() => getMobileWishlist())]).then(([cartItems, wishlistItems]) => {
      if (!mounted) return
      setCart(cartItems)
      setWishlist(wishlistItems)
    })
    return () => {
      mounted = false
    }
  }, [auth.session?.access_token])

  const cartQuantity = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0)

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>DropZone</Text>
          <TouchableOpacity style={styles.liliButton} onPress={() => onNavigate('lili')}>
            <Text style={styles.liliText}>Lili</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Resolva rápido</Text>
        <Text style={styles.subtitle}>Campeonatos, escalação, agenda e vagas em poucos toques.</Text>
      </View>

      {props.accounts?.length && props.onSelectAccount && props.onSignOut ? (
        <ProfileSwitcher
          accounts={props.accounts}
          activeAccount={props.activeAccount || null}
          onSelect={props.onSelectAccount}
          onSignOut={props.onSignOut}
        />
      ) : (
        <View style={styles.profileGrid}>
          {fallbackProfiles.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.profileButton, profile === item.id && styles.profileButtonActive]}
              onPress={() => onProfileChange(item.id)}
            >
              <Text style={[styles.profileText, profile === item.id && styles.profileTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Principais</Text>
        <View style={styles.primaryGrid}>
          {mainActions.map((action) => (
            <TouchableOpacity key={action.id} style={styles.primaryCard} onPress={() => onNavigate(routeForAction(action.id))}>
              <Text style={styles.primaryTitle}>{action.title}</Text>
              <Text style={styles.primaryText} numberOfLines={2}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.statusRow}>
        <TouchableOpacity style={styles.statusCard} onPress={() => onNavigate('commerce')}>
          <Text style={styles.statusNumber}>{cartQuantity}</Text>
          <Text style={styles.statusLabel}>no carrinho</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statusCard} onPress={() => onNavigate('commerce')}>
          <Text style={styles.statusNumber}>{wishlist.length}</Text>
          <Text style={styles.statusLabel}>favoritos</Text>
        </TouchableOpacity>
      </View>

      {vacancies.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vagas em destaque</Text>
            <TouchableOpacity onPress={() => onNavigate('vacancies')}>
              <Text style={styles.sectionLink}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {vacancies.map((championship) => (
            <TouchableOpacity
              key={championship.id}
              style={styles.vacancyCard}
              onPress={() => props.onSelectChampionship ? props.onSelectChampionship(championship) : onNavigate('vacancies')}
            >
              <View style={styles.vacancyBanner}>
                {championship.bannerUrl ? <Image source={{ uri: championship.bannerUrl }} style={styles.bannerImage} /> : null}
              </View>
              <View style={styles.vacancyInfo}>
                <Text style={styles.vacancyTitle} numberOfLines={1}>{championship.name}</Text>
                <Text style={styles.vacancyMeta} numberOfLines={1}>{championship.priceLabel} · {championship.freeSlots} vagas</Text>
                <Text style={styles.vacancyCta}>Garantir vaga</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {secondaryActions.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mais opções</Text>
          <View style={styles.list}>
            {secondaryActions.map((action) => (
              <TouchableOpacity key={action.id} style={styles.listItem} onPress={() => onNavigate(routeForAction(action.id))}>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{action.title}</Text>
                  <Text style={styles.listDescription} numberOfLines={1}>{action.description}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    borderRadius: 22,
    backgroundColor: colors.brandDark,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  liliButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  liliText: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: typography.caption,
  },
  title: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 33,
  },
  subtitle: {
    color: '#d6dae2',
    fontSize: typography.body,
    lineHeight: 21,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  profileButton: {
    flexGrow: 1,
    minWidth: '46%',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
  },
  profileButtonActive: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  profileText: {
    color: colors.ink,
    fontWeight: '900',
  },
  profileTextActive: {
    color: colors.surface,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  sectionLink: {
    color: colors.brand,
    fontWeight: '900',
    fontSize: typography.caption,
  },
  primaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryCard: {
    width: '48.5%',
    minHeight: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs,
  },
  primaryTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  primaryText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusCard: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
  },
  statusNumber: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: '900',
  },
  statusLabel: {
    color: colors.surface,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  vacancyCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  vacancyBanner: {
    width: 104,
    minHeight: 104,
    backgroundColor: colors.brandDark,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    resizeMode: 'cover',
  },
  vacancyInfo: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  vacancyTitle: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: typography.body,
  },
  vacancyMeta: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  vacancyCta: {
    marginTop: spacing.xs,
    color: colors.brand,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  list: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  listItem: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  listText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  listTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  listDescription: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption,
  },
  chevron: {
    color: colors.brand,
    fontSize: 28,
    fontWeight: '900',
  },
})
