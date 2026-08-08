import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function LiliScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'lili'; text: string }>>([
    {
      from: 'lili',
      text: 'Me diga o que você quer resolver. Eu posso te levar para vagas, escalação, agenda ou responder com base no sistema.',
    },
  ])
  const [loading, setLoading] = useState(false)

  async function send(text = message) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages((current) => [...current, { from: 'user', text: trimmed }])
    setMessage('')
    setLoading(true)
    try {
      const response: any = await mobileApi.lili(trimmed, auth.session?.access_token)
      const answer = String(
        response?.message ||
        response?.answer ||
        response?.resposta ||
        'Não consegui concluir pela conversa. Use os atalhos abaixo para continuar.',
      )
      setMessages((current) => [...current, { from: 'lili', text: answer }])
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        { from: 'lili', text: error?.message || 'Não consegui falar com a Lili agora. Use os atalhos abaixo.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenShell
      eyebrow="Assistente"
      title="Lili"
      description="Converse com a assistente para achar o caminho certo sem precisar conhecer os menus."
      onBack={onBack}
    >
      <View style={styles.chatBox}>
        {messages.slice(-6).map((item, index) => (
          <View key={`${item.from}-${index}`} style={[styles.bubble, item.from === 'user' ? styles.userBubble : styles.liliBubble]}>
            <Text style={[styles.bubbleText, item.from === 'user' && styles.userBubbleText]}>{item.text}</Text>
          </View>
        ))}
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        <View style={styles.inputRow}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Digite o que precisa resolver..."
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => send()}>
            <Text style={styles.sendText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ActionCard
        title="Quero escalar meu elenco"
        description="A Lili consulta equipe, campeonato, prazo e orienta o próximo passo."
        cta="Perguntar para a Lili"
        onPress={() => send('Quero escalar meu elenco')}
      />
      <ActionCard
        title="Quero comprar uma vaga"
        description="Veja campeonatos com vagas, preço, premiação, data e pagamento seguro."
        cta="Ver vagas"
        onPress={() => onNavigate('vacancies')}
      />
      <ActionCard
        title="Onde jogo hoje?"
        description="A Lili consulta a agenda do perfil ativo e mostra jogos, grupo e horário."
        cta="Perguntar para a Lili"
        onPress={() => send('Onde jogo hoje?')}
      />
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  chatBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubble: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  liliBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  bubbleText: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
  userBubbleText: {
    color: colors.surface,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
  },
  sendText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
