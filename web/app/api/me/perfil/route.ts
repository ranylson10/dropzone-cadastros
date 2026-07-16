import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const TABLES: Record<string, { table: string; logoField: string; nameField: string }> = {
  equipe: { table: 'equipes', logoField: 'logo_url', nameField: 'nome' },
  manager: { table: 'managers', logoField: 'avatar_url', nameField: 'nome' },
  jogador: { table: 'jogadores', logoField: 'avatar_url', nameField: 'nome' },
  produtora: { table: 'produtoras', logoField: 'logo_url', nameField: 'nome' },
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))

    const profileType = String(body.profile_type || req.headers.get('x-profile-type') || '').trim()
    const profileId = String(body.profile_id || body.id || '').trim()
    const meta = TABLES[profileType]
    if (!meta) throw new Error('Tipo de perfil inválido.')

    const account = accounts.find((a) => a.profile_type === profileType && (!profileId || a.id === profileId))
    if (!account) throw new Error('Perfil não encontrado neste login.')

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.nome !== undefined) {
      const nome = String(body.nome || '').trim()
      if (!nome) throw new Error('Informe o nome.')
      patch[meta.nameField] = nome
    }
    if (body.bio !== undefined) {
      patch.bio = String(body.bio || '').trim().slice(0, 280) || null
    }
    if (body.logo_url !== undefined || body.avatar_url !== undefined) {
      const url = String(body.logo_url ?? body.avatar_url ?? '').trim() || null
      patch[meta.logoField] = url
    }
    if (profileType === 'equipe' && body.tag !== undefined) {
      patch.tag = String(body.tag || '').trim() || null
    }
    if (profileType === 'manager' && body.whatsapp_url !== undefined) {
      patch.whatsapp_url = String(body.whatsapp_url || '').trim() || null
    }
    if (profileType === 'manager' && body.nome_publico_vendas !== undefined) {
      patch.nome_publico_vendas = String(body.nome_publico_vendas || '').trim() || null
    }
    if (profileType === 'jogador' && body.id_jogo !== undefined) {
      patch.id_jogo = String(body.id_jogo || '').trim() || null
    }
    if (profileType === 'jogador' && body.funcao !== undefined) {
      patch.funcao = String(body.funcao || '').trim() || null
    }

    const { data, error } = await supabaseAdmin
      .from(meta.table)
      .update(patch)
      .eq('id', account.id)
      .select('*')
      .single()
    if (error) {
      // bio pode não existir ainda
      if (String(error.message || '').includes('bio') || error.code === '42703') {
        delete patch.bio
        const retry = await supabaseAdmin.from(meta.table).update(patch).eq('id', account.id).select('*').single()
        if (retry.error) throw retry.error
        return NextResponse.json({
          ok: true,
          profile: retry.data,
          warning: 'Coluna bio ainda não existe. Rode database/migrations/20260716_perfil_bio.sql',
        })
      }
      throw error
    }

    return NextResponse.json({ ok: true, profile: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar perfil.' }, { status: 400 })
  }
}
