import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingTable(error: any) {
  return ['42P01', 'PGRST205'].includes(error?.code || '')
}

/**
 * Resgata código de compra → cria entitlement (purchase).
 * O comprador poderá usar o modelo, mas NÃO republicar nem revender.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const code = String(body.code || '').trim().toUpperCase()
    if (!code || code.length < 6) {
      return NextResponse.json({ error: 'Informe o código de compra.' }, { status: 400 })
    }

    const { data: row, error } = await supabaseAdmin
      .from('stream_overlay_purchase_codes')
      .select('*')
      .eq('code', code)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({ error: 'Catálogo ausente no banco.', missing_table: true }, { status: 503 })
      }
      throw error
    }
    if (!row) return NextResponse.json({ error: 'Código inválido ou inativo.' }, { status: 404 })
    if (row.owner_user_id === user.id) {
      return NextResponse.json({ error: 'Você já é o dono deste modelo.' }, { status: 400 })
    }
    if (Number(row.redemption_count || 0) >= Number(row.max_redemptions || 1)) {
      return NextResponse.json({ error: 'Este código já foi usado.' }, { status: 400 })
    }

    const { data: model, error: e1 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('*')
      .eq('id', row.catalog_id)
      .eq('ativo', true)
      .maybeSingle()
    if (e1) throw e1
    if (!model) return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 })
    if (model.is_purchased_copy) {
      return NextResponse.json({ error: 'Este modelo não pode ser revendido.' }, { status: 403 })
    }

    // incrementa resgate
    const { error: e2 } = await supabaseAdmin
      .from('stream_overlay_purchase_codes')
      .update({ redemption_count: Number(row.redemption_count || 0) + 1 })
      .eq('id', row.id)
      .eq('redemption_count', row.redemption_count)
    if (e2) throw e2

    // entitlement purchase
    await supabaseAdmin.from('stream_overlay_entitlements').upsert(
      {
        catalog_id: model.id,
        user_id: user.id,
        source: 'purchase',
        purchase_code_id: row.id,
      },
      { onConflict: 'catalog_id,user_id' },
    )

    // cópia privada no catálogo do comprador (marcador is_purchased_copy)
    // para ele ter “meus modelos” com restrição — opcional; entitlement já basta.
    // Criamos cópia restrita:
    const { data: copy, error: e3 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .insert({
        owner_user_id: user.id,
        nome: `${model.nome} (comprado)`,
        descricao: model.descricao || '',
        blocks: model.blocks,
        visibility: 'private',
        is_purchased_copy: true,
        source_catalog_id: model.id,
        price_label: null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (e3) throw e3

    await supabaseAdmin.from('stream_overlay_entitlements').upsert(
      {
        catalog_id: copy.id,
        user_id: user.id,
        source: 'purchase',
        purchase_code_id: row.id,
      },
      { onConflict: 'catalog_id,user_id' },
    )

    return NextResponse.json({
      model: {
        ...copy,
        name: copy.nome,
        description: copy.descricao,
        is_mine: true,
        entitled: true,
        entitlement_source: 'purchase',
      },
      message: 'Compra confirmada. Modelo liberado (uso privado — sem republicar nem revender).',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao resgatar código.' }, { status: 400 })
  }
}
