import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { setAprovacao, type AprovacaoStatus } from '@backend/admin/aprovacao'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const status = req.nextUrl.searchParams.get('status') || 'pendente'

    const [produtoras, campeonatos, cobrancas] = await Promise.all([
      supabaseAdmin
        .from('produtoras')
        .select('id,nome,username,logo_url,status,aprovacao_status,aprovacao_motivo,created_at,email_contato')
        .eq('aprovacao_status', status)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('campeonatos')
        .select('id,nome,tipo,logo_url,status,aprovacao_status,aprovacao_motivo,produtora_id,created_at')
        .eq('aprovacao_status', status)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('campeonato_cobranca')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200),
    ])

    // Se coluna ainda não existe, devolve vazio com aviso
    for (const r of [produtoras, campeonatos]) {
      if (r.error && ['42703', 'PGRST204'].includes(r.error.code || '')) {
        return NextResponse.json({
          produtoras: [],
          campeonatos: [],
          cobrancas: [],
          needs_migration: true,
          error: 'Rode database/migrations/20260719_sistema_aprovacao_precos.sql',
        })
      }
      if (r.error) throw r.error
    }

    const cobrancaByChamp = new Map(
      (cobrancas.data || []).map((c: any) => [c.campeonato_id, c]),
    )

    return NextResponse.json({
      produtoras: produtoras.data || [],
      campeonatos: (campeonatos.data || []).map((c: any) => ({
        ...c,
        cobranca: cobrancaByChamp.get(c.id) || null,
      })),
      cobrancas: cobrancas.error ? [] : cobrancas.data || [],
      needs_migration: false,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 403 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json()
    const alvo = String(body.alvo || '') as 'produtora' | 'campeonato'
    const id = String(body.id || '').trim()
    const status = String(body.status || '') as AprovacaoStatus
    const motivo = body.motivo != null ? String(body.motivo) : null

    if (!['produtora', 'campeonato'].includes(alvo)) throw new Error('Alvo inválido.')
    if (!id) throw new Error('ID obrigatório.')
    if (!['pendente', 'aprovado', 'rejeitado'].includes(status)) throw new Error('Status inválido.')

    const updated = await setAprovacao({
      alvo,
      id,
      status,
      motivo,
      adminUserId: admin.id,
    })

    // Ao aprovar campeonato, se cobrança pendente e admin marcou pago/cortesia
    if (alvo === 'campeonato' && body.cobranca_status) {
      const cobStatus = String(body.cobranca_status)
      if (['pendente', 'pago', 'cortesia', 'isento', 'cancelado'].includes(cobStatus)) {
        await supabaseAdmin
          .from('campeonato_cobranca')
          .update({
            status: cobStatus,
            pago_em: cobStatus === 'pago' ? new Date().toISOString() : null,
            atualizado_por: admin.id,
            updated_at: new Date().toISOString(),
            observacao: body.cobranca_obs != null ? String(body.cobranca_obs) : undefined,
          })
          .eq('campeonato_id', id)
      }
    }

    return NextResponse.json({ ok: true, item: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}
