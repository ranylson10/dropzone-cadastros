import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, StatusBar, StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/lib/auth'
import { AgendaScreen } from '@/screens/AgendaScreen'
import { AppErrorBoundary } from '@/screens/AppErrorBoundary'
import { AppShell } from '@/screens/AppShell'
import { ChampionshipActionsScreen } from '@/screens/ChampionshipActionsScreen'
import { ChampionshipDirectoryScreen } from '@/screens/ChampionshipDirectoryScreen'
import { ChampionshipPublicScreen } from '@/screens/ChampionshipPublicScreen'
import { ChampionshipManagementScreen } from '@/screens/ChampionshipManagementScreen'
import { CommerceScreen } from '@/screens/CommerceScreen'
import { ControlPanelScreen } from '@/screens/ControlPanelScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { InvitesScreen } from '@/screens/InvitesScreen'
import { LiliScreen } from '@/screens/LiliScreen'
import { LineupScreen } from '@/screens/LineupScreen'
import { LineManagementScreen } from '@/screens/LineManagementScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { MyChampionshipsScreen } from '@/screens/MyChampionshipsScreen'
import { ProducerOverviewScreen } from '@/screens/ProducerOverviewScreen'
import { ProfileManagementScreen } from '@/screens/ProfileManagementScreen'
import { ProfileCreateScreen } from '@/screens/ProfileCreateScreen'
import { PlayerDirectoryScreen } from '@/screens/PlayerDirectoryScreen'
import { PlayerDashboardScreen } from '@/screens/PlayerDashboardScreen'
import { PlayerPublicScreen } from '@/screens/PlayerPublicScreen'
import { RankScreen } from '@/screens/RankScreen'
import { SellerSalesScreen } from '@/screens/SellerSalesScreen'
import { GlobalSearchScreen } from '@/screens/GlobalSearchScreen'
import { TeamDirectoryScreen } from '@/screens/TeamDirectoryScreen'
import { TeamPublicScreen } from '@/screens/TeamPublicScreen'
import { TeamCreateScreen } from '@/screens/TeamCreateScreen'
import { TeamRosterScreen } from '@/screens/TeamRosterScreen'
import { PurchaseClaimScreen } from '@/screens/PurchaseClaimScreen'
import { WalletScreen } from '@/screens/WalletScreen'
import { TokenActionScreen } from '@/screens/TokenActionScreen'
import { QuickTokenResult, resolveQuickToken } from '@/lib/api'
import { parseMobileDeepLink } from '@/lib/deepLinks'
import { loadNavigationState, saveNavigationState } from '@/lib/navigationState'
import { colors } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute, ProfileType } from '@/types/dropzone'
import { LineupSummary } from '@/lib/lineups'

const PUBLIC_ROUTES = new Set<MobileRoute>([
  'home',
  'search',
  'vacancies',
  'championship_public',
  'team_directory',
  'team_public',
  'player_directory',
  'player_public',
  'rank',
  'token_action',
])

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <DropZoneMobileApp />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

function DropZoneMobileApp() {
  const auth = useAuth()
  const [route, setRoute] = useState<MobileRoute>('home')
  const [loginOpen, setLoginOpen] = useState(false)
  const [pendingRoute, setPendingRoute] = useState<MobileRoute | null>(null)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const [selectedChampionship, setSelectedChampionship] = useState<ChampionshipCard | null>(null)
  const [selectedAdminChampionshipId, setSelectedAdminChampionshipId] = useState<string | null>(null)
  const [selectedLineup, setSelectedLineup] = useState<LineupSummary | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedTokenAction, setSelectedTokenAction] = useState<QuickTokenResult | null>(null)
  const [profileCreationType, setProfileCreationType] = useState<ProfileType>('equipe')
  const routeHistoryRef = useRef<MobileRoute[]>([])
  const navigationRestoredRef = useRef(false)
  const profileType = auth.activeProfileType

  const lastDeepLinkRef = useRef('')

  useEffect(() => {
    if(auth.loading||navigationRestoredRef.current)return
    navigationRestoredRef.current=true
    void loadNavigationState().then(saved=>{
      if(!saved)return
      if(saved.championship)setSelectedChampionship(saved.championship)
      if(saved.teamId)setSelectedTeamId(saved.teamId)
      if(saved.playerId)setSelectedPlayerId(saved.playerId)
      setRoute(saved.route)
    })
  },[auth.loading])

  useEffect(() => {
    if(auth.loading||!navigationRestoredRef.current)return
    void saveNavigationState({
      route,
      championship:selectedChampionship,
      teamId:selectedTeamId,
      playerId:selectedPlayerId,
    })
  },[auth.loading,route,selectedChampionship,selectedPlayerId,selectedTeamId])

  useEffect(() => {
    let mounted = true

    async function handleDeepLink(url:string|null){
      if(!url||lastDeepLinkRef.current===url)return
      const target=parseMobileDeepLink(url)
      if(target.kind==='ignore')return
      lastDeepLinkRef.current=url

      if(target.kind==='route'){
        navigate(target.route)
        return
      }
      if(target.kind==='championship'){
        setSelectedChampionship({
          id:target.id,
          name:'Campeonato',
          mode:'competitivo',
          priceLabel:'Ver campeonato',
          freeSlots:0,
        })
        setRouteWithHistory('championship_public')
        return
      }
      if(target.kind==='team'){
        setSelectedTeamId(target.id)
        setRouteWithHistory('team_public')
        return
      }
      if(target.kind==='player'){
        setSelectedPlayerId(target.id)
        setRouteWithHistory('player_public')
        return
      }
      if(target.kind==='token'){
        try{
          const result=await resolveQuickToken(target.token,auth.session?.access_token)
          if(!mounted)return
          setSelectedTokenAction(result)
          if(auth.session)setRouteWithHistory('token_action')
          else requireLogin('token_action')
        }catch{
          if(!mounted)return
          setRoute('home')
        }
      }
    }

    Linking.getInitialURL().then(handleDeepLink).catch(()=>null)
    const subscription=Linking.addEventListener('url',event=>{void handleDeepLink(event.url)})
    return()=>{
      mounted=false
      subscription.remove()
    }
  }, [auth.session?.access_token])


  useEffect(() => {
    if (!auth.session || !loginOpen) return
    setLoginOpen(false)
    const nextRoute = pendingRoute
    const action = pendingActionRef.current
    setPendingRoute(null)
    pendingActionRef.current = null
    if (nextRoute) setRoute(nextRoute)
    action?.()
  }, [auth.session, loginOpen, pendingRoute])

  function requireLogin(nextRoute?: MobileRoute, action?: () => void) {
    if (auth.session) {
      if (nextRoute) setRoute(nextRoute)
      action?.()
      return true
    }
    setPendingRoute(nextRoute || null)
    pendingActionRef.current = action || null
    setLoginOpen(true)
    return false
  }

  function setRouteWithHistory(nextRoute:MobileRoute,replace=false){
    if(nextRoute===route)return
    if(!replace){
      const history=routeHistoryRef.current
      if(history[history.length-1]!==route)history.push(route)
      if(history.length>20)history.shift()
    }
    setRoute(nextRoute)
  }

  function goBack(){
    const previous=routeHistoryRef.current.pop()
    if(previous){
      setLoginOpen(false)
      setRoute(previous)
      return
    }
    if(route!=='home'){
      setRoute('home')
      return
    }
  }

  function navigate(nextRoute: MobileRoute) {
    if (!auth.session && !PUBLIC_ROUTES.has(nextRoute)) {
      requireLogin(nextRoute)
      return
    }
    setLoginOpen(false)
    setRouteWithHistory(nextRoute)
  }

  const screenProps = {
    profileType,
    onNavigate: navigate,
    onBack: goBack,
    selectedChampionship,
    selectedAdminChampionshipId,
    selectedLineup,
    selectedTeamId,
    selectedLineId,
    selectedPlayerId,
    requireAuth: (action?: () => void) => requireLogin(undefined, action),
    onSelectChampionship: (championship: ChampionshipCard) => {
      setSelectedChampionship(championship)
      setRoute('championship_public')
    },
    onManageChampionship: (championshipId?: string | null) => {
      setSelectedAdminChampionshipId(championshipId || null)
      requireLogin('championship_management')
    },
    onCreateChampionship: () => {
      setSelectedAdminChampionshipId('__create__')
      requireLogin('championship_management')
    },
    onSelectLineup: (lineup?: LineupSummary | null) => {
      setSelectedLineup(lineup || null)
      requireLogin('championship_actions')
    },
    onSelectTeam: (teamId: string) => {
      setSelectedTeamId(teamId)
      setRoute('team_public')
    },
    onManageTeam: (teamId: string) => {
      setSelectedTeamId(teamId)
      requireLogin('team_roster')
    },
    onManageLine: (teamId: string, lineId: string) => {
      setSelectedTeamId(teamId)
      setSelectedLineId(lineId)
      requireLogin('line_management')
    },
    onSelectPlayer: (playerId: string) => {
      setSelectedPlayerId(playerId)
      setRoute('player_public')
    },
  }

  function renderScreen() {
    if (auth.loading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )
    }

    if (loginOpen && !auth.session) {
      return (
        <LoginScreen
          onCancel={() => {
            setLoginOpen(false)
            setPendingRoute(null)
            pendingActionRef.current = null
          }}
        />
      )
    }

    if (route === 'search') return <GlobalSearchScreen {...screenProps} />
    if (route === 'home') {
      return (
        <HomeScreen
          onNavigate={navigate}
          accounts={auth.accounts}
          onSelectChampionship={screenProps.onSelectChampionship}
          accessToken={auth.session?.access_token}
          onCreateChampionship={screenProps.onCreateChampionship}
          onTokenResolved={(result) => { setSelectedTokenAction(result); if(auth.session)setRouteWithHistory('token_action'); else requireLogin('token_action') }}
          requireAuth={(action) => requireLogin(undefined, action)}
        />
      )
    }
    if (route === 'vacancies') return <ChampionshipDirectoryScreen {...screenProps} />
    if (route === 'championship_public') return <ChampionshipPublicScreen {...screenProps} />
    if (route === 'championship_management') return <ChampionshipManagementScreen {...screenProps} />
    if (route === 'purchase_claim') return <PurchaseClaimScreen {...screenProps} />
    if (route === 'championship_actions') return <ChampionshipActionsScreen {...screenProps} />
    if (route === 'my_championships') return <MyChampionshipsScreen {...screenProps} />
    if (route === 'lineup') return <LineupScreen {...screenProps} />
    if (route === 'line_management') return <LineManagementScreen {...screenProps} />
    if (route === 'agenda') return <AgendaScreen {...screenProps} />
    if (route === 'wallet') return <WalletScreen {...screenProps} />
    if (route === 'commerce') return <CommerceScreen {...screenProps} />
    if (route === 'dashboard') return <ControlPanelScreen {...screenProps} />
    if (route === 'profile_management') return <ProfileManagementScreen {...screenProps} />
    if (route === 'profile_create') return <ProfileCreateScreen profileType={profileCreationType} onCancel={goBack} onCreated={async (profileId) => { await auth.refreshAccounts(); if (profileId) auth.setActiveAccountId(profileId); setRouteWithHistory(selectedTokenAction ? 'token_action' : 'dashboard', true) }} />
    if (route === 'invites') return <InvitesScreen {...screenProps} />
    if (route === 'team_directory') return <TeamDirectoryScreen {...screenProps} />
    if (route === 'team_public') return <TeamPublicScreen {...screenProps} />
    if (route === 'team_create') return <TeamCreateScreen {...screenProps} />
    if (route === 'team_roster') return <TeamRosterScreen {...screenProps} />
    if (route === 'player_directory') return <PlayerDirectoryScreen {...screenProps} />
    if (route === 'player_dashboard') return <PlayerDashboardScreen {...screenProps} />
    if (route === 'player_public') return <PlayerPublicScreen {...screenProps} />
    if (route === 'seller_sales') return <SellerSalesScreen {...screenProps} />
    if (route === 'producer_overview') return <ProducerOverviewScreen {...screenProps} />
    if (route === 'rank') return <RankScreen {...screenProps} />
    if (route === 'lili') return <LiliScreen {...screenProps} />
    if (route === 'token_action') return <TokenActionScreen
      result={selectedTokenAction}
      onBack={goBack}
      accessToken={auth.session?.access_token}
      requireLogin={() => { requireLogin('token_action') }}
      accounts={auth.accounts}
      onCreateProfile={(type) => { setProfileCreationType(type); setRouteWithHistory('profile_create') }}
      onCompleted={(result)=>{
        if(result.kind==='team_roster_invite') void auth.refreshAccounts()
      }}
    />
    return (
      <HomeScreen
        onNavigate={navigate}
        accounts={auth.accounts}
        accessToken={auth.session?.access_token}
        onCreateChampionship={screenProps.onCreateChampionship}
        onSelectChampionship={screenProps.onSelectChampionship}
        onTokenResolved={(result) => { setSelectedTokenAction(result); if(auth.session)setRouteWithHistory('token_action'); else requireLogin('token_action') }}
          requireAuth={(action) => requireLogin(undefined, action)}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDark} />
      <AppErrorBoundary
        onReset={() => {
          setLoginOpen(false)
          routeHistoryRef.current=[]
          setRoute('home')
        }}
      >
        <AppShell
          route={route}
          activeAccount={auth.activeAccount}
          accounts={auth.accounts}
          isAuthenticated={Boolean(auth.session)}
          onRequestLogin={() => requireLogin()}
          onSelectAccount={auth.setActiveAccountId}
          onSignOut={auth.signOut}
          onNavigate={navigate}
        >
          {renderScreen()}
        </AppShell>
      </AppErrorBoundary>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brandDark,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
})
