import { ReactNode, useEffect, useRef, useState } from 'react'
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MobileAccount } from '@/lib/auth'
import { colors, spacing, typography } from '@/theme/tokens'
import { MobileRoute } from '@/types/dropzone'

type TabId = 'home' | 'camp' | 'teams' | 'players' | 'wallet'

const tabs: Array<{ id: TabId; label: string; icon: string; route: MobileRoute }> = [
  { id: 'home', label: 'Home', icon: '⌂', route: 'home' },
  { id: 'camp', label: 'Camp.', icon: '◎', route: 'vacancies' },
  { id: 'teams', label: 'Equipes', icon: '◇', route: 'team_roster' },
  { id: 'players', label: 'Players', icon: '△', route: 'rank' },
  { id: 'wallet', label: 'Carteira', icon: '▢', route: 'wallet' },
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
  accounts?: MobileAccount[]
  onSelectAccount?: (accountId: string) => void
  onNavigate: (route: MobileRoute) => void
}) {
  const activeTab = tabByRoute[props.route] || 'home'
  const fade = useRef(new Animated.Value(0)).current
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    fade.setValue(0)
    Animated.timing(fade, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start()
  }, [fade, props.route])

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.brandSide} onPress={() => props.onNavigate('home')}>
          <View style={styles.logoMark}>
            <View style={[styles.logoPiece, styles.logoPieceLeft]} />
            <View style={[styles.logoPiece, styles.logoPieceRight]} />
            <View style={[styles.logoPiece, styles.logoPieceBottom]} />
          </View>
          <View>
            <Text style={styles.brand}>DROPZONE</Text>
            <Text style={styles.brandSub}>Mobile</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileAvatar} onPress={() => setProfileOpen(true)}>
          <Text style={styles.profileInitial}>{getInitial(props.activeAccount?.name)}</Text>
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

      <Modal transparent visible={profileOpen} animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setProfileOpen(false)}>
          <View style={styles.profileMenu}>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileInitial}>{getInitial(props.activeAccount?.name)}</Text>
              </View>
              <View style={styles.profileTextBlock}>
                <Text style={styles.menuName} numberOfLines={1}>{props.activeAccount?.name || 'Perfil'}</Text>
                <Text style={styles.menuType}>{props.activeAccount?.profile_type || 'conta'}</Text>
              </View>
            </View>

            {(props.accounts || []).map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[styles.accountOption, account.id === props.activeAccount?.id && styles.accountOptionActive]}
                onPress={() => {
                  props.onSelectAccount?.(account.id)
                  setProfileOpen(false)
                }}
              >
                <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
                <Text style={styles.accountType}>{account.profile_type}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.panelButton}
              onPress={() => {
                setProfileOpen(false)
                props.onNavigate('home')
              }}
            >
              <Text style={styles.panelButtonText}>Acessar painel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function getInitial(name?: string | null) {
  const clean = (name || 'D').trim()
  return clean.slice(0, 1).toUpperCase()
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topbar: {
    minHeight: 64,
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
    width: 42,
    height: 36,
    position: 'relative',
  },
  logoPiece: {
    position: 'absolute',
    width: 18,
    height: 22,
    backgroundColor: colors.brand,
    borderRadius: 2,
    transform: [{ skewY: '-24deg' }],
  },
  logoPieceLeft: {
    left: 0,
    top: 0,
  },
  logoPieceRight: {
    right: 0,
    top: 0,
  },
  logoPieceBottom: {
    left: 12,
    bottom: 0,
    transform: [{ skewY: '24deg' }],
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
  profileAvatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  profileAvatarLarge: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.brandDark,
  },
  profileInitial: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    flex: 1,
  },
  liliFab: {
    position: 'absolute',
    right: spacing.md,
    bottom: 104,
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
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.18)',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    paddingTop: 76,
    paddingRight: spacing.md,
  },
  profileMenu: {
    width: 270,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  profileTextBlock: {
    flex: 1,
  },
  menuName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  menuType: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  accountOption: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: spacing.md,
  },
  accountOptionActive: {
    borderColor: colors.brand,
    backgroundColor: '#fff2f4',
  },
  accountName: {
    color: colors.ink,
    fontWeight: '900',
  },
  accountType: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  panelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.brandDark,
  },
  panelButtonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: typography.tiny,
  },
})
