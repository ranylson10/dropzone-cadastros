import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { randomBytes } from 'crypto'

function canStream(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.role === 'manager'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
  )
}

function missingTable(error: any) {
  return ['42P01', 'PGRST205'].includes(error?.code || '')
}

function newKeyToken() {
  return randomBytes(12).toString('hex')
}

/**
 * GET — chave Stream ativa do campeonato (ou null).
 * POST — gera / regenera chave (links antigos de streams já vinculados permanecem).
 * PATCH — altera o nome/identificação da chave ativa.
 * DELETE — revoga a chave ativa.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .select('id,key_token,label,ativo,created_at,updated_at')
      .eq('campeonato_id', id)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL de broadcast: database/migrations/20260718_broadcast_stream.sql',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ key: data || null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    // Chave Stream = "ir ao ar" — exige aprovação do admin do sistema
    try {
      const { assertCampeonatoNoAr } = await import('@backend/admin/aprovacao')
      await assertCampeonatoNoAr(id)
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (/aprovação|rejeitad|indisponível/i.test(msg)) {
        return NextResponse.json({ error: msg }, { status: 403 })
      }
      // se coluna/migração ausente, segue
    }

    const body = await req.json().catch(() => ({}))
    const regenerate = Boolean(body?.regenerate)

    // desativa chaves anteriores se regenerar
    if (regenerate) {
      await supabaseAdmin
        .from('campeonato_stream_keys')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('campeonato_id', id)
        .eq('ativo', true)
    } else {
      const { data: existing } = await supabaseAdmin
        .from('campeonato_stream_keys')
        .select('id,key_token,label,ativo,created_at,updated_at')
        .eq('campeonato_id', id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) return NextResponse.json({ key: existing, created: false })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .insert({
        campeonato_id: id,
        key_token: newKeyToken(),
        label: String(body?.label || 'Chave Stream').slice(0, 80),
        ativo: true,
        criado_por: user.id,
      })
      .select('id,key_token,label,ativo,created_at,updated_at')
      .single()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL de broadcast: database/migrations/20260718_broadcast_stream.sql',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ key: data, created: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}


export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const label = String(body?.label || '').trim().slice(0, 80)
    if (!label) {
      return NextResponse.json({ error: 'Informe um nome para a chave.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .update({ label, updated_at: new Date().toISOString() })
      .eq('campeonato_id', id)
      .eq('ativo', true)
      .select('id,key_token,label,ativo,created_at,updated_at')
      .maybeSingle()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL de broadcast: database/migrations/20260718_broadcast_stream.sql',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }
    if (!data) {
      return NextResponse.json({ error: 'Nenhuma chave ativa foi encontrada.' }, { status: 404 })
    }

    return NextResponse.json({ key: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('campeonato_id', id)
      .eq('ativo', true)
      .select('id')

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL de broadcast: database/migrations/20260718_broadcast_stream.sql',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ revoked: Array.isArray(data) ? data.length : 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
