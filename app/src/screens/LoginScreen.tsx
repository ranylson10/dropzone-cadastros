import { useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { colors, spacing, typography } from '@/theme/tokens'

export function LoginScreen(props: { onCancel?: () => void }) {
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
    <SafeAreaView style={styles.page}>
      <View style={styles.topLine}>
        <TouchableOpacity
          accessibilityLabel="Voltar"
          style={styles.iconButton}
          onPress={props.onCancel}
          disabled={!props.onCancel || busy}
        >
          <Ionicons name="arrow-back" size={22} color={colors.surface} />
        </TouchableOpacity>
        <Image source={require('../../assets/dropzone-icon-accent.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.iconSpacer} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ACESSO DROPZONE</Text>
        <Text style={styles.title}>ENTRAR</Text>
        <Text style={styles.description}>
          Faça login somente para ações pessoais, compras e gerenciamento.
        </Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.rule} />

        {!auth.configured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>CONFIGURAÇÃO PENDENTE</Text>
            <Text style={styles.noticeText}>As variáveis do Supabase ainda não estão configuradas neste app.</Text>
          </View>
        ) : null}

        {auth.configured && !auth.redirectConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>RETORNO DO LOGIN PENDENTE</Text>
            <Text style={styles.noticeText}>O callback mobile precisa estar configurado antes de usar o Google.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={() => { setLocalError(''); auth.clearAuthError() }}>
              <Text style={styles.retry}>TENTAR NOVAMENTE</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.googleButton, (!auth.configured || !auth.redirectConfigured || busy) && styles.disabled]}
          onPress={signIn}
          disabled={busy || !auth.configured || !auth.redirectConfigured}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="logo-google" size={21} color="#fff" />}
          <Text style={styles.googleText}>{busy ? 'AGUARDANDO GOOGLE...' : 'ENTRAR COM GOOGLE'}</Text>
        </TouchableOpacity>

        {props.onCancel && !busy ? (
          <TouchableOpacity style={styles.guestButton} onPress={props.onCancel}>
            <Text style={styles.guestText}>CONTINUAR SEM LOGIN</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.helper}>
          Você pode navegar pelo conteúdo público sem conta. O login será solicitado apenas quando necessário.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.brandDark,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  topLine: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.14)',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: { width: 44 },
  logo: { width: 42, height: 42 },
  hero: {
    paddingTop: 54,
    paddingHorizontal: 8,
    paddingBottom: 34,
  },
  eyebrow: {
    color: '#b7bec8',
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 3,
  },
  title: {
    marginTop: 8,
    color: '#fff',
    fontSize: 44,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: .3,
  },
  description: {
    marginTop: 12,
    maxWidth: 330,
    color: '#b9c0ca',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  panel: {
    marginTop: 'auto',
    backgroundColor: '#eeeae2',
    padding: spacing.lg,
    gap: 12,
    borderTopWidth: 4,
    borderTopColor: colors.brand,
  },
  rule: {
    width: 48,
    height: 3,
    backgroundColor: colors.brand,
    marginBottom: 2,
  },
  notice: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#d7c9a7',
    backgroundColor: '#f8f0dc',
  },
  noticeTitle: {
    color: '#7c5d12',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: .8,
  },
  noticeText: {
    marginTop: 4,
    color: '#715f38',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  errorBox: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#e8b7bd',
    backgroundColor: '#fff1f2',
  },
  error: {
    color: '#9f1239',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '800',
  },
  retry: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  googleButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.brand,
  },
  disabled: { opacity: .58 },
  googleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: .5,
  },
  guestButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bdb6ab',
    backgroundColor: '#e3ded5',
  },
  guestText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: .4,
  },
  helper: {
    color: '#746f68',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
})
