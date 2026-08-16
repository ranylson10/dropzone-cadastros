import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function requireOwner(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('produtoras')
    .select('id,nome,status')
    .eq('auth_user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Somente o dono da produtora pode gerenciar equipes provisórias.')
  return data
}

function normalizeRows(input: unknown) {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  return input.flatMap((raw: any) => {
    const nome = String(raw?.nome || '').trim().replace(/\s+/g, ' ')
    const tag = String(raw?.tag || '').trim().toUpperCase()
    if (!nome) return []
    const key = nome.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) return []
    seen.add(key)
    return [{ nome, ...(tag ? { tag } : {}) }]
  }).slice(0, 100)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtora = await requireOwner(user.id)
    const { data: tokens, error } = await supabaseAdmin
      .from('tokens')
      .select('id,token,equipe_id,line_id,created_at')
      .eq('tipo', 'reivindicacao_equipe_historica')
      .eq('produtora_id', produtora.id)
      .eq('status', 'ativo')
      .eq('usado', false)
      .order('created_at', { ascending: false })
    if (error) throw error

    const ids = [...new Set((tokens || []).map((item) => item.equipe_id).filter(Boolean))]
    const { data: equipes, error: equipesError } = ids.length
      ? await supabaseAdmin.from('equipes').select('id,nome,tag,logo_url,status,auth_user_id,dono_auth_user_id,localidade,cidade,estado,pais,bio').in('id', ids)
      : { data: [] as any[], error: null }
    if (equipesError) throw equipesError
    const valid = (equipes || []).filter((e: any) => e.status === 'ativo' && !e.auth_user_id && !e.dono_auth_user_id)
    const validIds = valid.map((e: any) => e.id)

    const [{ data: lines }, { data: participacoes }] = await Promise.all([
      validIds.length ? supabaseAdmin.from('equipe_lines').select('id,equipe_id,nome,tag,logo_url,status').in('equipe_id', validIds).neq('status', 'inativo') : Promise.resolve({ data: [] as any[] }),
      validIds.length ? supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,campeonato_id,status,campeonato:campeonato_id(id,nome)').in('equipe_id', validIds).neq('status', 'removida') : Promise.resolve({ data: [] as any[] }),
    ])
    const tokenByEquipe = new Map((tokens || []).map((t: any) => [String(t.equipe_id), t]))
    return NextResponse.json({
      equipes: valid.map((e: any) => ({
        ...e,
        token: tokenByEquipe.get(String(e.id))?.token || null,
        created_at: tokenByEquipe.get(String(e.id))?.created_at || null,
        lines: (lines || []).filter((l: any) => l.equipe_id === e.id),
        participacoes: (participacoes || []).filter((p: any) => p.equipe_id === e.id),
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar as equipes provisórias.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtora = await requireOwner(user.id)
    const body = await req.json().catch(() => ({}))
    const equipes = normalizeRows(body?.equipes)
    if (!equipes.length) throw new Error('Informe ao menos uma equipe.')
    const { data, error } = await supabaseAdmin.rpc('fn_criar_equipes_provisorias_em_bloco', {
      p_produtora_id: produtora.id,
      p_criado_por: user.id,
      p_equipes: equipes,
    })
    if (error) throw error
    return NextResponse.json(data || { criadas: 0, existentes: 0 }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível criar as equipes provisórias.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtora = await requireOwner(user.id)
    const body = await req.json().catch(() => ({}))
    const equipeId = String(body?.equipe_id || '')
    if (!equipeId) throw new Error('Equipe não informada.')

    const { data: token } = await supabaseAdmin.from('tokens').select('id').eq('tipo', 'reivindicacao_equipe_historica').eq('produtora_id', produtora.id).eq('equipe_id', equipeId).eq('status', 'ativo').eq('usado', false).maybeSingle()
    if (!token) throw new Error('Esta equipe não está mais sob gestão provisória da produtora.')

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of ['nome', 'tag', 'logo_url', 'localidade', 'cidade', 'estado', 'pais', 'bio']) {
      if (body[key] !== undefined) patch[key] = String(body[key] || '').trim() || null
    }
    if (patch.nome === null) throw new Error('Nome da equipe é obrigatório.')
    if (patch.tag === null) throw new Error('TAG da equipe é obrigatória.')
    if (patch.tag) patch.tag = String(patch.tag).toUpperCase()

    const { data, error } = await supabaseAdmin.from('equipes').update(patch).eq('id', equipeId).is('auth_user_id', null).is('dono_auth_user_id', null).select('*').single()
    if (error) throw error
    return NextResponse.json({ equipe: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível atualizar a equipe.' }, { status: 400 })
  }
}
