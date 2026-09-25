import { NextRequest, NextResponse } from 'next/server'
import { getAccountsByUserId, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

type JourneySummary = {
  campeonato_equipe_id: string
  campeonato_id: string
  equipe_id: string
  line_id?: string | null
  grupo_id?: string | null
  slot_equipe?: number | null
  status_participacao?: string | null
  campeonato_nome?: string | null
  line_nome?: string | null
  line_logo_url?: string | null
  grupo_nome?: string | null
  fase_nome?: string | null
  limite_jogadores?: number | null
  jogadores_confirmados?: number | null
  vagas_disponiveis?: number | null
  data_jogo?: string | null
  horario?: string | null
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || '')).filter(Boolean))]
}

function safeStatus(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function playerJourneyStatus(row: any) {
  const status = safeStatus(row?.status)
  if (status === 'ativo') return 'escalado'
  return status || 'inscrito'
}

function purchaseAction(status: string, token: string) {
  if (!token) return null
  if (['pendente', 'pago', 'liberado'].includes(status)) return `/vagas/compra/${encodeURIComponent(token)}`
  return null
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsByUserId(user.id)
    const directPlayerIds = unique(accounts.filter((account) => account.profile_type === 'jogador').map((account) => account.id))
    const controllableTeams = await listControllableEquipes(user.id, accounts)
    const teamIds = unique(controllableTeams.map((team) => team.id))

    const [teamSummariesResult, playerRowsResult, purchasesResult] = await Promise.all([
      teamIds.length
        ? supabaseAdmin
            .from('campeonato_escalacoes_resumo')
            .select('campeonato_equipe_id,campeonato_id,equipe_id,line_id,grupo_id,slot_equipe,status_participacao,campeonato_nome,line_nome,line_logo_url,grupo_nome,fase_nome,limite_jogadores,jogadores_confirmados,vagas_disponiveis,data_jogo,horario')
            .in('equipe_id', teamIds)
        : Promise.resolve({ data: [], error: null }),
      directPlayerIds.length
        ? supabaseAdmin
            .from('campeonato_jogadores')
            .select('id,campeonato_id,campeonato_equipe_id,equipe_id,line_id,jogador_id,nick,status,slot_numero,capitao,created_at,updated_at')
            .in('jogador_id', directPlayerIds)
            .neq('status', 'deletado')
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from('sistema_compras_vaga')
        .select('id,token,campeonato_id,status,valor_centavos,pagamento_id,equipe_id,line_id,campeonato_equipe_id,pago_em,liberado_em,consumido_em,expira_em,meta,created_at,updated_at')
        .eq('auth_user_id', user.id)
        .in('status', ['pendente', 'pago', 'liberado', 'consumido'])
        .order('updated_at', { ascending: false })
        .limit(100),
    ])

    for (const result of [teamSummariesResult, playerRowsResult, purchasesResult]) {
      if (result.error) throw result.error
    }

    const teamSummaries = (teamSummariesResult.data || []) as JourneySummary[]
    const playerRows = playerRowsResult.data || []
    const now = Date.now()
    const activePurchases = (purchasesResult.data || []).filter((row: any) => {
      const status = safeStatus(row.status)
      if (status !== 'pendente') return true
      const expiresAt = row.expira_em ? new Date(String(row.expira_em)).getTime() : 0
      return !expiresAt || Number.isNaN(expiresAt) || expiresAt > now
    })
    const playerParticipationIds = unique(playerRows.map((row: any) => row.campeonato_equipe_id))

    const playerSummaryResult = playerParticipationIds.length
      ? await supabaseAdmin
          .from('campeonato_escalacoes_resumo')
          .select('campeonato_equipe_id,campeonato_id,equipe_id,line_id,grupo_id,slot_equipe,status_participacao,campeonato_nome,line_nome,line_logo_url,grupo_nome,fase_nome,limite_jogadores,jogadores_confirmados,vagas_disponiveis,data_jogo,horario')
          .in('campeonato_equipe_id', playerParticipationIds)
      : { data: [], error: null }
    if (playerSummaryResult.error) throw playerSummaryResult.error

    const playerSummaryByParticipation = new Map(
      (playerSummaryResult.data || []).map((row: any) => [String(row.campeonato_equipe_id), row]),
    )

    const championshipIds = unique([
      ...teamSummaries.map((row) => row.campeonato_id),
      ...playerRows.map((row: any) => row.campeonato_id),
      ...activePurchases.map((row: any) => row.campeonato_id),
    ])
    const teamDetailIds = unique([
      ...teamSummaries.map((row) => row.equipe_id),
      ...playerRows.map((row: any) => row.equipe_id),
    ])

    const [championshipsResult, configsResult, teamsResult] = await Promise.all([
      championshipIds.length
        ? supabaseAdmin
            .from('campeonatos')
            .select('id,nome,tipo,logo_url,banner_url,status')
            .in('id', championshipIds)
        : Promise.resolve({ data: [], error: null }),
      championshipIds.length
        ? supabaseAdmin
            .from('campeonato_configuracoes')
            .select('campeonato_id,valor_inscricao,premiacao,data_limite_inscricao')
            .in('campeonato_id', championshipIds)
        : Promise.resolve({ data: [], error: null }),
      teamDetailIds.length
        ? supabaseAdmin
            .from('equipes')
            .select('id,nome,tag,logo_url')
            .in('id', teamDetailIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    for (const result of [championshipsResult, configsResult, teamsResult]) {
      if (result.error) throw result.error
    }

    const championshipById = new Map((championshipsResult.data || []).map((row: any) => [String(row.id), row]))
    const configByChampionship = new Map((configsResult.data || []).map((row: any) => [String(row.campeonato_id), row]))
    const teamById = new Map((teamsResult.data || []).map((row: any) => [String(row.id), row]))

    const team = teamSummaries.map((row) => {
      const championship: any = championshipById.get(String(row.campeonato_id)) || {}
      const config: any = configByChampionship.get(String(row.campeonato_id)) || {}
      const equipe: any = teamById.get(String(row.equipe_id)) || {}
      const limit = Math.max(1, Number(row.limite_jogadores || 0) || 1)
      const confirmed = Math.max(0, Number(row.jogadores_confirmados || 0))
      return {
        ...row,
        campeonato_nome: row.campeonato_nome || championship.nome || 'Campeonato',
        campeonato_tipo: championship.tipo || null,
        campeonato_logo_url: championship.logo_url || null,
        equipe_nome: equipe.nome || null,
        equipe_tag: equipe.tag || null,
        equipe_logo_url: equipe.logo_url || null,
        valor_inscricao: config.valor_inscricao != null ? Number(config.valor_inscricao) : null,
        premiacao: config.premiacao != null ? Number(config.premiacao) : null,
        data_limite_inscricao: config.data_limite_inscricao || null,
        escalacao_completa: confirmed >= limit,
        agenda_href: `/agenda?scope=campeonato&id=${encodeURIComponent(String(row.campeonato_id))}`,
        resultados_href: `/campeonatos/${encodeURIComponent(String(row.campeonato_id))}?aba=estatisticas`,
        campeonato_href: `/campeonatos/${encodeURIComponent(String(row.campeonato_id))}`,
      }
    })

    const player = playerRows.map((row: any) => {
      const championship: any = championshipById.get(String(row.campeonato_id)) || {}
      const config: any = configByChampionship.get(String(row.campeonato_id)) || {}
      const equipe: any = teamById.get(String(row.equipe_id)) || {}
      const summary: any = playerSummaryByParticipation.get(String(row.campeonato_equipe_id)) || {}
      return {
        campeonato_jogador_id: row.id,
        campeonato_id: row.campeonato_id,
        campeonato_equipe_id: row.campeonato_equipe_id,
        equipe_id: row.equipe_id,
        line_id: row.line_id,
        jogador_id: row.jogador_id,
        nick: row.nick,
        slot_numero: row.slot_numero,
        capitao: Boolean(row.capitao),
        status: playerJourneyStatus(row),
        campeonato_nome: summary.campeonato_nome || championship.nome || 'Campeonato',
        campeonato_tipo: championship.tipo || null,
        campeonato_logo_url: championship.logo_url || null,
        equipe_nome: equipe.nome || null,
        equipe_tag: equipe.tag || null,
        line_nome: summary.line_nome || null,
        grupo_nome: summary.grupo_nome || null,
        fase_nome: summary.fase_nome || null,
        data_jogo: summary.data_jogo || null,
        horario: summary.horario || null,
        valor_inscricao: config.valor_inscricao != null ? Number(config.valor_inscricao) : null,
        premiacao: config.premiacao != null ? Number(config.premiacao) : null,
        agenda_href: `/agenda?scope=campeonato&id=${encodeURIComponent(String(row.campeonato_id))}`,
        resultados_href: `/campeonatos/${encodeURIComponent(String(row.campeonato_id))}?aba=estatisticas`,
        campeonato_href: `/campeonatos/${encodeURIComponent(String(row.campeonato_id))}`,
      }
    })

    const purchases = activePurchases.map((row: any) => {
      const championship: any = championshipById.get(String(row.campeonato_id)) || {}
      const status = safeStatus(row.status)
      return {
        id: row.id,
        token: row.token,
        campeonato_id: row.campeonato_id,
        campeonato_equipe_id: row.campeonato_equipe_id,
        equipe_id: row.equipe_id,
        line_id: row.line_id,
        status,
        valor_centavos: Number(row.valor_centavos || 0),
        quantidade: Math.max(1, Number(row.meta?.quantidade_vagas || 1)),
        pago_em: row.pago_em,
        liberado_em: row.liberado_em,
        consumido_em: row.consumido_em,
        expira_em: row.expira_em,
        updated_at: row.updated_at,
        campeonato_nome: championship.nome || 'Campeonato',
        campeonato_logo_url: championship.logo_url || null,
        claim_url: purchaseAction(status, String(row.token || '')),
      }
    })

    return NextResponse.json({ team, player, purchases }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar suas competições.' }, { status: 400 })
  }
}
