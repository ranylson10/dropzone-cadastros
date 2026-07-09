import { NextRequest, NextResponse } from 'next/server'
import { getAccountByUserId, getBearerUser } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { randomToken } from '@/lib/validation'

const PUBLIC_TYPES = [
  'championship',
  'team',
  'championship_team',
  'group',
  'group_team',
  'game',
  'invite_token',
  'player_registration',
]

function canCreate(profileType: string | null, entityType: string) {
  if (profileType === 'produtora') return PUBLIC_TYPES.includes(entityType)
  if (profileType === 'equipe') return ['team', 'invite_token', 'player_registration'].includes(entityType)
  if (profileType === 'manager') return ['player_registration'].includes(entityType)
  if (profileType === 'jogador') return ['player_registration'].includes(entityType)
  return false
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    await getAccountByUserId(user.id)
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entity_type')

    let query = supabaseAdmin
      .from('DropZone')
      .select('*')
      .neq('entity_type', 'account')
      .order('created_at', { ascending: false })
      .limit(300)

    if (entityType) query = query.eq('entity_type', entityType)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ rows: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getAccountByUserId(user.id)
    const body = await req.json()
    const entityType = String(body.entity_type || '').trim()

    if (!canCreate(account.profile_type, entityType)) {
      throw new Error('Seu tipo de perfil nao pode criar esse cadastro.')
    }

    const name = String(body.name || '').trim()
    const token = body.generate_token ? randomToken(String(body.token_prefix || 'DZ')) : body.token || null

    const payload = {
      entity_type: entityType,
      profile_type: body.profile_type || null,
      name: name || null,
      token,
      parent_id: body.parent_id || null,
      ref_id: body.ref_id || null,
      status: body.status || 'ativo',
      data: body.data || {},
      created_by: user.id,
    }

    const { data, error } = await supabaseAdmin
      .from('DropZone')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ row: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar.' }, { status: 400 })
  }
}
