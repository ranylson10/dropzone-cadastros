import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MobileAccount } from '@/lib/auth'
import { actionsForProfile } from '@/navigation/mobileExperience'
import { ProfileSwitcher } from '@/screens/ProfileSwitcher'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ChampionshipCard, MobileActionId, MobileRoute, ProfileType } from '@/types/dropzone'

const fallbackProfiles: Array<{ id: ProfileType; label: string }> = [
  { id: 'equipe', label: 'Equipe' },
  { id: 'jogador', label: 'Jogador' },
  { id: 'manager', label: 'Vendedor' },
  { id: 'produtora', label: 'Produtora' },
]

const routeByAction: Partial<Record<MobileActionId, MobileRoute>> = {
  browse_vacancies: 'vacancies',
  buy_slot: 'vacancies',
  my_championships: 'my_championships',
  lineup: 'lineup',
  team_roster: 'team_roster',
  agenda: 'agenda',
  invites: 'invites',
  wallet: 'wallet',
  commerce: 'commerce',
  rank: 'rank',
  lili: 'lili',
  seller_sales: 'seller_sales',
  producer_overview: 'producer_overview',
}

const primaryActions: MobileActionId[] = ['browse_vacancies', 'my_championships', 'lineup', 'agenda']

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
  const actions = actionsForProfile(profile)
  const featured = actions.filter((action) => primaryActions.includes(action.id)).slice(0, 4)
  const secondary = actions.filter((action) => !primaryActions.includes(action.id)).slice(0, 8)
  const activeName = props.activeAccount?.name || fallbackProfiles.find((item) => item.id === profile)?.label || 'Perfil'

  function go(actionId: MobileActionId) {
    const route = routeByAction[actionId]
    if (route) onNavigate(route)
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.logoMark} />
          <TouchableOpacity style={styles.liliButton} onPress={() => onNavigate('lili')}>
            <Text style={styles.liliText}>Lili</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.kicker}>DROPZONE MOBILE</Text>
        <Text style={styles.heroTitle}>O que você quer resolver?</Text>
        <Text style={styles.heroText}>Entre em vaga, acompanhe campeonato, escale elenco e veja pagamentos em poucos toques.</Text>
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

      <View style={styles.activeStrip}>
        <View>
          <Text style={styles.activeLabel}>{profile}</Text>
          <Text style={styles.activeName} numberOfLines={1}>{activeName}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Principais</Text>
        <View style={styles.grid}>
          {featured.map((action) => (
            <TouchableOpacity key={action.id} style={styles.primaryCard} onPress={() => go(action.id)}>
              <Text style={styles.primaryTitle}>{action.title}</Text>
              <Text style={styles.primaryDescription} numberOfLines={2}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mais ações</Text>
        <View style={styles.list}>
          {secondary.map((action) => (
            <TouchableOpacity key={action.id} style={styles.listItem} onPress={() => go(action.id)}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{action.title}</Text>
                <Text style={styles.listDescription} numberOfLines={1}>{action.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {
    borderRadius: 28,
    backgroundColor: colors.brandDark,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand,
    transform: [{ rotate: '45deg' }],
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
  },
  kicker: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 3,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroText: {
    color: '#d6dae2',
    fontSize: typography.body,
    lineHeight: 22,
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
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
  },
  profileButtonActive: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  profileText: {
    color: colors.muted,
    fontWeight: '900',
  },
  profileTextActive: {
    color: colors.surface,
  },
  activeStrip: {
    minHeight: 72,
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
  },
  activeLabel: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  activeName: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryCard: {
    width: '48%',
    minHeight: 132,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  primaryTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  primaryDescription: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  list: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
    paddingRight: spacing.sm,
  },
  listTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  listDescription: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  chevron: {
    color: colors.brand,
    fontSize: 26,
    fontWeight: '900',
  },
})
