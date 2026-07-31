import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, permissionPublicPayload } from '@backend/campeonatos/campeonato-permissions'
import { getCampeonatoCapacidade } from '@backend/campeonatos/capacidade'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

async function safeCount(table: string, campeonatoId: string, apply?: (query: any) => any, championshipColumn = 'campeonato_id') {
  let query: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq(championshipColumn, campeonatoId)
  if (apply) query = apply(query)
  const { count, error } = await query
  if (error && !missingRelation(error)) throw error
  return error ? 0 : Number(count || 0)
}

async function authorizedChampionships(userId: string) {
  const [championshipsResult, producersResult, managersResult] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,tipo,status,aprovacao_status,logo_url,produtora_id,criado_por,created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('produtoras').select('id').eq('auth_user_id', userId),
    supabaseAdmin.from('managers').select('id').eq('auth_user_id', userId).eq('status', 'ativo'),
  ])
  if (championshipsResult.error) throw championshipsResult.error
  if (producersResult.error) throw producersResult.error
  if (managersResult.error) throw managersResult.error

  const producerIds = (producersResult.data || []).map((row) => String(row.id)).filter(Boolean)
  const managerIds = (managersResult.data || []).map((row) => String(row.id)).filter(Boolean)
  const candidateIds = new Set<string>()

  for (const campeonato of championshipsResult.data || []) {
    if (campeonato.criado_por === userId || producerIds.includes(String(campeonato.produtora_id || ''))) {
      candidateIds.add(String(campeonato.id))
    }
  }

  if (managerIds.length) {
    const [staffResult, sellersResult, tokensResult] = await Promise.all([
      supabaseAdmin
        .from('manager_produtora')
        .select('produtora_id,pode_ver,pode_gerenciar_campeonato,status')
        .in('manager_id', managerIds)
        .eq('status', 'ativo'),
      supabaseAdmin
        .from('campeonato_vendedores')
        .select('campeonato_id,status')
        .in('manager_id', managerIds)
        .eq('status', 'ativo'),
      supabaseAdmin
        .from('tokens')
        .select('campeonato_id,status')
        .eq('tipo', 'manager_invite')
        .in('manager_id', managerIds)
        .eq('status', 'ativo'),
    ])

    if (staffResult.error && !missingRelation(staffResult.error)) throw staffResult.error
    if (sellersResult.error && !missingRelation(sellersResult.error)) throw sellersResult.error
    if (tokensResult.error && !missingRelation(tokensResult.error)) throw tokensResult.error

    const staffProducerIds = new Set(
      (staffResult.data || [])
        .filter((row) => Boolean(row.pode_ver) || Boolean(row.pode_gerenciar_campeonato))
        .map((row) => String(row.produtora_id)),
    )
    for (const campeonato of championshipsResult.data || []) {
      if (staffProducerIds.has(String(campeonato.produtora_id || ''))) candidateIds.add(String(campeonato.id))
    }
    for (const row of sellersResult.data || []) candidateIds.add(String(row.campeonato_id))
    for (const row of tokensResult.data || []) candidateIds.add(String(row.campeonato_id))
  }

  const visible = []
  for (const campeonato of championshipsResult.data || []) {
    if (!candidateIds.has(String(campeonato.id))) continue
    const permission = await getCampeonatoPermission(userId, campeonato.id)
    if (permission.role === 'owner' || permission.role === 'manager' || permission.role === 'seller') {
      visible.push({
        id: campeonato.id,
        nome: campeonato.nome,
        tipo: campeonato.tipo,
        status: campeonato.status,
        aprovacao_status: campeonato.aprovacao_status,
        logo_url: campeonato.logo_url,
        produtora_id: campeonato.produtora_id,
        created_at: campeonato.created_at,
        permission: permissionPublicPayload(permission),
      })
    }
  }
  return visible
}

async function championshipSummary(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!['owner', 'manager', 'seller'].includes(permission.role) || !permission.canView) {
    throw new Error('Você não tem vínculo autorizado com este campeonato.')
  }

  const { data: campeonato, error: campeonatoError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,status,aprovacao_status,logo_url,banner_url,produtora_id,created_at')
    .eq('id', campeonatoId)
    .is('deleted_at', null)
    .maybeSingle()
  if (campeonatoError) throw campeonatoError
  if (!campeonato) throw new Error('Campeonato não encontrado.')

  const [
    equipes,
    capacidade,
    grupos,
    jogos,
    quedas,
    resultados,
    pagamentosPendentes,
    pagamentosAprovados,
    rulebook,
  ] = await Promise.all([
    safeCount('campeonato_equipes', campeonatoId, (q) => q.eq('status', 'ativo')),
    getCampeonatoCapacidade(campeonatoId),
    safeCount('campeonato_grupos', campeonatoId),
    safeCount('campeonato_jogos', campeonatoId),
    safeCount('campeonato_partidas', campeonatoId),
    safeCount('campeonato_resultados_equipes', campeonatoId),
    safeCount('sistema_pagamentos', campeonatoId, (q) => q.eq('referencia_tipo', 'campeonato_cobranca').in('status', ['pendente', 'aguardando', 'pending']), 'referencia_id'),
    safeCount('sistema_pagamentos', campeonatoId, (q) => q.eq('referencia_tipo', 'campeonato_cobranca').in('status', ['aprovado', 'pago', 'paid', 'confirmed']), 'referencia_id'),
    supabaseAdmin.from('campeonato_rulebooks').select('id,status,published_at,updated_at').eq('campeonato_id', campeonatoId).maybeSingle(),
  ])

  if (rulebook.error && !missingRelation(rulebook.error)) throw rulebook.error

  const vagasTotais = Number(capacidade.limite_vagas ?? capacidade.slots_criados ?? 0)
  const vagasOcupadas = Math.min(vagasTotais || capacidade.slots_ocupados, capacidade.slots_ocupados)
  const vagasDisponiveis = Math.max(0, vagasTotais - vagasOcupadas)
  const jogosSemQuedas = Math.max(0, jogos - quedas)
  const resultadosPendentes = Math.max(0, quedas - resultados)

  return {
    campeonato,
    permission: permissionPublicPayload(permission),
    cards: {
      vagas: { total: vagasTotais, ocupadas: vagasOcupadas, disponiveis: vagasDisponiveis },
      equipes: { confirmadas: equipes },
      escalacoes: { incompletas: 0, status: 'aguardando_integracao' },
      grupos: { total: grupos, incompletos: 0 },
      jogos: { total: jogos, sem_quedas: jogosSemQuedas, quedas },
      resultados: { registrados: resultados, pendentes: resultadosPendentes },
      pagamentos: { pendentes: pagamentosPendentes, aprovados: pagamentosAprovados },
      regulamento: {
        publicado: Boolean(rulebook.data?.published_at || String(rulebook.data?.status || '').toLowerCase() === 'publicado'),
        status: rulebook.data?.status || 'não publicado',
      },
    },
    alerts: [
      ...(vagasDisponiveis === 0 ? [] : [{ severity: 'info', message: `${vagasDisponiveis} vaga(s) disponível(is).` }]),
      ...(jogosSemQuedas > 0 ? [{ severity: 'warning', message: `${jogosSemQuedas} jogo(s) sem quedas configuradas.` }] : []),
      ...(resultadosPendentes > 0 ? [{ severity: 'warning', message: `${resultadosPendentes} resultado(s) pendente(s).` }] : []),
      ...(!rulebook.data?.published_at ? [{ severity: 'critical', message: 'Regulamento ainda não publicado.' }] : []),
    ],
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const campeonatoId = String(req.nextUrl.searchParams.get('campeonato_id') || '').trim()
    if (!campeonatoId) {
      return NextResponse.json({ items: await authorizedChampionships(user.id) })
    }
    return NextResponse.json(await championshipSummary(user.id, campeonatoId))
  } catch (error: any) {
    const message = error?.message || 'Erro ao carregar a Central do Campeonato.'
    const status = /Sessao/.test(message) ? 401 : /vínculo|permissão/.test(message) ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
