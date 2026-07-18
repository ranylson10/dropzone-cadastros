import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingTable(error: any) {
  return ['42P01', 'PGRST205'].includes(error?.code || '')
}

function genCode() {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DZ-${chunk()}-${chunk()}`
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const { data: model, error: e0 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('id, owner_user_id, is_purchased_copy, visibility')
      .eq('id', id)
      .maybeSingle()
    if (e0) {
      if (missingTable(e0)) return NextResponse.json({ codes: [], missing_table: true })
      throw e0
    }
    if (!model || model.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    const { data, error } = await supabaseAdmin
      .from('stream_overlay_purchase_codes')
      .select('*')
      .eq('catalog_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return NextResponse.json({ codes: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar códigos.' }, { status: 400 })
  }
}

/** POST — gera código de venda (1 uso por padrão) */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const { data: model, error: e0 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle()
    if (e0) {
      if (missingTable(e0)) {
        return NextResponse.json({ error: 'Catálogo ausente no banco.', missing_table: true }, { status: 503 })
      }
      throw e0
    }
    if (!model || model.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Só o dono pode gerar códigos.' }, { status: 403 })
    }
    if (model.is_purchased_copy) {
      return NextResponse.json(
        { error: 'Modelo comprado não pode ser revendido (sem códigos de venda).' },
        { status: 403 },
      )
    }
    if (model.visibility !== 'for_sale' && model.visibility !== 'private' && model.visibility !== 'public') {
      return NextResponse.json({ error: 'Visibilidade inválida no modelo.' }, { status: 400 })
    }

    // tenta até 5 códigos únicos
    let code = genCode()
    let data: any = null
    let lastErr: any = null
    for (let i = 0; i < 5; i++) {
      code = genCode()
      const ins = await supabaseAdmin
        .from('stream_overlay_purchase_codes')
        .insert({
          catalog_id: id,
          owner_user_id: user.id,
          code,
          max_redemptions: 1,
          redemption_count: 0,
          ativo: true,
        })
        .select('*')
        .single()
      if (!ins.error) {
        data = ins.data
        break
      }
      lastErr = ins.error
    }
    if (!data) throw lastErr || new Error('Falha ao gerar código.')

    // se ainda privado, marca como for_sale
    if (model.visibility === 'private') {
      await supabaseAdmin
        .from('stream_overlay_catalog')
        .update({ visibility: 'for_sale', updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    return NextResponse.json({ code: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao gerar código.' }, { status: 400 })
  }
}
