import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { loadPriceTable, quoteChampionshipPrice } from '@backend/admin/pricing'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const table = await loadPriceTable()
    const sample = await quoteChampionshipPrice({
      tipo: 'copa',
      numero_vagas: 16,
      recursos: { export: true, stream: true, rulebook: true, stats: true, broadcast: false },
    })
    return NextResponse.json({ precos: table, exemplo: sample })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 403 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json()
    const chave = String(body.chave || '').trim()
    if (!chave) throw new Error('chave obrigatória.')
    const valorCentavos = Math.max(0, Math.floor(Number(body.valor_centavos)))
    if (!Number.isFinite(valorCentavos)) throw new Error('valor_centavos inválido.')

    const { data, error } = await supabaseAdmin
      .from('sistema_precos')
      .update({
        valor_centavos: valorCentavos,
        ativo: body.ativo === undefined ? true : Boolean(body.ativo),
        meta: { custom: true },
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      })
      .eq('chave', chave)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Chave de preço não encontrada.')

    await supabaseAdmin.from('sistema_auditoria').insert({
      administrador_auth_user_id: admin.id,
      acao: 'preco_atualizado',
      alvo_tipo: 'sistema_precos',
      alvo_id: chave,
      detalhes: { valor_centavos: valorCentavos },
    })

    return NextResponse.json({ preco: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}

/** Preview público autenticado? Só admin — cálculo interno também em create. */
export async function POST(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const body = await req.json()
    const quote = await quoteChampionshipPrice({
      tipo: body.tipo,
      numero_vagas: body.numero_vagas,
      recursos: body.recursos || {},
    })
    return NextResponse.json({ quote })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}
