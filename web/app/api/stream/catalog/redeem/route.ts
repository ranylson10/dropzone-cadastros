import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingDatabaseObject(error: any) {
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code || '')
}

/** Resgata código de compra de forma atômica no banco. */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const code = String(body.code || '').trim().toUpperCase()
    if (!/^DZ-[A-Z0-9]{4,16}-[A-Z0-9]{4,16}$/.test(code)) {
      return NextResponse.json({ error: 'Informe um código de compra válido.' }, { status: 400 })
    }

    const { data: copy, error } = await supabaseAdmin.rpc('fn_resgatar_stream_overlay_code', {
      p_code: code,
      p_user_id: user.id,
    })

    if (error) {
      if (missingDatabaseObject(error)) {
        return NextResponse.json(
          { error: 'A atualização de segurança do resgate ainda não foi instalada no banco.', migration_required: true },
          { status: 503 },
        )
      }
      throw error
    }

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
