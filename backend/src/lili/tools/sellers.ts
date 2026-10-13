import { getAccountsForUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from '@backend/lili/types'
import { AuthUser } from './common'

export async function getLiliSellerOverview(user: AuthUser) {
  const accounts = await getAccountsForUser(user as any)
  const manager: any = accounts.find((item: any) => item.profile_type === 'manager') || null
  const producer: any = accounts.find((item: any) => item.profile_type === 'produtora') || null
  const assignments = manager ? (await supabaseAdmin.from('campeonato_vendedores').select('id,campeonato_id,limite_vagas,status,nome_publico,whatsapp_url,permissoes,campeonatos:campeonato_id(id,nome,logo_url,status)').eq('manager_id', manager.id).neq('status', 'cancelado')).data || [] : []
  const roster = producer ? (await supabaseAdmin.from('produtora_vendedores').select('id,manager_id,nome_publico,status,whatsapp_url,created_at').eq('produtora_id', producer.id).neq('status', 'cancelado')).data || [] : []
  return { manager, producer, assignments, roster }
}

export function sellerOverviewCards(data: any, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const cards: LiliCard[] = []
  if (data.manager) cards.push({
    id: 'seller-manager-summary', kind: 'seller',
    title: locale === 'en' ? 'My seller operation' : locale === 'es' ? 'Mi operación de ventas' : 'Minha operação como vendedor',
    subtitle: data.manager.name || data.manager.username || undefined,
    details: [
      { label: locale === 'en' ? 'Assigned tournaments' : locale === 'es' ? 'Campeonatos vinculados' : 'Campeonatos vinculados', value: String(data.assignments.length) },
      { label: locale === 'en' ? 'Active assignments' : locale === 'es' ? 'Vínculos activos' : 'Vínculos ativos', value: String(data.assignments.filter((x: any) => x.status === 'ativo').length) },
    ],
    actions: [{ id: 'seller-open-profile', label: locale === 'en' ? 'Open seller page' : locale === 'es' ? 'Abrir página de vendedor' : 'Abrir página de vendedor', href: `/vendedores/${data.manager.id}`, variant: 'primary' }],
  })
  if (data.producer) cards.push({
    id: 'seller-producer-summary', kind: 'seller',
    title: locale === 'en' ? 'Producer sales team' : locale === 'es' ? 'Equipo de ventas de la productora' : 'Equipe de vendedores da produtora',
    subtitle: data.producer.name || undefined,
    details: [
      { label: locale === 'en' ? 'Registered sellers' : locale === 'es' ? 'Vendedores registrados' : 'Vendedores cadastrados', value: String(data.roster.length) },
      { label: locale === 'en' ? 'Active sellers' : locale === 'es' ? 'Vendedores activos' : 'Vendedores ativos', value: String(data.roster.filter((x: any) => x.status === 'ativo').length) },
    ],
    actions: [{ id: 'seller-open-management', label: locale === 'en' ? 'Manage sellers' : locale === 'es' ? 'Gestionar vendedores' : 'Gerenciar vendedores', href: '/produtoras', variant: 'primary' }],
  })
  return cards
}
