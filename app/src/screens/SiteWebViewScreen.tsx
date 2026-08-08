import { useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { apiUrl } from '@/config/env'
import { useAuth } from '@/lib/auth'
import { colors, radius, spacing, typography } from '@/theme/tokens'

const WebView = require('react-native-webview').default as ComponentType<any>

export function SiteWebViewScreen() {
  const auth = useAuth()
  const webViewRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const startUrl = apiUrl('/')
  const injectedAuth = auth.session?.access_token
    ? `
      try {
        window.localStorage.setItem('dropzone_mobile_access_token', ${JSON.stringify(auth.session.access_token)});
        window.localStorage.setItem('dropzone_mobile_refresh_token', ${JSON.stringify(auth.session.refresh_token || '')});
      } catch (error) {}
      true;
    `
    : 'true;'

  if (failed) {
    return (
      <View style={styles.errorPage}>
        <Text style={styles.errorTitle}>Não foi possível carregar o DropZone</Text>
        <Text style={styles.errorText}>Verifique a conexão e tente novamente.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setFailed(false)
            setLoading(true)
            webViewRef.current?.reload()
          }}
        >
          <Text style={styles.retryText}>Recarregar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loaderText}>Carregando DropZone...</Text>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        source={{ uri: startUrl }}
        style={styles.webview}
        originWhitelist={['https://*', 'dropzone://*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={injectedAuth}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setFailed(true)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  loaderText: {
    color: colors.muted,
    fontWeight: '800',
  },
  errorPage: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  errorText: {
    color: colors.muted,
    lineHeight: 22,
  },
  retryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  retryText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
