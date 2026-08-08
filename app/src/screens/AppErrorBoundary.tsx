import { Component, ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme/tokens'

type Props = {
  children: ReactNode
  onReset: () => void
}

type State = {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onReset()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Erro no app</Text>
          <Text style={styles.title}>Não foi possível abrir essa tela.</Text>
          <Text style={styles.description}>
            O app protegeu a sessão e você pode voltar para o início sem precisar fechar tudo.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Voltar para o início</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    padding: spacing.md,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
