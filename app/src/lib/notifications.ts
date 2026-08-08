export type NotificationItem = {
  id?: string
  tipo?: string
  titulo?: string
  corpo?: string
  status?: string
  created_at?: string
  payload?: Record<string, unknown> | null
}

export const actionableNotificationTypes = new Set([
  'convite_manager_equipe',
  'convite_manager_campeonato',
  'pedido_manager_campeonato',
  'convite_jogador_equipe_direto',
  'pedido_jogador_equipe',
])

export const fallbackNotifications: NotificationItem[] = [
  {
    id: 'demo-invite',
    tipo: 'pedido_jogador_equipe',
    titulo: 'Pedido de jogador para entrar na equipe',
    corpo: 'Exemplo: aceite ou recuse pedidos sem abrir o painel completo.',
    status: 'nao_lida',
  },
]

export const notificationDate = (value?: string) => {
  if (!value) return 'agora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

export const isActionableNotification = (item: NotificationItem) =>
  actionableNotificationTypes.has(String(item.tipo || '')) && String(item.status || '') === 'nao_lida'

