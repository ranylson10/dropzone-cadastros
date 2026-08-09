import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { colors, radius, spacing, typography } from '@/theme/tokens'

export function LoginScreen() {
  const auth = useAuth()
  const pulse = useRef(new Animated.Value(0)).current
  const [localError, setLocalError] = useState('')
  const busy = auth.authenticating
  const error = localError || auth.authError

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.28] })

  async function signIn() {
    setLocalError('')
    auth.clearAuthError()
    try {
      await auth.signInWithGoogle()
    } catch (err: any) {
      setLocalError(err?.message || 'Não foi possível iniciar o login.')
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <View style={styles.logoBlockLight} />
          <View style={styles.logoBlockGold} />
        </View>
        <View>
          <Text style={styles.brand}>DROPZONE</Text>
          <Text style={styles.brandSub}>Competitive System</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Animated.View style={[styles.glowPrimary, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        <Animated.View style={[styles.glowGold, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        <Text style={styles.eyebrow}>App oficial</Text>
        <Text style={styles.title}>Entre no cenário DropZone</Text>
        <Text style={styles.description}>
          Vagas, equipe, escalação, carteira e Lili em um acesso rápido.
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>Vagas abertas</Text>
          <Text style={styles.badge}>Escalação</Text>
          <Text style={styles.badge}>Lili</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Entrar na conta</Text>
          <Text style={styles.cardText}>Use sua conta Google para acessar seus perfis.</Text>
        </View>

        {!auth.configured ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Configuração pendente</Text>
            <Text style={styles.warningText}>
              Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no app para ativar o login.
            </Text>
          </View>
        ) : null}

        {auth.configured && !auth.redirectConfigured ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Redirect mobile inválido</Text>
            <Text style={styles.warningText}>
              EXPO_PUBLIC_AUTH_REDIRECT_URL precisa apontar para /auth/mobile-callback ou dropzone://auth/callback.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={() => { setLocalError(''); auth.clearAuthError() }}>
              <Text style={styles.dismissError}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, (!auth.configured || !auth.redirectConfigured || busy) && styles.buttonDisabled]}
          onPress={signIn}
          disabled={busy || !auth.configured || !auth.redirectConfigured}
        >
          {busy ? (
            <View style={styles.buttonBusy}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>Aguardando Google...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Entrar com Google</Text>
          )}
        </TouchableOpacity>

        {busy ? (
          <Text style={styles.helper}>Finalize no navegador. Depois o app volta sozinho para sua conta.</Text>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: '#080c18',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  logoBlockLight: {
    width: 23,
    height: 10,
    backgroundColor: '#fff',
    opacity: 0.95,
  },
  logoBlockGold: {
    width: 23,
    height: 10,
    marginTop: 4,
    backgroundColor: colors.gold,
  },
  brand: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  brandSub: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  glowPrimary: {
    position: 'absolute',
    right: -95,
    top: 60,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#6d3df5',
  },
  glowGold: {
    position: 'absolute',
    left: -80,
    bottom: 70,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#1d9bf0',
  },
  eyebrow: {
    color: '#8bd3ff',
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 45,
    maxWidth: 350,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 340,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#e5e7eb',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  card: {
    borderRadius: 30,
    backgroundColor: '#f6f7fb',
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 30,
    elevation: 12,
  },
  cardHeader: {
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontWeight: '700',
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    padding: spacing.md,
    gap: spacing.xs,
  },
  warningTitle: {
    color: '#9a3412',
    fontWeight: '900',
  },
  warningText: {
    color: '#9a3412',
    fontSize: typography.caption,
    lineHeight: 18,
  },
  errorBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    padding: spacing.md,
    gap: spacing.xs,
  },
  error: {
    color: '#9f1239',
    fontWeight: '800',
    lineHeight: 19,
  },
  dismissError: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  button: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6d3df5',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helper: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
})
