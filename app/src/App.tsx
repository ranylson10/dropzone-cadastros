import { useState } from 'react'
import { ActivityIndicator, Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native'
import { AuthProvider, useAuth } from '@/lib/auth'
import { AgendaScreen } from '@/screens/AgendaScreen'
import { AppErrorBoundary } from '@/screens/AppErrorBoundary'
import { AppShell } from '@/screens/AppShell'
import { CommerceScreen } from '@/screens/CommerceScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { InvitesScreen } from '@/screens/InvitesScreen'
import { LiliScreen } from '@/screens/LiliScreen'
import { LineupScreen } from '@/screens/LineupScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { MyChampionshipsScreen } from '@/screens/MyChampionshipsScreen'
import { ProducerOverviewScreen } from '@/screens/ProducerOverviewScreen'
import { RankScreen } from '@/screens/RankScreen'
import { SellerSalesScreen } from '@/screens/SellerSalesScreen'
import { TeamRosterScreen } from '@/screens/TeamRosterScreen'
import { PurchaseClaimScreen } from '@/screens/PurchaseClaimScreen'
import { VacanciesScreen } from '@/screens/VacanciesScreen'
import { WalletScreen } from '@/screens/WalletScreen'
import { colors } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute, ProfileType } from '@/types/dropzone'

export default function App() {
  return (
    <AuthProvider>
      <DropZoneMobileApp />
    </AuthProvider>
  )
}

function DropZoneMobileApp() {
  const auth = useAuth()
  const [route, setRoute] = useState<MobileRoute>('home')
  const [demoProfileType, setDemoProfileType] = useState<ProfileType>('equipe')
  const [selectedChampionship, setSelectedChampionship] = useState<ChampionshipCard | null>(null)
  const profileType = auth.session ? auth.activeProfileType : demoProfileType
  const screenProps = {
    profileType,
    onNavigate: setRoute,
    onBack: () => setRoute('home'),
    selectedChampionship,
    onSelectChampionship: (championship: ChampionshipCard) => {
      setSelectedChampionship(championship)
      setRoute('purchase_claim')
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
    if (!auth.session) return <LoginScreen />
    if (route === 'home') {
      return (
        <HomeScreen
          profile={profileType}
          onProfileChange={setDemoProfileType}
          onNavigate={setRoute}
          accounts={auth.accounts}
          activeAccount={auth.activeAccount}
          onSelectAccount={auth.setActiveAccountId}
          onSignOut={auth.signOut}
          onSelectChampionship={screenProps.onSelectChampionship}
        />
      )
    }
    if (route === 'vacancies') return <VacanciesScreen {...screenProps} />
    if (route === 'purchase_claim') return <PurchaseClaimScreen {...screenProps} />
    if (route === 'my_championships') return <MyChampionshipsScreen {...screenProps} />
    if (route === 'lineup') return <LineupScreen {...screenProps} />
    if (route === 'agenda') return <AgendaScreen {...screenProps} />
    if (route === 'wallet') return <WalletScreen {...screenProps} />
    if (route === 'commerce') return <CommerceScreen {...screenProps} />
    if (route === 'invites') return <InvitesScreen {...screenProps} />
    if (route === 'team_roster') return <TeamRosterScreen {...screenProps} />
    if (route === 'seller_sales') return <SellerSalesScreen {...screenProps} />
    if (route === 'producer_overview') return <ProducerOverviewScreen {...screenProps} />
    if (route === 'rank') return <RankScreen {...screenProps} />
    if (route === 'lili') return <LiliScreen {...screenProps} />
    return <HomeScreen
      profile={profileType}
      onProfileChange={setDemoProfileType}
      onNavigate={setRoute}
      accounts={auth.accounts}
      activeAccount={auth.activeAccount}
      onSelectAccount={auth.setActiveAccountId}
      onSignOut={auth.signOut}
      onSelectChampionship={screenProps.onSelectChampionship}
    />
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandDark} />
      <AppErrorBoundary onReset={() => setRoute('home')}>
        {auth.session ? (
          <AppShell route={route} activeAccount={auth.activeAccount} onNavigate={setRoute}>
            {renderScreen()}
          </AppShell>
        ) : renderScreen()}
      </AppErrorBoundary>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    paddingBottom: Platform.OS === 'android' ? 16 : 0,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
})
