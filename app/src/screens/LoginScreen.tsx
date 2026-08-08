import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { colors, radius, spacing, typography } from '@/theme/tokens'

export function LoginScreen() {
  const auth = useAuth()
  const [localError, setLocalError] = useState('')
  const busy = auth.authenticating
  const error = localError || auth.authError

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
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>DropZone Mobile</Text>
        <Text style={styles.title}>Entre para continuar</Text>
        <Text style={styles.description}>
          Use a mesma conta do site para acessar campeonatos, equipe, escalação, carteira e Lili.
        </Text>

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
              EXPO_PUBLIC_AUTH_REDIRECT_URL precisa ser dropzone://auth/callback e essa URL deve estar liberada no Supabase Auth.
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
          <Text style={styles.helper}>Conclua o login no navegador. O DropZone abrirá novamente automaticamente.</Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    padding: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.surface,
    fontSize: typography.title,
    fontWeight: '900',
  },
  description: {
    color: '#d6dae2',
    fontSize: typography.body,
    lineHeight: 22,
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
    borderColor: '#7f1d1d',
    backgroundColor: '#451a1a',
    padding: spacing.md,
    gap: spacing.xs,
  },
  error: {
    color: '#fecaca',
    fontWeight: '800',
    lineHeight: 19,
  },
  dismissError: {
    color: '#fff',
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  buttonDisabled: {
    opacity: 0.55,
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
  },
  helper: {
    color: '#aeb6c5',
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
})
