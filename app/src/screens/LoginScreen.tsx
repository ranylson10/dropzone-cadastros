import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { colors, radius, spacing, typography } from '@/theme/tokens'

export function LoginScreen() {
  const auth = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn() {
    setBusy(true)
    setError('')
    try {
      await auth.signInWithGoogle()
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar o login.')
    } finally {
      setBusy(false)
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
              Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no app para ativar login.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={signIn} disabled={busy || !auth.configured}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar com Google</Text>}
        </TouchableOpacity>
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
  error: {
    color: '#fecaca',
    fontWeight: '800',
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
