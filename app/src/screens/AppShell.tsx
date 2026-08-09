import { ReactNode, useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MobileAccount } from '@/lib/auth'
import { colors, spacing, typography } from '@/theme/tokens'
import { MobileRoute } from '@/types/dropzone'

type TabId = 'home' | 'camp' | 'teams' | 'players' | 'wallet'

const tabs: Array<{ id: TabId; label: string; icon: string; route: MobileRoute }> = [
  { id: 'home', label: 'Home', icon: '⌂', route: 'home' },
  { id: 'camp', label: 'Camp.', icon: '🏆', route: 'vacancies' },
  { id: 'teams', label: 'Equipes', icon: '👥', route: 'team_roster' },
  { id: 'players', label: 'Players', icon: '🎮', route: 'rank' },
  { id: 'wallet', label: 'Carteira', icon: '▣', route: 'wallet' },
]

const tabByRoute: Partial<Record<MobileRoute, TabId>> = {
  home: 'home',
  vacancies: 'camp',
  purchase_claim: 'camp',
  my_championships: 'camp',
  producer_overview: 'camp',
  team_roster: 'teams',
  lineup: 'teams',
  invites: 'teams',
  rank: 'players',
  agenda: 'players',
  wallet: 'wallet',
  commerce: 'wallet',
  seller_sales: 'wallet',
}

export function AppShell(props: {
  children: ReactNode
  route: MobileRoute
  activeAccount?: MobileAccount | null
  onNavigate: (route: MobileRoute) => void
}) {
  const activeTab = tabByRoute[props.route] || 'home'
  const fade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    fade.setValue(0)
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [fade, props.route])

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.brandSide} onPress={() => props.onNavigate('home')}>
          <View style={styles.logoMark} />
          <View>
            <Text style={styles.brand}>DROPZONE</Text>
            <Text style={styles.brandSub}>Mobile</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileButton} onPress={() => props.onNavigate('home')}>
          <Text style={styles.profileName} numberOfLines={1}>{props.activeAccount?.name || 'Perfil'}</Text>
          <Text style={styles.profileType} numberOfLines={1}>{props.activeAccount?.profile_type || 'conta'}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fade }]}>
        {props.children}
      </Animated.View>

      {props.route !== 'lili' ? (
        <TouchableOpacity style={styles.liliFab} onPress={() => props.onNavigate('lili')}>
          <Text style={styles.liliText}>Lili</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.bottomBar}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab
          return (
            <TouchableOpacity key={tab.id} style={[styles.tab, active && styles.tabActive]} onPress={() => props.onNavigate(tab.route)}>
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topbar: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: '#090f16',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brandSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.brand,
    transform: [{ rotate: '45deg' }],
  },
  brand: {
    color: colors.surface,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSub: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  profileButton: {
    maxWidth: 150,
    alignItems: 'flex-end',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileName: {
    color: colors.surface,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  profileType: {
    color: '#aeb6c0',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  liliFab: {
    position: 'absolute',
    right: spacing.md,
    bottom: 86,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
    shadowColor: colors.purple,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  liliText: {
    color: colors.surface,
    fontWeight: '900',
  },
  bottomBar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: '#090f16',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 18,
  },
  tabActive: {
    backgroundColor: 'rgba(255,64,88,0.16)',
  },
  tabIcon: {
    color: '#8d96a3',
    fontSize: 18,
  },
  tabIconActive: {
    color: colors.brand,
  },
  tabLabel: {
    color: '#8d96a3',
    fontSize: 10,
    fontWeight: '900',
  },
  tabLabelActive: {
    color: colors.surface,
  },
})
