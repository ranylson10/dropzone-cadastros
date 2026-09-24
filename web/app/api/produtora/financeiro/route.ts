import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  createProducerFinanceEntry,
  deleteProducerFinanceEntry,
  loadProducerFinanceSummary,
  saveProducerFinanceGoal,
  updateProducerFinanceEntry,
} from '@backend/produtora/finance'

function producerIdFromRequest(req: NextRequest, body?: any) {
  return String(
    body?.produtora_id
      || req.headers.get('x-produtora-id')
      || req.nextUrl.searchParams.get('produtora_id')
      || '',
  ).trim()
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtoraId = producerIdFromRequest(req)
    if (!produtoraId) throw new Error('Produtora não informada.')
    const summary = await loadProducerFinanceSummary({
      authUserId: user.id,
      produtoraId,
      period: req.nextUrl.searchParams.get('periodo'),
      campeonatoId: req.nextUrl.searchParams.get('campeonato_id'),
    })
    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar financeiro gerencial.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const produtoraId = producerIdFromRequest(req, body)
    if (!produtoraId) throw new Error('Produtora não informada.')
    if (String(body.action || '') === 'meta') {
      const meta = await saveProducerFinanceGoal({
        authUserId: user.id,
        produtoraId,
        period: body.periodo,
        metaReceitaCentavos: body.meta_receita_centavos,
        metaLucroCentavos: body.meta_lucro_centavos,
        metaVagas: body.meta_vagas,
      })
      return NextResponse.json({ ok: true, meta })
    }
    const lancamento = await createProducerFinanceEntry({
      authUserId: user.id,
      produtoraId,
      campeonatoId: body.campeonato_id,
      tipo: body.tipo,
      categoria: body.categoria,
      descricao: body.descricao,
      valorCentavos: body.valor_centavos,
      dataCompetencia: body.data_competencia,
      status: body.status,
      observacao: body.observacao,
    })
    return NextResponse.json({ ok: true, lancamento })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar financeiro gerencial.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const produtoraId = producerIdFromRequest(req, body)
    if (!produtoraId) throw new Error('Produtora não informada.')
    const lancamento = await updateProducerFinanceEntry({
      authUserId: user.id,
      produtoraId,
      entryId: String(body.lancamento_id || body.id || '').trim(),
      campeonatoId: body.campeonato_id,
      tipo: body.tipo,
      categoria: body.categoria,
      descricao: body.descricao,
      valorCentavos: body.valor_centavos,
      dataCompetencia: body.data_competencia,
      status: body.status,
      observacao: body.observacao,
    })
    return NextResponse.json({ ok: true, lancamento })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar lançamento financeiro.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtoraId = producerIdFromRequest(req)
    const entryId = String(req.nextUrl.searchParams.get('lancamento_id') || '').trim()
    if (!produtoraId || !entryId) throw new Error('Lançamento não informado.')
    await deleteProducerFinanceEntry({ authUserId: user.id, produtoraId, entryId })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover lançamento financeiro.' }, { status: 400 })
  }
}
