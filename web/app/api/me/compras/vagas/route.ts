import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const { data: purchases, error } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .select('id,token,campeonato_id,status,pagamento_id,meta,updated_at')
      .eq('auth_user_id', user.id)
      .in('status', ['pago', 'liberado', 'consumido'])
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) throw error
    const championshipIds = [...new Set((purchases || []).map((item: any) => String(item.campeonato_id || '')).filter(Boolean))]
    const { data: championships, error: championshipsError } = championshipIds.length
      ? await supabaseAdmin.from('campeonatos').select('id,nome,logo_url').in('id', championshipIds)
      : { data: [], error: null }
    if (championshipsError) throw championshipsError
    const championshipById = new Map((championships || []).map((item: any) => [String(item.id), item]))
    return NextResponse.json({
      items: (purchases || []).map((purchase: any) => {
        const championship = championshipById.get(String(purchase.campeonato_id)) || null
        return {
          id: purchase.id,
          token: purchase.token,
          status: purchase.status,
          quantity: Math.max(1, Number(purchase.meta?.quantidade_vagas || 1)),
          updated_at: purchase.updated_at,
          championship,
          claim_url: `/vagas/compra/${encodeURIComponent(String(purchase.token))}`,
        }
      }),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar suas compras.' }, { status: 400 })
  }
}
