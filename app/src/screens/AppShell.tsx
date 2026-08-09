import { ComponentProps, ReactNode, useEffect, useRef, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { externalUrl } from '@/config/env'
import { MobileAccount } from '@/lib/auth'
import { colors, spacing, typography } from '@/theme/tokens'
import { MobileRoute } from '@/types/dropzone'

type TabId = 'home' | 'championships' | 'teams' | 'agenda' | 'rank'
type IconName = ComponentProps<typeof Ionicons>['name']

const tabs: Array<{ id: TabId; label: string; icon: IconName; iconActive: IconName; route: MobileRoute }> = [
  { id: 'home', label: 'InÃ­cio', icon: 'home-outline', iconActive: 'home', route: 'home' },
  { id: 'championships', label: 'Camp.', icon: 'trophy-outline', iconActive: 'trophy', route: 'vacancies' },
  { id: 'teams', label: 'Equipes', icon: 'people-outline', iconActive: 'people', route: 'team_directory' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar-outline', iconActive: 'calendar', route: 'agenda' },
  { id: 'rank', label: 'Rank', icon: 'podium-outline', iconActive: 'podium', route: 'rank' },
]

const tabByRoute: Partial<Record<MobileRoute, TabId>> = {
  home: 'home',
  search: 'home',
  dashboard: 'home',
  profile_management: 'home',
  vacancies: 'championships',
  championship_public: 'championships',
  purchase_claim: 'championships',
  championship_actions: 'championships',
  my_championships: 'championships',
  producer_overview: 'championships',
  championship_management: 'championships',
  team_directory: 'teams',
  team_public: 'teams',
  team_roster: 'teams',
  team_create: 'teams',
  player_directory: 'rank',
  player_dashboard: 'home',
  player_public: 'rank',
  lineup: 'teams',
  line_management: 'teams',
  invites: 'teams',
  agenda: 'agenda',
  rank: 'rank',
}

export function AppShell(props: {
  children: ReactNode
  route: MobileRoute
  activeAccount?: MobileAccount | null
  accounts?: MobileAccount[]
  onSelectAccount?: (accountId: string) => void
  onSignOut?: () => void | Promise<void>
  isAuthenticated?: boolean
  onRequestLogin?: () => void
  onNavigate: (route: MobileRoute) => void
}) {
  const activeTab = tabByRoute[props.route] || 'home'
  const insets = useSafeAreaInsets()
  const fade = useRef(new Animated.Value(0)).current
  const [profileOpen, setProfileOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)

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
        <TouchableOpacity style={styles.brandSide} activeOpacity={0.8} onPress={() => props.onNavigate('home')}>
          <Image source={require('../../assets/dropzone-icon-accent.png')} style={styles.systemLogo} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.topActions}>
          <TouchableOpacity
            accessibilityLabel="Busca global"
            hitSlop={8}
            style={[styles.topActionButton, props.route === 'search' && styles.topActionButtonActive]}
            onPress={() => props.onNavigate('search')}
          >
            <Ionicons name={props.route === 'search' ? 'search' : 'search-outline'} size={24} color={props.route === 'search' ? colors.brand : colors.surface} />
          </TouchableOpacity>

          {props.isAuthenticated ? (
            <TouchableOpacity
              accessibilityLabel="Carteira"
              hitSlop={8}
              style={[styles.topActionButton, props.route === 'wallet' && styles.topActionButtonActive]}
              onPress={() => props.onNavigate('wallet')}
            >
              <Ionicons name={props.route === 'wallet' ? 'wallet' : 'wallet-outline'} size={25} color={props.route === 'wallet' ? colors.brand : colors.surface} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity accessibilityLabel="Selecionar idioma" hitSlop={8} style={styles.languageButton} onPress={() => setLanguageOpen(true)}>
            <Ionicons name="language-outline" size={23} color={colors.surface} />
          </TouchableOpacity>

          {props.isAuthenticated ? (
            <TouchableOpacity accessibilityLabel="Trocar perfil" hitSlop={6} style={styles.profileAvatar} onPress={() => setProfileOpen(true)}>
              <AccountAvatar account={props.activeAccount} size={38} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity accessibilityLabel="Entrar" hitSlop={8} style={styles.loginButton} onPress={props.onRequestLogin}>
              <Ionicons name="person-outline" size={19} color={colors.surface} />
              <Text style={styles.loginButtonText}>Entrar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.View style={[styles.content, { opacity: fade }]}>{props.children}</Animated.View>

      {props.route !== 'lili' ? (
        <TouchableOpacity style={[styles.liliFab, { bottom: 70 + insets.bottom }]} onPress={() => props.onNavigate('lili')}>
          <Text style={styles.liliText}>Lili</Text>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), minHeight: 56 + insets.bottom }]}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab
          return (
            <TouchableOpacity
              key={tab.id}
              accessibilityLabel={tab.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => props.onNavigate(tab.route)}
            >
              <Ionicons name={active ? tab.iconActive : tab.icon} size={29} color={active ? colors.brand : '#aab3bf'} />
            </TouchableOpacity>
          )
        })}
      </View>

      <Modal transparent visible={Boolean(props.isAuthenticated && profileOpen)} animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setProfileOpen(false)}>
          <View style={styles.profileMenu} onStartShouldSetResponder={() => true}>
            <View style={styles.profileHeader}>
              <AccountAvatar account={props.activeAccount} size={52} />
              <View style={styles.profileTextBlock}>
                <Text style={styles.menuName} numberOfLines={1}>{props.activeAccount?.name || 'Perfil'}</Text>
                <Text style={styles.menuType}>{profileLabel(props.activeAccount?.profile_type)}</Text>
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
                <AccountAvatar account={account} size={38} darkText />
                <View style={styles.accountCopy}>
                  <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
                  <Text style={styles.accountType}>{profileLabel(account.profile_type)}</Text>
                </View>
                {account.id === props.activeAccount?.id ? <Ionicons name="checkmark-circle" size={20} color={colors.brand} /> : null}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.panelButton}
              onPress={() => {
                setProfileOpen(false)
                props.onNavigate('dashboard')
              }}
            >
              <Text style={styles.panelButtonText}>Acessar painel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => {
                setProfileOpen(false)
                props.onNavigate('profile_management')
              }}
            >
              <Ionicons name="create-outline" size={19} color={colors.ink} />
              <Text style={[styles.signOutButtonText, { color: colors.ink }]}>Editar perfil</Text>
            </TouchableOpacity>

            {props.onSignOut ? (
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={() => {
                  setProfileOpen(false)
                  void props.onSignOut?.()
                }}
              >
                <Ionicons name="log-out-outline" size={19} color={colors.muted} />
                <Text style={styles.signOutButtonText}>Sair da conta</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal transparent visible={languageOpen} animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLanguageOpen(false)}>
          <View style={styles.languageMenu} onStartShouldSetResponder={() => true}>
            <Text style={styles.languageTitle}>Idioma do app</Text>
            <TouchableOpacity style={[styles.languageOption, styles.languageOptionActive]} onPress={() => setLanguageOpen(false)}>
              <View>
                <Text style={styles.languageName}>PortuguÃªs (Brasil)</Text>
                <Text style={styles.languageHint}>Idioma atual</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
            </TouchableOpacity>
            <View style={[styles.languageOption, styles.languageOptionDisabled]}>
              <View>
                <Text style={styles.languageName}>English</Text>
                <Text style={styles.languageHint}>Em breve</Text>
              </View>
              <Ionicons name="lock-closed-outline" size={19} color={colors.muted} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function AccountAvatar(props: { account?: MobileAccount | null; size: number; darkText?: boolean }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = resolveAccountImage(props.account)
  const isLogo = props.account?.profile_type === 'produtora' || props.account?.profile_type === 'equipe'
  const imageRadius = isLogo ? 8 : props.size / 2

  useEffect(() => setFailed(false), [imageUrl])

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.accountImage, { width: props.size, height: props.size, borderRadius: imageRadius }]}
        resizeMode={isLogo ? 'contain' : 'cover'}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <View style={[styles.avatarFallback, { width: props.size, height: props.size, borderRadius: imageRadius }]}>
      <Text style={[styles.profileInitial, props.darkText && styles.profileInitialDark]}>{getInitial(props.account?.name)}</Text>
    </View>
  )
}

function resolveAccountImage(account?: MobileAccount | null) {
  if (!account) return null
  const data = account.data || {}
  const candidate = [
    account.image_url,
    data.logo_url,
    data.avatar_url,
    data.foto_url,
    data.foto_perfil_url,
    data.image_url,
    data.imagem_url,
  ].find((value) => typeof value === 'string' && value.trim())

  if (!candidate || typeof candidate !== 'string') return null
  const clean = candidate.trim()
  if (clean.startsWith('//')) return `https:${clean}`
  return externalUrl(clean)
}

function profileLabel(value?: string | null) {
  if (value === 'produtora') return 'Produtora'
  if (value === 'equipe') return 'Equipe'
  if (value === 'jogador') return 'Jogador'
  if (value === 'manager') return 'Vendedor'
  if (value === 'broadcast') return 'TransmissÃ£o'
  return 'Conta'
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
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: '#090f16',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brandSide: {
    width: 40,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemLogo: {
    width: 36,
    height: 36,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  loginButton: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  loginButtonText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  topActionButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  topActionButtonActive: {
    borderColor: 'rgba(255,64,88,0.55)',
    backgroundColor: 'rgba(255,64,88,0.09)',
  },
  languageButton: {
    width: 38,
    height: 38,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  accountImage: {
    backgroundColor: '#202735',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202735',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  profileInitial: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '900',
  },
  profileInitialDark: {
    color: colors.surface,
  },
  content: {
    flex: 1,
  },
  liliFab: {
    position: 'absolute',
    right: spacing.md,
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
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 6,
    paddingTop: 4,
    backgroundColor: '#090f16',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  tabActive: {
    borderTopColor: colors.brand,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'flex-end',
    paddingTop: 76,
    paddingRight: spacing.md,
  },
  profileMenu: {
    width: 286,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
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
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  accountOptionActive: {
    borderColor: colors.brand,
    backgroundColor: '#fff2f4',
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
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
    backgroundColor: colors.brandDark,
  },
  panelButtonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  signOutButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
  },
  signOutButtonText: {
    color: colors.muted,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  languageMenu: {
    width: 274,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  languageTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  languageOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
  },
  languageOptionActive: {
    borderColor: colors.brand,
    backgroundColor: '#fff2f4',
  },
  languageOptionDisabled: {
    opacity: 0.55,
  },
  languageName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  languageHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
})
