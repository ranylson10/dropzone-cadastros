import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from '@backend/lili/types'
import { liliRegistrationDeadlineOpen, liliPriceMode } from './common'

export async function listOpenChampionships(searchTerm?: string) {
  let query = supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status')
    .eq('status', 'ativo')
    .eq('aprovacao_status', 'aprovado')
    .is('deleted_at', null)
    .limit(12)
  if (searchTerm) query = query.ilike('nome', `%${searchTerm}%`)
  const { data: championships, error } = await query
  if (error) throw error
  const ids = (championships || []).map((item) => item.id)
  if (!ids.length) return []

  const [{ data: configs }, { data: slots }, { data: phases }, { data: purchases }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('campeonato_id,numero_vagas,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,tem_live,tem_trofeu,premiacao,jogadores_por_vaga,vagas_por_equipe,permite_troca_jogadores,contatos_whatsapp,pagamento_pix_ativo,pagamento_cartao_ativo,pagamento_paypal_ativo,pagamento_whatsapp_ativo,cartao_max_parcelas,paypal_moedas')
      .in('campeonato_id', ids)
      .eq('aceita_novas_inscricoes_equipes', true),
    supabaseAdmin
      .from('campeonato_slots')
      .select('campeonato_id,fase_id,equipe_id,line_id,status')
      .in('campeonato_id', ids)
      .neq('status', 'excluido'),
    supabaseAdmin
      .from('campeonato_fases')
      .select('id,campeonato_id,ordem')
      .in('campeonato_id', ids),
    supabaseAdmin
      .from('sistema_compras_vaga')
      .select('campeonato_id,status,expira_em')
      .in('campeonato_id', ids)
      .in('status', ['pendente', 'pago', 'liberado']),
  ])
  const configMap = new Map((configs || []).map((row: any) => [row.campeonato_id, row]))
  const phaseMap = new Map<string, Set<string> | null>()

  for (const championshipId of ids) {
    const champPhases = (phases || []).filter((phase: any) => phase.campeonato_id === championshipId)
    if (!champPhases.length) {
      phaseMap.set(championshipId, null)
      continue
    }
    const minOrder = Math.min(...champPhases.map((phase: any) => Number(phase.ordem || 0)))
    phaseMap.set(
      championshipId,
      new Set(
        champPhases
          .filter((phase: any) => Number(phase.ordem || 0) === minOrder)
          .map((phase: any) => String(phase.id)),
      ),
    )
  }

  return (championships || []).flatMap((championship: any) => {
    const config: any = configMap.get(championship.id)
    if (!config || !liliRegistrationDeadlineOpen(config.data_limite_inscricao)) return []
    const entryPhaseIds = phaseMap.get(championship.id) || null
    const champSlots = (slots || []).filter((slot: any) => {
      if (slot.campeonato_id !== championship.id) return false
      if (!entryPhaseIds || entryPhaseIds.size === 0) return true
      return !slot.fase_id || entryPhaseIds.has(String(slot.fase_id))
    })
    const physicalFree = champSlots.filter((slot: any) => !slot.equipe_id && !slot.line_id).length
    const now = Date.now()
    const commercialReservations = (purchases || []).filter((purchase: any) => {
      if (purchase.campeonato_id !== championship.id) return false
      if (purchase.status === 'pendente') {
        return !purchase.expira_em || new Date(purchase.expira_em).getTime() > now
      }
      return purchase.status === 'pago' || purchase.status === 'liberado'
    }).length
    const officialTotal = Math.max(0, Math.floor(Number(config.numero_vagas || 0)))
    const occupied = champSlots.filter((slot: any) => Boolean(slot.equipe_id || slot.line_id)).length
    const officialFree = Math.max(0, officialTotal - occupied)
    const free = Math.max(0, officialFree - commercialReservations)
    if (free <= 0) return []
    return [{
      ...championship,
      ...config,
      vagas_livres: free,
      vagas_fisicamente_livres: physicalFree,
      vagas_em_compra: commercialReservations,
      total_slots: champSlots.length,
      total_vagas: officialTotal,
      price_mode: liliPriceMode(config.valor_inscricao),
    }]
  })
}

export function championshipCards(items: any[], registrationMode = false, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.map((item) => ({
    id: item.id,
    kind: 'championship',
    title: item.nome,
    subtitle: [item.tipo, item.plataforma, item.servidor].filter(Boolean).join(' • '),
    imageUrl: item.logo_url || item.banner_url || null,
    badges: [`${item.vagas_livres} vaga${item.vagas_livres === 1 ? '' : 's'}`],
    details: [
      ...(item.price_mode === 'free'
        ? [{ label: 'Inscrição', value: 'Gratuita' }]
        : item.price_mode === 'consult'
          ? [{ label: 'Inscrição', value: 'Valor sob consulta' }]
          : [{ label: 'Inscrição', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` }]),
      ...(item.data_limite_inscricao ? [{ label: 'Prazo', value: new Date(item.data_limite_inscricao).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR') }] : []),
    ],
    actions: registrationMode
      ? [{
          id: `buy-${item.id}`,
          label: item.price_mode === 'free' ? 'Fazer inscrição grátis' : item.price_mode === 'consult' ? 'Consultar vaga' : 'Comprar vaga',
          message: item.price_mode === 'free' ? `Fazer inscrição grátis em ${item.nome}` : item.price_mode === 'consult' ? `Consultar vaga em ${item.nome}` : `Comprar vaga em ${item.nome}`,
          intent: 'comprar_vaga',
          variant: 'primary',
          context: { selectedChampionshipId: item.id, currentFlow: item.price_mode === 'free' ? 'registration' : 'vacancy_purchase' },
        }]
      : [{
          id: `view-${item.id}`,
          label: 'Ver campeonato',
          message: `Abrir campeonato ${item.nome}`,
          intent: 'abrir_campeonato',
          variant: 'primary',
          context: { selectedChampionshipId: item.id, currentFlow: 'championship' },
        }],
  }))
}

export async function getChampionshipDetails(championshipId: string) {
  const { data: championship, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,premiacao')
    .eq('id', championshipId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!championship || championship.status !== 'ativo' || championship.aprovacao_status !== 'aprovado') {
    throw new Error('Campeonato não encontrado ou indisponível.')
  }

  const [{ data: config }, { data: slots }, { data: phases }, { data: purchases }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('numero_vagas,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes,tem_live,tem_trofeu,premiacao,jogadores_por_vaga,vagas_por_equipe,permite_troca_jogadores,data_limite_trocas,contatos_whatsapp,pagamento_pix_ativo,pagamento_cartao_ativo,pagamento_paypal_ativo,pagamento_whatsapp_ativo,cartao_max_parcelas,paypal_moedas')
      .eq('campeonato_id', championshipId)
      .maybeSingle(),
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,fase_id,equipe_id,line_id,status')
      .eq('campeonato_id', championshipId)
      .neq('status', 'excluido'),
    supabaseAdmin
      .from('campeonato_fases')
      .select('id,ordem')
      .eq('campeonato_id', championshipId),
    supabaseAdmin
      .from('sistema_compras_vaga')
      .select('status,expira_em')
      .eq('campeonato_id', championshipId)
      .in('status', ['pendente', 'pago', 'liberado']),
  ])

  const champPhases = phases || []
  const entryPhaseIds = champPhases.length
    ? new Set(
        champPhases
          .filter((phase: any) => Number(phase.ordem || 0) === Math.min(...champPhases.map((current: any) => Number(current.ordem || 0))))
          .map((phase: any) => String(phase.id)),
      )
    : null

  const entrySlots = (slots || []).filter((slot: any) => {
    if (!entryPhaseIds || entryPhaseIds.size === 0) return true
    return !slot.fase_id || entryPhaseIds.has(String(slot.fase_id))
  })
  const physicalFree = entrySlots.filter((slot: any) => !slot.equipe_id && !slot.line_id).length
  const now = Date.now()
  const commercialReservations = (purchases || []).filter((purchase: any) => {
    if (purchase.status === 'pendente') {
      return !purchase.expira_em || new Date(purchase.expira_em).getTime() > now
    }
    return purchase.status === 'pago' || purchase.status === 'liberado'
  }).length
  const officialTotal = Math.max(0, Math.floor(Number(config?.numero_vagas || 0)))
  const occupied = entrySlots.filter((slot: any) => Boolean(slot.equipe_id || slot.line_id)).length
  const officialFree = Math.max(0, officialTotal - occupied)
  const vagasLivres = Math.max(0, officialFree - commercialReservations)
  return {
    ...championship,
    ...(config || {}),
    premiacao_texto: championship.premiacao,
    premiacao_valor: config?.premiacao ?? null,
    vagas_livres: vagasLivres,
    vagas_fisicamente_livres: physicalFree,
    vagas_em_compra: commercialReservations,
    total_slots: entrySlots.length,
    total_vagas: officialTotal,
    price_mode: liliPriceMode(config?.valor_inscricao),
    prazo_aberto: liliRegistrationDeadlineOpen(config?.data_limite_inscricao),
  }
}
