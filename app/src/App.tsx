import { ActivityIndicator, Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native'
import { AuthProvider, useAuth } from '@/lib/auth'
import { AppErrorBoundary } from '@/screens/AppErrorBoundary'
import { LoginScreen } from '@/screens/LoginScreen'
import { SiteWebViewScreen } from '@/screens/SiteWebViewScreen'
import { colors } from '@/theme/tokens'

export default function App() {
  return (
    <AuthProvider>
      <DropZoneMobileApp />
    </AuthProvider>
  )
}

function DropZoneMobileApp() {
  const auth = useAuth()

  function renderScreen() {
    if (auth.loading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )
    }
    if (!auth.session) return <LoginScreen />
    return <SiteWebViewScreen />
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <AppErrorBoundary onReset={() => null}>
        {renderScreen()}
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
