import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function resolveManager(managerId: string) {
  const normalized = String(managerId || '').trim()
  if (!isUuid(normalized)) return null
  const { data: manager, error: managerError } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,avatar_url,status,auth_user_id,whatsapp_url,nome_publico_vendas,portfolio_anuncios')
    .eq('id', normalized)
    .maybeSingle()
  if (managerError && (managerError.code === 'PGRST204' || /column/i.test(managerError.message || ''))) {
    const fallback = await supabaseAdmin
      .from('managers')
      .select('id,nome,username,avatar_url,status,auth_user_id')
      .eq('id', normalized)
      .maybeSingle()
    if (fallback.error) throw fallback.error
    return fallback.data
      ? { ...fallback.data, whatsapp_url: null, nome_publico_vendas: null, portfolio_anuncios: [] }
      : null
  }
  if (managerError) throw managerError
  return manager
}

export async function GET(_req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    const manager = await resolveManager(managerId)
    if (!manager || ['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) {
      throw new Error('Vendedor nao encontrado.')
    }
    const sellerLinksResult = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('id,campeonato_id,produtora_id,nome_publico,whatsapp_url,created_at')
      .eq('manager_id', manager.id)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false })
    const tokenLinksResult = await supabaseAdmin
      .from('tokens')
      .select('id,campeonato_id,produtora_id,created_at')
      .eq('tipo', 'manager_invite')
      .eq('manager_id', manager.id)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false })
    
    if (sellerLinksResult.error && !missingRelation(sellerLinksResult.error)) throw sellerLinksResult.error
    if (tokenLinksResult.error) throw tokenLinksResult.error

    const portfolio = Array.isArray((manager as any).portfolio_anuncios)
      ? (manager as any).portfolio_anuncios.map(String)
      : []

    const linksByChampionship = new Map<string, any>()
    for (const item of [...(sellerLinksResult.data || []), ...(tokenLinksResult.data || [])]) {
      if (!item.campeonato_id || linksByChampionship.has(item.campeonato_id)) continue
      // Portfolio afiliado: se lista preenchida, só anuncia os escolhidos
      if (portfolio.length && !portfolio.includes(String(item.campeonato_id))) continue
      linksByChampionship.set(item.campeonato_id, item)
    }
    const links = Array.from(linksByChampionship.values())
    const campeonatoIds = links.map((item) => item.campeonato_id).filter(Boolean)
    const publicManager = {
      id: manager.id,
      nome: (manager as any).nome_publico_vendas || manager.nome || manager.username,
      username: manager.username,
      avatar_url: manager.avatar_url,
      whatsapp_url: (manager as any).whatsapp_url || null,
    }
    if (!campeonatoIds.length) return NextResponse.json({ manager: publicManager, announcements: [] })

    const [championsResult, configsResult, groupsResult, slotsResult, gamesResult, gameGroupsResult] = await Promise.all([
      supabaseAdmin
        .from('campeonatos')
        .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status')
        .in('id', campeonatoIds)
        .eq('status', 'ativo')
        .eq('aprovacao_status', 'aprovado')
        .is('deleted_at', null),
      supabaseAdmin.from('campeonato_configuracoes').select('campeonato_id,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,contatos_whatsapp').in('campeonato_id', campeonatoIds).eq('aceita_novas_inscricoes_equipes', true),
      supabaseAdmin.from('campeonato_grupos').select('id,campeonato_id,nome,fase_id').in('campeonato_id', campeonatoIds),
      supabaseAdmin.from('campeonato_slots').select('id,campeonato_id,grupo_id,equipe_id,status,slot_numero').in('campeonato_id', campeonatoIds),
      supabaseAdmin.from('campeonato_jogos').select('id,campeonato_id,nome,data_jogo,horario,grupos_ids,status').in('campeonato_id', campeonatoIds).eq('status', 'ativo'),
      supabaseAdmin.from('campeonato_jogos_grupos').select('jogo_id,grupo_id'),
    ])
    for (const result of [championsResult, configsResult, groupsResult, slotsResult, gamesResult, gameGroupsResult]) if (result.error) throw result.error

    const configs = new Map((configsResult.data || []).map((row: any) => [row.campeonato_id, row]))
    const sellerByChampionship = new Map(links.map((row: any) => [row.campeonato_id, row]))
    const gameGroupMap = new Map<string, string[]>()
    for (const row of gameGroupsResult.data || []) gameGroupMap.set(row.jogo_id, [...(gameGroupMap.get(row.jogo_id) || []), row.grupo_id])
    const today = new Date().toISOString().slice(0, 10)

    const announcements = (championsResult.data || []).flatMap((champ: any) => {
      const config: any = configs.get(champ.id)
      const seller = sellerByChampionship.get(champ.id) || {}
      if (!config || !champ.banner_url) return []

      const groups = (groupsResult.data || []).filter((group: any) => group.campeonato_id === champ.id)
      const openGroups = groups.map((group: any) => {
        const slots = (slotsResult.data || []).filter((slot: any) => slot.grupo_id === group.id && slot.status !== 'excluido')
        const free = slots.filter((slot: any) => !slot.equipe_id).length
        if (!free) return null
        const nextGames = (gamesResult.data || []).filter((game: any) => game.campeonato_id === champ.id && game.data_jogo >= today && ([...(game.grupos_ids || []), ...(gameGroupMap.get(game.id) || [])].includes(group.id))).sort((a: any, b: any) => `${a.data_jogo} ${a.horario || ''}`.localeCompare(`${b.data_jogo} ${b.horario || ''}`))
        return { id: group.id, nome: group.nome, vagas_livres: free, total_slots: slots.length, proximo_jogo: nextGames[0] || null }
      }).filter(Boolean) as any[]
      if (!openGroups.length) return []

      // Contato do vendedor (portfólio), não a lista de admins do campeonato
      const sellerWhatsapp =
        (manager as any).whatsapp_url
        || seller.whatsapp_url
        || (Array.isArray(config.contatos_whatsapp)
          ? config.contatos_whatsapp.find((item: any) => item?.manager_id === managerId)?.url
          : null)
        || null
      const contact = {
        id: `manager-${managerId}`,
        manager_id: managerId,
        nome:
          (manager as any).nome_publico_vendas
          || seller.nome_publico
          || manager.nome
          || manager.username
          || 'Vendedor',
        url: sellerWhatsapp,
      }
      const dated = openGroups.filter((group: any) => group.proximo_jogo).sort((a: any, b: any) => `${a.proximo_jogo.data_jogo} ${a.proximo_jogo.horario || ''}`.localeCompare(`${b.proximo_jogo.data_jogo} ${b.proximo_jogo.horario || ''}`))
      const next = dated[0] || openGroups[0]
      return [{
        id: champ.id,
        nome: champ.nome,
        tipo: champ.tipo,
        logo_url: champ.logo_url,
        banner_url: champ.banner_url,
        valor_inscricao: config.valor_inscricao,
        plataforma: config.plataforma,
        servidor: config.servidor,
        data_limite_inscricao: config.data_limite_inscricao,
        contatos_whatsapp: contact.url ? [contact] : [],
        grupos: openGroups,
        vagas_livres: openGroups.reduce((sum: number, group: any) => sum + group.vagas_livres, 0),
        proxima_data: next.proximo_jogo?.data_jogo || null,
        proximo_horario: next.proximo_jogo?.horario || null,
        proximo_grupo: next.nome,
        ja_tem_vaga: false,
      }]
    }).sort((a: any, b: any) => (a.proxima_data ? 0 : 1) - (b.proxima_data ? 0 : 1) || String(a.proxima_data || '9999').localeCompare(String(b.proxima_data || '9999')))

    return NextResponse.json({ manager: publicManager, announcements })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar vagas do vendedor.' }, { status: 404 })
  }
}
