import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, permissionPublicPayload } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const MUTABLE_TABLES = new Set([
  'campeonato_divisoes',
  'campeonato_etapas',
  'campeonato_etapa_fontes',
  'campeonato_progressao_regras',
  'campeonato_etapa_premiacoes',
  'campeonato_diario_horarios',
])

function text(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max)
}

function nullableText(value: unknown, max = 500) {
  const result = text(value, max)
  return result || null
}

function positiveInt(value: unknown, nullable = true) {
  if (value === '' || value == null) return nullable ? null : 0
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error('Valor inteiro inválido.')
  return parsed
}

function money(value: unknown) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Valor monetário inválido.')
  return parsed
}

async function loadStructure(campeonatoId: string) {
  const { data: edition, error: editionError } = await supabaseAdmin
    .from('campeonato_edicoes')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (editionError) throw editionError

  if (!edition) {
    const { data: dailyHours, error: dailyError } = await supabaseAdmin
      .from('campeonato_diario_horarios')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .order('horario')
    if (dailyError) throw dailyError
    return { edition: null, franchise: null, divisions: [], stages: [], sources: [], progressions: [], prizes: [], dailyHours: dailyHours || [] }
  }

  const [{ data: franchise, error: franchiseError }, divisionsResult, stagesResult, dailyResult] = await Promise.all([
    supabaseAdmin.from('campeonato_franquias').select('*').eq('id', edition.franquia_id).maybeSingle(),
    supabaseAdmin.from('campeonato_divisoes').select('*').eq('edicao_id', edition.id).order('ordem'),
    supabaseAdmin.from('campeonato_etapas').select('*').eq('edicao_id', edition.id).order('ordem'),
    supabaseAdmin.from('campeonato_diario_horarios').select('*').eq('campeonato_id', campeonatoId).order('horario'),
  ])
  if (franchiseError) throw franchiseError
  if (divisionsResult.error) throw divisionsResult.error
  if (stagesResult.error) throw stagesResult.error
  if (dailyResult.error) throw dailyResult.error

  const stageIds = (stagesResult.data || []).map((row) => String(row.id))
  let sources: unknown[] = []
  let progressions: unknown[] = []
  let prizes: unknown[] = []
  if (stageIds.length) {
    const [sourcesResult, progressionsResult, prizesResult] = await Promise.all([
      supabaseAdmin.from('campeonato_etapa_fontes').select('*').in('etapa_destino_id', stageIds).order('created_at'),
      supabaseAdmin.from('campeonato_progressao_regras').select('*').in('etapa_origem_id', stageIds).order('created_at'),
      supabaseAdmin.from('campeonato_etapa_premiacoes').select('*').in('etapa_id', stageIds).order('posicao'),
    ])
    if (sourcesResult.error) throw sourcesResult.error
    if (progressionsResult.error) throw progressionsResult.error
    if (prizesResult.error) throw prizesResult.error
    sources = sourcesResult.data || []
    progressions = progressionsResult.data || []
    prizes = prizesResult.data || []
  }

  return {
    edition,
    franchise: franchise || null,
    divisions: divisionsResult.data || [],
    stages: stagesResult.data || [],
    sources,
    progressions,
    prizes,
    dailyHours: dailyResult.data || [],
  }
}

async function context(request: NextRequest, campeonatoId: string) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ') || !authorization.slice(7).trim()) {
    throw new Error('UNAUTHORIZED')
  }

  let user: Awaited<ReturnType<typeof getBearerUser>>
  try {
    user = await getBearerUser(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Sessao ausente.' || message === 'Sessao invalida.') {
      throw new Error('UNAUTHORIZED')
    }
    throw error
  }

  const permission = await getCampeonatoPermission(user.id, campeonatoId)
  if (!permission.canView || permission.role === 'none') throw new Error('FORBIDDEN')
  return { user, permission }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { permission } = await context(request, id)
    const structure = await loadStructure(id)
    return NextResponse.json({ ok: true, permission: permissionPublicPayload(permission), ...structure })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar estrutura avançada.'
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ error: message === 'UNAUTHORIZED' ? 'Não autenticado.' : message === 'FORBIDDEN' ? 'Sem permissão.' : message }, { status })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campeonatoId } = await params
    const { user, permission } = await context(request, campeonatoId)
    if (!permission.canManage) return NextResponse.json({ error: 'Sem permissão para alterar este campeonato.' }, { status: 403 })
    const body = await request.json()
    const action = text(body?.action, 60)

    if (action === 'save_edition') {
      const franchiseName = text(body?.franchise_name)
      if (!franchiseName) throw new Error('Informe o nome histórico do campeonato.')
      let franchiseId = text(body?.franchise_id)
      if (franchiseId) {
        const { error } = await supabaseAdmin.from('campeonato_franquias').update({
          nome: franchiseName,
          descricao: nullableText(body?.franchise_description, 1200),
          status: text(body?.franchise_status || 'ativo', 20),
        }).eq('id', franchiseId)
        if (error) throw error
      } else {
        const { data, error } = await supabaseAdmin.from('campeonato_franquias').insert({
          nome: franchiseName,
          descricao: nullableText(body?.franchise_description, 1200),
          criado_por: user.id,
        }).select('id').single()
        if (error) throw error
        franchiseId = String(data.id)
      }
      const editionPayload = {
        franquia_id: franchiseId,
        campeonato_id: campeonatoId,
        numero_edicao: positiveInt(body?.edition_number),
        temporada: nullableText(body?.season, 80),
        titulo_publico: nullableText(body?.public_title, 180),
        status: text(body?.edition_status || 'planejada', 20),
      }
      const { error } = await supabaseAdmin.from('campeonato_edicoes').upsert(editionPayload, { onConflict: 'campeonato_id' })
      if (error) throw error
    } else if (action === 'create_division') {
      const editionId = text(body?.edition_id)
      const name = text(body?.name)
      if (!editionId || !name) throw new Error('Edição e nome da série são obrigatórios.')
      const { error } = await supabaseAdmin.from('campeonato_divisoes').insert({
        edicao_id: editionId,
        nome: name,
        codigo: nullableText(body?.code, 30),
        ordem: positiveInt(body?.order, false) || 1,
        descricao: nullableText(body?.description, 800),
        premiacao_descricao: nullableText(body?.prize_description, 500),
        premiacao_valor: money(body?.prize_value),
        premia_mvp: Boolean(body?.awards_mvp),
      })
      if (error) throw error
    } else if (action === 'create_stage') {
      const editionId = text(body?.edition_id)
      const name = text(body?.name)
      if (!editionId || !name) throw new Error('Edição e nome da etapa são obrigatórios.')
      const { error } = await supabaseAdmin.from('campeonato_etapas').insert({
        edicao_id: editionId,
        divisao_id: nullableText(body?.division_id, 50),
        nome: name,
        ordem: positiveInt(body?.order, false) || 1,
        tipo: text(body?.type || 'outra', 30),
        formato: text(body?.format || 'outro', 30),
        capacidade_total: positiveInt(body?.capacity),
        vagas_venda_direta: positiveInt(body?.direct_sales, false),
        valor_vaga: money(body?.vacancy_value),
        classificam_quantidade: positiveInt(body?.qualifiers),
        premiacao_descricao: nullableText(body?.prize_description, 500),
        premiacao_valor: money(body?.prize_value),
        premia_mvp: Boolean(body?.awards_mvp),
      })
      if (error) throw error
    } else if (action === 'create_source') {
      const { error } = await supabaseAdmin.from('campeonato_etapa_fontes').insert({
        etapa_destino_id: text(body?.stage_id),
        tipo_origem: text(body?.source_type, 30),
        etapa_origem_id: nullableText(body?.source_stage_id, 50),
        divisao_origem_id: nullableText(body?.source_division_id, 50),
        quantidade: positiveInt(body?.quantity, false),
        descricao: nullableText(body?.description, 500),
      })
      if (error) throw error
    } else if (action === 'create_progression') {
      const type = text(body?.progression_type, 30)
      const { error } = await supabaseAdmin.from('campeonato_progressao_regras').insert({
        etapa_origem_id: text(body?.stage_id),
        etapa_destino_id: nullableText(body?.destination_stage_id, 50),
        divisao_destino_id: nullableText(body?.destination_division_id, 50),
        tipo: type,
        posicao_inicio: positiveInt(body?.position_start),
        posicao_fim: positiveInt(body?.position_end),
        quantidade: positiveInt(body?.quantity),
        automatica: Boolean(body?.automatic),
        descricao: nullableText(body?.description, 500),
      })
      if (error) throw error
    } else if (action === 'create_prize') {
      const { error } = await supabaseAdmin.from('campeonato_etapa_premiacoes').insert({
        etapa_id: text(body?.stage_id),
        tipo: text(body?.prize_type || 'colocacao', 30),
        posicao: positiveInt(body?.position),
        titulo: nullableText(body?.title, 120),
        valor: money(body?.value),
        descricao: nullableText(body?.description, 500),
      })
      if (error) throw error
    } else if (action === 'create_daily_hour') {
      const hour = text(body?.hour, 8)
      if (!hour) throw new Error('Informe o horário.')
      const { error } = await supabaseAdmin.from('campeonato_diario_horarios').insert({
        campeonato_id: campeonatoId,
        horario: hour,
        nome_exibicao: nullableText(body?.display_name, 80),
        capacidade: positiveInt(body?.capacity),
        valor_vaga: money(body?.vacancy_value),
        premiacao_descricao: nullableText(body?.prize_description, 500),
        premiacao_valor: money(body?.prize_value),
        mapa: nullableText(body?.map, 80),
        numero_quedas: positiveInt(body?.drops, false) || 1,
      })
      if (error) throw error
    } else if (action === 'delete') {
      const table = text(body?.table, 80)
      const rowId = text(body?.row_id, 60)
      if (!MUTABLE_TABLES.has(table) || !rowId) throw new Error('Exclusão inválida.')
      const { error } = await supabaseAdmin.from(table).delete().eq('id', rowId)
      if (error) throw error
    } else {
      throw new Error('Ação não reconhecida.')
    }

    return NextResponse.json({ ok: true, ...(await loadStructure(campeonatoId)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao salvar estrutura avançada.'
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ error: message === 'UNAUTHORIZED' ? 'Não autenticado.' : message }, { status })
  }
}

export async function PATCH(request: NextRequest, contextParams: { params: Promise<{ id: string }> }) {
  return POST(request, contextParams)
}

export async function DELETE(request: NextRequest, contextParams: { params: Promise<{ id: string }> }) {
  return POST(request, contextParams)
}

