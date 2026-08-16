import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (permission.role !== 'owner' || !permission.produtoraId) {
      return NextResponse.json({ error: 'Somente o dono da produtora pode consultar equipes históricas.' }, { status: 403 })
    }

    const { data: tokens, error } = await supabaseAdmin
      .from('tokens')
      .select('id,token,status,usado,usado_em,equipe_id,line_id,created_at,equipe_destino_id')
      .eq('tipo', 'reivindicacao_equipe_historica')
      .eq('produtora_id', permission.produtoraId)
      .eq('campeonato_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error

    const equipeIds = [...new Set((tokens || []).map((row) => String(row.equipe_id || '')).filter(Boolean))]
    const { data: equipes, error: equipesError } = equipeIds.length
      ? await supabaseAdmin.from('equipes').select('id,nome,tag,logo_url,status,auth_user_id,dono_auth_user_id').in('id', equipeIds)
      : { data: [] as any[], error: null }
    if (equipesError) throw equipesError
    const byEquipe = new Map((equipes || []).map((row: any) => [String(row.id), row]))

    return NextResponse.json({
      resultados: (tokens || []).map((row: any) => {
        const equipe = byEquipe.get(String(row.equipe_id)) as any
        return {
          status: 'criada',
          token_id: row.id,
          token: row.token,
          equipe_id: row.equipe_id,
          line_id: row.line_id,
          nome: equipe?.nome || 'Equipe',
          tag: equipe?.tag || null,
          reivindicada: Boolean(row.usado || equipe?.auth_user_id || equipe?.dono_auth_user_id),
          incorporada: equipe?.status === 'incorporada',
          criado_em: row.created_at,
          usado_em: row.usado_em || null,
          equipe_destino_id: row.equipe_destino_id || null,
        }
      }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível listar equipes históricas.' }, { status: 400 })
  }
}

function normalizeRows(input: unknown) {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const rows: Array<{ nome: string; tag?: string }> = []
  for (const raw of input) {
    const nome = String((raw as any)?.nome || '').trim().replace(/\s+/g, ' ')
    const tag = String((raw as any)?.tag || '').trim().toUpperCase()
    if (!nome) continue
    const key = nome.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ nome, ...(tag ? { tag } : {}) })
  }
  return rows.slice(0, 100)
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (permission.role !== 'owner' || !permission.produtoraId) {
      return NextResponse.json({ error: 'Somente o dono da produtora pode cadastrar equipes históricas em bloco.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const equipes = normalizeRows(body?.equipes)
    if (!equipes.length) {
      return NextResponse.json({ error: 'Informe ao menos uma equipe.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('fn_criar_equipes_historicas_em_bloco', {
      p_produtora_id: permission.produtoraId,
      p_campeonato_id: id,
      p_criado_por: user.id,
      p_equipes: equipes,
    })
    if (error) throw error

    return NextResponse.json(data || { criadas: 0, existentes: 0, resultados: [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível cadastrar as equipes históricas.' }, { status: 400 })
  }
}
