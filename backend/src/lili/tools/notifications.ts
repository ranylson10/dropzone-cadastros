import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from '@backend/lili/types'

export async function getLiliNotifications(userId: string, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('notificacoes')
    .select('id,tipo,titulo,mensagem,status,acao_url,metadata,created_at,read_at')
    .eq('destinatario_auth_user_id', userId)
    .neq('status', 'arquivada')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) throw error
  const items = data || []
  return { items, unread: items.filter((item: any) => item.status === 'nao_lida').length }
}

export async function markAllLiliNotificationsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notificacoes')
    .update({ status: 'lida', read_at: new Date().toISOString() })
    .eq('destinatario_auth_user_id', userId)
    .eq('status', 'nao_lida')
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) throw error
}

export function notificationCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR'
  return items.map((item: any) => ({
    id: `notification-${item.id}`,
    kind: 'notification',
    title: item.titulo || (locale === 'en' ? 'Notification' : locale === 'es' ? 'Notificación' : 'Notificação'),
    subtitle: item.mensagem || undefined,
    badges: [item.status === 'nao_lida' ? (locale === 'en' ? 'New' : locale === 'es' ? 'Nueva' : 'Nova') : (locale === 'en' ? 'Read' : locale === 'es' ? 'Leída' : 'Lida')],
    details: item.created_at ? [{ label: locale === 'en' ? 'Received' : locale === 'es' ? 'Recibida' : 'Recebida', value: new Date(item.created_at).toLocaleString(dateLocale) }] : undefined,
    actions: item.acao_url ? [{ id: `notification-open-${item.id}`, label: locale === 'en' ? 'Open' : locale === 'es' ? 'Abrir' : 'Abrir', href: item.acao_url, variant: 'primary' }] : undefined,
  }))
}
