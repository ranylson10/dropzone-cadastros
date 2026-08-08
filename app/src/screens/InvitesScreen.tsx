import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fallbackNotifications, isActionableNotification, NotificationItem, notificationDate } from '@/lib/notifications'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function InvitesScreen({ onBack }: ScreenProps) {
  const auth = useAuth()
  const accessToken = auth.session?.access_token
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await mobileApi.notifications(accessToken)
      setItems((response.items as NotificationItem[]) || [])
      setUnread(Number(response.nao_lidas || 0))
      setError(null)
    } catch (err: any) {
      setItems(fallbackNotifications)
      setUnread(fallbackNotifications.filter((item) => item.status === 'nao_lida').length)
      setError(err?.message || 'Não foi possível carregar o correio.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [accessToken])

  async function respond(item: NotificationItem, action: 'aceitar' | 'recusar') {
    const id = String(item.id || '')
    if (!id || id.startsWith('demo')) {
      setMessage(action === 'aceitar' ? 'Exemplo aceito.' : 'Exemplo recusado.')
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, status: 'lida' } : row))
      return
    }
    setBusyId(id)
    try {
      const response = await mobileApi.respondNotification(id, action, accessToken)
      setMessage(response.mensagem || (action === 'aceitar' ? 'Convite aceito.' : 'Convite recusado.'))
      await load()
    } catch (err: any) {
      setMessage(err?.message || 'Não foi possível responder agora.')
    } finally {
      setBusyId(null)
    }
  }

  async function markRead(item: NotificationItem) {
    const id = String(item.id || '')
    if (!id || id.startsWith('demo')) {
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, status: 'lida' } : row))
      return
    }
    setBusyId(id)
    try {
      await mobileApi.updateNotification(id, 'lida', accessToken)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ScreenShell
      eyebrow="Correio"
      title="Convites e pedidos"
      description="Aceite ou recuse convites importantes sem procurar a página certa: equipe, jogador, manager e campeonato."
      onBack={onBack}
    >
      <View style={styles.metrics}>
        <MetricPill label="não lidas" value={unread} />
        <MetricPill label="itens" value={items.length} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Carregando correio...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>Mostrando exemplo porque a API não respondeu: {error}</Text> : null}
      {message ? <Text style={styles.info}>{message}</Text> : null}

      {!loading && items.length === 0 ? (
        <ActionCard
          title="Nenhum convite pendente"
          description="Quando chegar convite de equipe, vendedor, jogador ou campeonato, ele aparece aqui."
          cta="Tudo limpo"
          tone="success"
        />
      ) : null}

      {items.map((item) => {
        const id = String(item.id || item.titulo || Math.random())
        const actionable = isActionableNotification(item)
        return (
          <View key={id} style={[styles.notice, item.status === 'nao_lida' && styles.noticeUnread]}>
            <Text style={styles.noticeType}>{String(item.tipo || 'notificação').replaceAll('_', ' ')}</Text>
            <Text style={styles.noticeTitle}>{item.titulo || 'Notificação'}</Text>
            <Text style={styles.noticeBody}>{item.corpo || 'Sem detalhes.'}</Text>
            <Text style={styles.noticeDate}>{notificationDate(item.created_at)} · {item.status || 'registrada'}</Text>
            {actionable ? (
              <View style={styles.actions}>
                <TouchableOpacity disabled={busyId === id} style={styles.acceptButton} onPress={() => respond(item, 'aceitar')}>
                  <Text style={styles.acceptText}>{busyId === id ? '...' : 'Aceitar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busyId === id} style={styles.refuseButton} onPress={() => respond(item, 'recusar')}>
                  <Text style={styles.refuseText}>Recusar</Text>
                </TouchableOpacity>
              </View>
            ) : item.status === 'nao_lida' ? (
              <TouchableOpacity disabled={busyId === id} style={styles.readButton} onPress={() => markRead(item)}>
                <Text style={styles.readText}>Marcar como lida</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )
      })}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loading: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: {
    color: colors.muted,
    fontWeight: '700',
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
  info: {
    borderRadius: radius.md,
    backgroundColor: '#effaf3',
    color: colors.success,
    fontWeight: '900',
    padding: spacing.md,
  },
  notice: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeUnread: {
    borderColor: colors.brand,
  },
  noticeType: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  noticeBody: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  noticeDate: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    padding: spacing.md,
  },
  acceptText: {
    color: colors.surface,
    fontWeight: '900',
  },
  refuseButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  refuseText: {
    color: colors.ink,
    fontWeight: '900',
  },
  readButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  readText: {
    color: colors.ink,
    fontWeight: '900',
  },
})
