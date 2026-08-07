import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const produtoraId = String(req.nextUrl.searchParams.get('produtora') || '').trim()
    const vendedorId = String(req.nextUrl.searchParams.get('vendedor') || '').trim()
    const debugCampeonatoId = String(req.nextUrl.searchParams.get('debug_campeonato') || '').trim()
    const diagnostics: Record<string, unknown>[] = []
    if (debugCampeonatoId) await requireSystemAdmin(req)
    if (produtoraId && vendedorId) throw new Error('Use somente um catálogo por vez.')
    let sellerProfile: any = null
    let sellerPortfolio: string[] = []
    if (vendedorId) {
      const { data, error } = await supabaseAdmin
        .from('managers')
        .select('id,nome,username,avatar_url,nome_publico_vendas,portfolio_anuncios')
        .eq('id', vendedorId)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Catálogo do vendedor não encontrado.')
      sellerProfile = data
      sellerPortfolio = Array.isArray(data.portfolio_anuncios) ? data.portfolio_anuncios.map(String) : []
    }
    let championsQuery = supabaseAdmin
      .from('campeonatos')
      .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,produtora_id')
      .eq('status', 'ativo')
      .eq('aprovacao_status', 'aprovado')
      .is('deleted_at', null)
    if (produtoraId) championsQuery = championsQuery.eq('produtora_id', produtoraId)
    let sellersQuery = supabaseAdmin
      .from('campeonato_vendedores')
      .select('campeonato_id,manager_id,nome_publico,whatsapp_url,status')
      .eq('status', 'ativo')
    if (vendedorId) sellersQuery = sellersQuery.eq('manager_id', vendedorId)

    const [championsResult, configsResult, phasesResult, groupsResult, slotsResult, gamesResult, gameGroupsResult, sellersResult, purchasesResult] = await Promise.all([
      championsQuery,
      supabaseAdmin.from('campeonato_configuracoes').select('campeonato_id,numero_vagas,valor_inscricao,premiacao,descricao_premiacao,tipo_premiacao,tem_live,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,contatos_whatsapp').eq('aceita_novas_inscricoes_equipes', true),
      supabaseAdmin.from('campeonato_fases').select('id,campeonato_id,ordem'),
      supabaseAdmin.from('campeonato_grupos').select('id,campeonato_id,nome,fase_id'),
      supabaseAdmin.from('campeonato_slots').select('id,campeonato_id,grupo_id,fase_id,equipe_id,line_id,status,slot_numero'),
      supabaseAdmin.from('campeonato_jogos').select('id,campeonato_id,nome,data_jogo,horario,grupos_ids,status').eq('status', 'ativo'),
      supabaseAdmin.from('campeonato_jogos_grupos').select('jogo_id,grupo_id'),
      sellersQuery,
      supabaseAdmin.from('sistema_compras_vaga').select('campeonato_id,status,expira_em').in('status', ['pendente', 'pago', 'liberado']),
    ])
    for (const result of [championsResult, configsResult, phasesResult, groupsResult, slotsResult, gamesResult, gameGroupsResult, purchasesResult]) if (result.error) throw result.error
    if (sellersResult.error && !['42P01', '42703', 'PGRST205', 'PGRST204'].includes(sellersResult.error.code || '')) throw sellersResult.error

    // As consultas globais do catálogo podem atingir o limite de linhas do PostgREST.
    // Para catálogo de vendedor e diagnóstico, recarrega diretamente os campeonatos-alvo,
    // evitando que registros recém-criados desapareçam por truncamento da resposta.
    const targetChampionshipIds = [...new Set([
      ...(vendedorId ? (sellersResult.data || []).map((row:any) => String(row.campeonato_id || '')) : []),
      ...(debugCampeonatoId ? [debugCampeonatoId] : []),
    ].filter(Boolean))]

    let configRows = [...(configsResult.data || [])]
    let phaseRows = [...(phasesResult.data || [])]
    let groupRows = [...(groupsResult.data || [])]
    let slotRows = [...(slotsResult.data || [])]
    let gameRows = [...(gamesResult.data || [])]
    let gameGroupRows = [...(gameGroupsResult.data || [])]
    let purchaseRows = [...(purchasesResult.data || [])]

    const mergeRows = (current:any[], incoming:any[], key:(row:any) => string) =>
      Array.from(new Map([...current, ...incoming].map((row:any) => [key(row), row])).values())

    if (targetChampionshipIds.length) {
      const [targetConfigs, targetPhases, targetGroups, targetSlots, targetGames, targetPurchases] = await Promise.all([
        supabaseAdmin.from('campeonato_configuracoes').select('campeonato_id,numero_vagas,valor_inscricao,premiacao,descricao_premiacao,tipo_premiacao,tem_live,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,contatos_whatsapp').in('campeonato_id', targetChampionshipIds).eq('aceita_novas_inscricoes_equipes', true),
        supabaseAdmin.from('campeonato_fases').select('id,campeonato_id,ordem').in('campeonato_id', targetChampionshipIds),
        supabaseAdmin.from('campeonato_grupos').select('id,campeonato_id,nome,fase_id').in('campeonato_id', targetChampionshipIds),
        supabaseAdmin.from('campeonato_slots').select('id,campeonato_id,grupo_id,fase_id,equipe_id,line_id,status,slot_numero').in('campeonato_id', targetChampionshipIds),
        supabaseAdmin.from('campeonato_jogos').select('id,campeonato_id,nome,data_jogo,horario,grupos_ids,status').in('campeonato_id', targetChampionshipIds).eq('status', 'ativo'),
        supabaseAdmin.from('sistema_compras_vaga').select('id,campeonato_id,status,expira_em').in('campeonato_id', targetChampionshipIds).in('status', ['pendente', 'pago', 'liberado']),
      ])
      for (const result of [targetConfigs, targetPhases, targetGroups, targetSlots, targetGames, targetPurchases]) if (result.error) throw result.error
      configRows = mergeRows(configRows, targetConfigs.data || [], (row) => String(row.campeonato_id))
      phaseRows = mergeRows(phaseRows, targetPhases.data || [], (row) => String(row.id))
      groupRows = mergeRows(groupRows, targetGroups.data || [], (row) => String(row.id))
      slotRows = mergeRows(slotRows, targetSlots.data || [], (row) => String(row.id))
      gameRows = mergeRows(gameRows, targetGames.data || [], (row) => String(row.id))
      purchaseRows = mergeRows(purchaseRows, targetPurchases.data || [], (row) => String(row.id || `${row.campeonato_id}:${row.status}:${row.expira_em || ''}`))

      const targetGameIds = (targetGames.data || []).map((row:any) => String(row.id || '')).filter(Boolean)
      if (targetGameIds.length) {
        const targetGameGroups = await supabaseAdmin.from('campeonato_jogos_grupos').select('jogo_id,grupo_id').in('jogo_id', targetGameIds)
        if (targetGameGroups.error) throw targetGameGroups.error
        gameGroupRows = mergeRows(gameGroupRows, targetGameGroups.data || [], (row) => `${row.jogo_id}:${row.grupo_id}`)
      }
    }

    const entryPhaseIds = new Map<string, Set<string>>()
    for (const champ of championsResult.data || []) {
      const phases = phaseRows.filter((phase:any) => phase.campeonato_id === champ.id)
      const minOrder = phases.length ? Math.min(...phases.map((phase:any) => Number(phase.ordem || 0))) : null
      entryPhaseIds.set(champ.id, new Set(minOrder == null ? [] : phases.filter((phase:any) => Number(phase.ordem || 0) === minOrder).map((phase:any) => String(phase.id))))
    }
    const configs = new Map(configRows.map((row:any) => [row.campeonato_id, row]))
    const sellersByChampionship = new Map<string, any[]>()
    for (const seller of sellersResult.data || []) sellersByChampionship.set(seller.campeonato_id, [...(sellersByChampionship.get(seller.campeonato_id) || []), seller])
    const gameGroupMap = new Map<string, string[]>(); for (const row of gameGroupRows) gameGroupMap.set(row.jogo_id, [...(gameGroupMap.get(row.jogo_id) || []), row.grupo_id])
    const today = new Date().toISOString().slice(0, 10)
    let teamIds: string[] = []; let enrolledIds = new Set<string>()
    const bearer = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (bearer) { const { data } = await supabaseAdmin.auth.getUser(bearer); if (data.user) { const { data: teams } = await supabaseAdmin.from('equipes').select('id').or(`auth_user_id.eq.${data.user.id},dono_auth_user_id.eq.${data.user.id}`); teamIds = (teams || []).map((row:any) => row.id); if (teamIds.length) { const { data: entries } = await supabaseAdmin.from('campeonato_equipes').select('campeonato_id').in('equipe_id', teamIds).eq('status', 'ativo'); enrolledIds = new Set((entries || []).map((row:any) => row.campeonato_id)) } } }
    const announcements = (championsResult.data || []).flatMap((champ:any) => {
      const isDebugTarget = Boolean(debugCampeonatoId && champ.id === debugCampeonatoId)
      const config:any = configs.get(champ.id)
      const sellerLinks = sellersByChampionship.get(champ.id) || []
      const diagnostic: Record<string, unknown> = {
        campeonato_id: champ.id,
        campeonato_encontrado: true,
        status: champ.status,
        aprovacao_status: champ.aprovacao_status,
        banner_presente: Boolean(champ.banner_url),
        configuracao_encontrada: Boolean(config),
        aceita_novas_inscricoes_equipes: Boolean(config?.aceita_novas_inscricoes_equipes),
        vinculos_vendedor_ativos: sellerLinks.length,
        motivo_exclusao: null,
      }
      if (!config) {
        diagnostic.motivo_exclusao = 'configuracao_ausente_ou_inscricoes_fechadas'
        if (isDebugTarget) diagnostics.push(diagnostic)
        return []
      }
      if (!champ.banner_url) {
        diagnostic.motivo_exclusao = 'banner_ausente'
        if (isDebugTarget) diagnostics.push(diagnostic)
        return []
      }
      if (vendedorId && !sellerLinks.length) {
        diagnostic.motivo_exclusao = 'vinculo_vendedor_ativo_ausente'
        if (isDebugTarget) diagnostics.push(diagnostic)
        return []
      }
      // Um vínculo direto e ativo em campeonato_vendedores sempre publica o campeonato.
      // portfolio_anuncios limita apenas anúncios opcionais, não convites específicos já aceitos.
      const entryIds = entryPhaseIds.get(champ.id) || new Set<string>()
      const groups = groupRows.filter((group:any) => group.campeonato_id === champ.id && (entryIds.size === 0 || !group.fase_id || entryIds.has(String(group.fase_id))))
      const entrySlots = slotRows.filter((slot:any) => slot.campeonato_id === champ.id && slot.status !== 'excluido' && (entryIds.size === 0 || !slot.fase_id || entryIds.has(String(slot.fase_id))))
      const occupied = entrySlots.filter((slot:any) => Boolean(slot.equipe_id || slot.line_id)).length
      const officialTotal = Math.max(0, Math.floor(Number(config.numero_vagas || 0)))
      const now = Date.now()
      const commercialReservations = purchaseRows.filter((purchase:any) => purchase.campeonato_id === champ.id && (purchase.status !== 'pendente' || !purchase.expira_em || new Date(purchase.expira_em).getTime() > now)).length
      const officialFree = Math.max(0, officialTotal - occupied - commercialReservations)
      Object.assign(diagnostic, {
        fases_entrada: entryIds.size,
        grupos_entrada: groups.length,
        slots_entrada: entrySlots.length,
        slots_ocupados: occupied,
        vagas_oficiais: officialTotal,
        reservas_comerciais: commercialReservations,
        vagas_oficiais_livres: officialFree,
      })
      if (officialFree <= 0) {
        diagnostic.motivo_exclusao = 'sem_vagas_oficiais_livres'
        if (isDebugTarget) diagnostics.push(diagnostic)
        return []
      }
      const openGroups = groups.map((group:any) => { const slots = entrySlots.filter((slot:any) => slot.grupo_id === group.id); const free = slots.filter((slot:any) => !slot.equipe_id && !slot.line_id).length; if (!free) return null; const nextGames = gameRows.filter((game:any) => game.campeonato_id === champ.id && game.data_jogo >= today && ([...(game.grupos_ids || []), ...(gameGroupMap.get(game.id) || [])].includes(group.id))).sort((a:any,b:any) => `${a.data_jogo} ${a.horario||''}`.localeCompare(`${b.data_jogo} ${b.horario||''}`)); return { id:group.id, nome:group.nome, vagas_livres:free, total_slots:slots.length, proximo_jogo:nextGames[0] || null } }).filter(Boolean) as any[]
      diagnostic.grupos_abertos = openGroups.length
      if (!openGroups.length) {
        diagnostic.motivo_exclusao = 'nenhum_grupo_com_slot_livre'
        if (isDebugTarget) diagnostics.push(diagnostic)
        return []
      }
      diagnostic.motivo_exclusao = null
      if (isDebugTarget) diagnostics.push(diagnostic)
      const dated = openGroups.filter((group:any) => group.proximo_jogo).sort((a:any,b:any) => `${a.proximo_jogo.data_jogo} ${a.proximo_jogo.horario||''}`.localeCompare(`${b.proximo_jogo.data_jogo} ${b.proximo_jogo.horario||''}`)); const next = dated[0] || openGroups[0]
      const sellers = (sellersByChampionship.get(champ.id) || []).map((seller:any) => ({ id:seller.manager_id, nome:seller.nome_publico || 'Vendedor', contato:{ id:`manager-${seller.manager_id}`, manager_id:seller.manager_id, nome:seller.nome_publico || 'Vendedor', url:seller.whatsapp_url } }))
      const sellerContacts = vendedorId ? sellers.map((seller:any) => seller.contato).filter((contact:any) => contact.url) : config.contatos_whatsapp || []
      return [{ id:champ.id, nome:champ.nome, tipo:champ.tipo, logo_url:champ.logo_url, banner_url:champ.banner_url, valor_inscricao:config.valor_inscricao, premiacao:config.premiacao, descricao_premiacao:config.descricao_premiacao, tipo_premiacao:config.tipo_premiacao, tem_live:Boolean(config.tem_live), plataforma:config.plataforma, servidor:config.servidor, data_limite_inscricao:config.data_limite_inscricao, contatos_whatsapp:sellerContacts, vendedores:sellers, grupos:openGroups, vagas_livres:officialFree, total_vagas:officialTotal, vagas_estruturadas_livres:openGroups.reduce((sum:number, group:any)=>sum+group.vagas_livres,0), vagas_em_compra:commercialReservations, proxima_data:next.proximo_jogo?.data_jogo || null, proximo_horario:next.proximo_jogo?.horario || null, proximo_grupo:next.nome, ja_tem_vaga:enrolledIds.has(champ.id) }]
    }).sort((a:any,b:any) => (a.proxima_data ? 0 : 1) - (b.proxima_data ? 0 : 1) || String(a.proxima_data||'9999').localeCompare(String(b.proxima_data||'9999')))
    let scope: any = null
    if (produtoraId) {
      const { data } = await supabaseAdmin.from('produtoras').select('id,nome,logo_url,username').eq('id', produtoraId).maybeSingle()
      if (!data) throw new Error('Catálogo da produtora não encontrado.')
      scope = { tipo: 'produtora', id: data.id, nome: data.nome || data.username || 'Produtora', logo_url: data.logo_url || null }
    } else if (vendedorId) {
      scope = { tipo: 'vendedor', id: sellerProfile.id, nome: sellerProfile.nome_publico_vendas || sellerProfile.nome || sellerProfile.username || 'Vendedor', logo_url: sellerProfile.avatar_url || null }
    }
    if (debugCampeonatoId && !diagnostics.length) {
      diagnostics.push({
        campeonato_id: debugCampeonatoId,
        campeonato_encontrado: false,
        motivo_exclusao: 'fora_da_consulta_inicial_status_aprovacao_deleted_at_ou_produtora',
      })
    }
    return NextResponse.json({ announcements, authenticated:Boolean(bearer), hasTeam:teamIds.length>0, scope, ...(debugCampeonatoId ? { diagnostics } : {}) })
  } catch (error:any) { return NextResponse.json({ error:error?.message || 'Erro ao carregar vagas.' }, { status:400 }) }
}
