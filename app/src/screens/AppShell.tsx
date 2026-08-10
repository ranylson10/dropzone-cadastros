import { ComponentProps, ReactNode, useEffect, useRef, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { externalUrl } from '@/config/env'
import { MobileAccount } from '@/lib/auth'
import { colors } from '@/theme/tokens'
import { MobileRoute } from '@/types/dropzone'

type TabId = 'home' | 'championships' | 'teams' | 'agenda' | 'rank'
type IconName = ComponentProps<typeof Ionicons>['name']

const tabs: Array<{ id: TabId; label: string; icon: IconName; iconActive: IconName; route: MobileRoute }> = [
  { id: 'home', label: 'Início', icon: 'home-outline', iconActive: 'home', route: 'home' },
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
  profile_create: 'home',
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
          <Text style={styles.brandName}>DROPZONE</Text>
        </TouchableOpacity>

        <View style={styles.topActions}>
          <TouchableOpacity
            accessibilityLabel="Busca global"
            hitSlop={8}
            style={[styles.topActionButton, props.route === 'search' && styles.topActionButtonActive]}
            onPress={() => props.onNavigate('search')}
          >
            <Ionicons name={props.route === 'search' ? 'search' : 'search-outline'} size={20} color={props.route === 'search' ? colors.brand : colors.surface} />
          </TouchableOpacity>

          {props.isAuthenticated ? (
            <TouchableOpacity accessibilityLabel="Trocar perfil" hitSlop={6} style={styles.profileAvatar} onPress={() => setProfileOpen(true)}>
              <AccountAvatar account={props.activeAccount} size={32} />
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
              <Ionicons name={active ? tab.iconActive : tab.icon} size={21} color={active ? colors.brand : '#9ba6b4'} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
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

            <View style={styles.menuUtilityRow}>
              <TouchableOpacity
                style={styles.menuUtilityButton}
                onPress={() => {
                  setProfileOpen(false)
                  props.onNavigate('wallet')
                }}
              >
                <Ionicons name="wallet-outline" size={17} color={colors.ink} />
                <Text style={styles.menuUtilityText}>Carteira</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuUtilityButton}
                onPress={() => {
                  setProfileOpen(false)
                  setLanguageOpen(true)
                }}
              >
                <Ionicons name="language-outline" size={17} color={colors.ink} />
                <Text style={styles.menuUtilityText}>Idioma</Text>
              </TouchableOpacity>
            </View>

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
                <Text style={styles.languageName}>Português (Brasil)</Text>
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
  if (value === 'broadcast') return 'Transmissão'
  return 'Conta'
}

function getInitial(name?: string | null) {
  const clean = (name || 'D').trim()
  return clean.slice(0, 1).toUpperCase()
}

const styles = StyleSheet.create({
  shell:{flex:1,backgroundColor:colors.background},
  topbar:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:10,backgroundColor:'#0d141e',borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,.07)'},
  brandSide:{height:38,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:2},
  systemLogo:{width:28,height:28},
  brandName:{color:colors.surface,fontSize:11,fontWeight:'900',letterSpacing:1.4},
  topActions:{flexDirection:'row',alignItems:'center',gap:5},
  loginButton:{height:34,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:10,borderRadius:8,backgroundColor:'rgba(255,255,255,.07)'},
  loginButtonText:{color:colors.surface,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  topActionButton:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:8,backgroundColor:'rgba(255,255,255,.055)'},
  topActionButtonActive:{backgroundColor:'rgba(255,64,88,.12)'},
  profileAvatar:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:9,backgroundColor:'rgba(255,255,255,.06)',overflow:'hidden'},
  accountImage:{backgroundColor:'#202735'},
  avatarFallback:{alignItems:'center',justifyContent:'center',backgroundColor:'#202735'},
  profileInitial:{color:colors.surface,fontSize:14,fontWeight:'900'},
  profileInitialDark:{color:colors.surface},
  content:{flex:1},
  liliFab:{position:'absolute',right:12,width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:colors.purple,shadowColor:'#000',shadowOpacity:.16,shadowOffset:{width:0,height:5},shadowRadius:9,elevation:5},
  liliText:{color:colors.surface,fontSize:10,fontWeight:'900'},
  bottomBar:{flexDirection:'row',alignItems:'stretch',paddingHorizontal:4,paddingTop:3,backgroundColor:'#0d141e',borderTopWidth:1,borderTopColor:'rgba(255,255,255,.08)'},
  tab:{flex:1,minWidth:0,minHeight:48,alignItems:'center',justifyContent:'center',gap:1,borderTopWidth:2,borderTopColor:'transparent'},
  tabActive:{borderTopColor:colors.brand,backgroundColor:'rgba(255,255,255,.025)'},
  tabLabel:{color:'#8f9aaa',fontSize:7,fontWeight:'800'},
  tabLabelActive:{color:colors.surface,fontWeight:'900'},
  modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.42)',alignItems:'flex-end',paddingTop:64,paddingRight:10},
  profileMenu:{width:278,backgroundColor:colors.surface,padding:12,gap:7,borderRadius:10,borderWidth:1,borderColor:colors.line,shadowColor:'#000',shadowOpacity:.18,shadowRadius:14,elevation:7},
  profileHeader:{flexDirection:'row',alignItems:'center',gap:10,paddingBottom:8,borderBottomWidth:1,borderBottomColor:colors.line},
  profileTextBlock:{flex:1},
  menuName:{color:colors.ink,fontSize:13,fontWeight:'900'},
  menuType:{color:colors.brand,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  accountOption:{minHeight:50,flexDirection:'row',alignItems:'center',gap:9,borderRadius:8,borderWidth:1,borderColor:colors.line,paddingHorizontal:9,paddingVertical:6},
  accountOptionActive:{borderColor:'rgba(255,64,88,.42)',backgroundColor:'#fff6f7'},
  accountCopy:{flex:1,minWidth:0},
  accountName:{color:colors.ink,fontSize:11,fontWeight:'900'},
  accountType:{color:colors.muted,fontSize:8,fontWeight:'800',textTransform:'uppercase'},
  panelButton:{minHeight:40,alignItems:'center',justifyContent:'center',borderRadius:8,backgroundColor:colors.brandDark},
  panelButtonText:{color:colors.surface,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  signOutButton:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:8,borderWidth:1,borderColor:colors.line},
  signOutButtonText:{color:colors.muted,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  menuUtilityRow:{flexDirection:'row',gap:6},
  menuUtilityButton:{flex:1,minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:8,backgroundColor:'#f2eee7'},
  menuUtilityText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  languageMenu:{width:270,backgroundColor:colors.surface,borderRadius:10,borderWidth:1,borderColor:colors.line,padding:12,gap:7,shadowColor:'#000',shadowOpacity:.18,shadowRadius:14,elevation:7},
  languageTitle:{color:colors.ink,fontSize:14,fontWeight:'900',textTransform:'uppercase',marginBottom:2},
  languageOption:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:10,paddingVertical:7,borderRadius:8,borderWidth:1,borderColor:colors.line},
  languageOptionActive:{borderColor:'rgba(255,64,88,.42)',backgroundColor:'#fff6f7'},
  languageOptionDisabled:{opacity:.55},
  languageName:{color:colors.ink,fontSize:11,fontWeight:'900'},
  languageHint:{marginTop:1,color:colors.muted,fontSize:8,fontWeight:'700'},
})
