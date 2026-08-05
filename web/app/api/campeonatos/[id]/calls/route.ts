import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoStructureWrite } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function assertXtreino(campeonatoId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,tipo')
    .eq('id', campeonatoId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Campeonato não encontrado.')
  if (String(data.tipo).toLowerCase() !== 'xtreino') throw new Error('Calls por mapa estão disponíveis apenas em Xtreinos.')
}

async function authorize(req: NextRequest, campeonatoId: string) {
  const user = await getBearerUser(req)
  await requireCampeonatoStructureWrite(user.id, campeonatoId)
  await assertXtreino(campeonatoId)
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await authorize(req, id)
    const [{ data: mapas, error: mapasError }, { data: calls, error: callsError }, { data: equipes, error: equipesError }, { data: vinculos, error: vinculosError }] = await Promise.all([
      supabaseAdmin.from('dropzone_mapas').select('id,codigo,nome,imagem_url,ordem').eq('ativo', true).order('ordem'),
      supabaseAdmin.from('xtreino_mapa_calls').select('*').eq('campeonato_id', id).eq('ativo', true).order('mapa_codigo').order('ordem'),
      supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,nome_exibicao,slot_numero,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)').eq('campeonato_id', id).neq('status', 'removida').order('slot_numero'),
      supabaseAdmin.from('xtreino_mapa_call_equipes').select('*').eq('campeonato_id', id),
    ])
    if (mapasError) throw mapasError
    if (callsError) throw callsError
    if (equipesError) throw equipesError
    if (vinculosError) throw vinculosError
    return NextResponse.json({ mapas: mapas || [], calls: calls || [], equipes: equipes || [], vinculos: vinculos || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar calls.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await authorize(req, id)
    const body = await req.json()
    const action = text(body.action)

    if (action === 'create_call') {
      const mapaCodigo = text(body.mapa_codigo).toLowerCase()
      const nome = text(body.nome)
      if (!mapaCodigo || !nome) throw new Error('Mapa e nome da call são obrigatórios.')
      const { data, error } = await supabaseAdmin.from('xtreino_mapa_calls').insert({
        campeonato_id: id,
        mapa_codigo: mapaCodigo,
        nome,
        observacao: text(body.observacao) || null,
        cor: text(body.cor) || '#d6b84b',
        ordem: Number(body.ordem || 0),
        poligono: Array.isArray(body.poligono) ? body.poligono : null,
        label_x: Number.isFinite(Number(body.label_x)) ? Number(body.label_x) : null,
        label_y: Number.isFinite(Number(body.label_y)) ? Number(body.label_y) : null,
      }).select('*').single()
      if (error) throw error
      return NextResponse.json({ call: data }, { status: 201 })
    }

    if (action === 'assign') {
      const callId = text(body.call_id)
      const participacaoId = text(body.campeonato_equipe_id)
      const tipo = body.tipo === 'alternativa' ? 'alternativa' : 'principal'
      if (!callId || !participacaoId) throw new Error('Call e equipe são obrigatórias.')

      const [{ data: call }, { data: participacao }] = await Promise.all([
        supabaseAdmin.from('xtreino_mapa_calls').select('id,mapa_codigo').eq('id', callId).eq('campeonato_id', id).maybeSingle(),
        supabaseAdmin.from('campeonato_equipes').select('id').eq('id', participacaoId).eq('campeonato_id', id).maybeSingle(),
      ])
      if (!call || !participacao) throw new Error('Call ou equipe não pertence a este Xtreino.')

      const { data, error } = await supabaseAdmin.from('xtreino_mapa_call_equipes').upsert({
        campeonato_id: id,
        call_id: callId,
        mapa_codigo: call.mapa_codigo,
        campeonato_equipe_id: participacaoId,
        tipo,
        permitir_conflito: Boolean(body.permitir_conflito),
        observacao: text(body.observacao) || null,
        cor: text(body.cor) || '#d6b84b',
        opacidade: Math.min(0.9, Math.max(0.1, Number(body.opacidade || 0.42))),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'call_id,campeonato_equipe_id,tipo' }).select('*').single()
      if (error) throw error
      return NextResponse.json({ vinculo: data })
    }

    throw new Error('Ação inválida.')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar calls.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await authorize(req, id)
    const body = await req.json()
    const callId = text(body.call_id)
    if (!callId) throw new Error('Call obrigatória.')
    const { data, error } = await supabaseAdmin.from('xtreino_mapa_calls').update({
      nome: text(body.nome),
      observacao: text(body.observacao) || null,
      cor: text(body.cor) || '#d6b84b',
      poligono: Array.isArray(body.poligono) ? body.poligono : undefined,
      label_x: body.label_x == null ? undefined : Number(body.label_x),
      label_y: body.label_y == null ? undefined : Number(body.label_y),
      updated_at: new Date().toISOString(),
    }).eq('id', callId).eq('campeonato_id', id).select('*').single()
    if (error) throw error
    return NextResponse.json({ call: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao editar call.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await authorize(req, id)
    const callId = text(req.nextUrl.searchParams.get('call_id'))
    const vinculoId = text(req.nextUrl.searchParams.get('vinculo_id'))
    if (vinculoId) {
      const { error } = await supabaseAdmin.from('xtreino_mapa_call_equipes').delete().eq('id', vinculoId).eq('campeonato_id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (!callId) throw new Error('Call obrigatória.')
    const { error } = await supabaseAdmin.from('xtreino_mapa_calls').delete().eq('id', callId).eq('campeonato_id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao excluir call.' }, { status: 400 })
  }
}
