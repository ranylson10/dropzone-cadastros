import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

function dbSetupError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  if (!['42P01', 'PGRST205'].includes(code)) return false
  return /commerce_favoritos/i.test(message)
}

async function championshipData(campeonatoIds: string[]) {
  if (!campeonatoIds.length) return new Map<string, any>()

  const [{ data: championships, error: championshipsError }, { data: configs, error: configsError }] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,banner_url')
      .in('id', campeonatoIds),
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('campeonato_id,valor_inscricao,numero_vagas')
      .in('campeonato_id', campeonatoIds),
  ])

  if (championshipsError) throw championshipsError
  if (configsError) throw configsError

  const configByChamp = new Map((configs || []).map((row: any) => [String(row.campeonato_id), row]))
  return new Map(
    (championships || []).map((row: any) => {
      const config = configByChamp.get(String(row.id)) || {}
      return [
        String(row.id),
        {
          ...row,
          valor_inscricao: config.valor_inscricao ?? null,
          total_vagas: config.numero_vagas ?? null,
          vagas_livres: config.numero_vagas ?? null,
        },
      ]
    }),
  )
}

async function listWishlist(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('commerce_favoritos')
    .select('id,campeonato_id,origem,created_at')
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const items = data || []
  const championshipById = await championshipData(
    [...new Set(items.map((row: any) => String(row.campeonato_id || '')).filter(Boolean))],
  )

  return {
    items: items.map((row: any) => ({
      ...row,
      campeonato: championshipById.get(String(row.campeonato_id)) || null,
    })),
  }
}

function errorResponse(error: any, fallback: string) {
  if (dbSetupError(error)) {
    return NextResponse.json(
      { error: 'Estrutura de favoritos não encontrada no banco.', needs_migration: true },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      error: error?.message || fallback,
      code: error?.code || null,
    },
    { status: 400 },
  )
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    return NextResponse.json(await listWishlist(user.id))
  } catch (error: any) {
    return errorResponse(error, 'Erro ao carregar favoritos.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    const origem = ['direto', 'vendedor', 'afiliado', 'lili', 'app'].includes(String(body.origem || ''))
      ? String(body.origem)
      : 'direto'
    const favorito = typeof body.favorito === 'boolean' ? body.favorito : true
    if (!campeonatoId) throw new Error('Campeonato obrigatorio.')

    const { data: campeonato, error: campeonatoError } = await supabaseAdmin
      .from('campeonatos')
      .select('id')
      .eq('id', campeonatoId)
      .maybeSingle()

    if (campeonatoError) throw campeonatoError
    if (!campeonato) throw new Error('Campeonato nao encontrado.')

    if (favorito) {
      const { error } = await supabaseAdmin
        .from('commerce_favoritos')
        .insert({ auth_user_id: user.id, campeonato_id: campeonatoId, origem })
      // Favoritar é idempotente: se outro clique/request já gravou o mesmo
      // campeonato, o resultado correto continua sendo "favorito".
      if (error && error.code !== '23505') throw error
    }

    if (!favorito) {
      const { error } = await supabaseAdmin
        .from('commerce_favoritos')
        .delete()
        .eq('auth_user_id', user.id)
        .eq('campeonato_id', campeonatoId)
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return errorResponse(error, 'Erro ao atualizar favoritos.')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const campeonatoId = String(new URL(req.url).searchParams.get('campeonato_id') || '').trim()
    if (!campeonatoId) throw new Error('Campeonato obrigatorio.')

    const { error } = await supabaseAdmin
      .from('commerce_favoritos')
      .delete()
      .eq('auth_user_id', user.id)
      .eq('campeonato_id', campeonatoId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return errorResponse(error, 'Erro ao remover favorito.')
  }
}
