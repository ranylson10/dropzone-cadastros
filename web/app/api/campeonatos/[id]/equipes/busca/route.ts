import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const q = String(req.nextUrl.searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ equipes: [] })

    const termo = q.replace(/[%_,]/g, '')
    const { data: equipes, error } = await supabaseAdmin
      .from('equipes')
      .select('id, nome, tag, logo_url')
      .or(`nome.ilike.%${termo}%,tag.ilike.%${termo}%`)
      .eq('status', 'ativo')
      .limit(15)

    if (error) throw error
    const equipeIds = (equipes || []).map((equipe) => equipe.id)
    if (!equipeIds.length) return NextResponse.json({ equipes: [] })

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('equipe_lines')
      .select('id, equipe_id, nome, tag, logo_url')
      .in('equipe_id', equipeIds)
      .eq('status', 'ativo')
      .order('nome')

    if (linesError) throw linesError
    const lineIds = (lines || []).map((line) => line.id)

    const { data: participacoes, error: participacoesError } = lineIds.length
      ? await supabaseAdmin
          .from('campeonato_equipes')
          .select('id, line_id, vaga_id')
          .eq('campeonato_id', id)
          .eq('status', 'ativo')
          .in('line_id', lineIds)
      : { data: [] as any[], error: null }

    if (participacoesError) throw participacoesError
    const vagaIds = (participacoes || []).map((item) => item.vaga_id).filter(Boolean)
    const { data: vagas } = vagaIds.length
      ? await supabaseAdmin.from('campeonato_vagas').select('id, numero_vaga').in('id', vagaIds)
      : { data: [] as any[] }

    const vagaMap = new Map((vagas || []).map((vaga) => [vaga.id, vaga.numero_vaga]))
    const inscricaoMap = new Map((participacoes || []).map((item) => [item.line_id, item]))

    return NextResponse.json({
      equipes: (equipes || []).map((equipe) => ({
        ...equipe,
        lines: (lines || []).filter((line) => line.equipe_id === equipe.id).map((line) => {
          const participacao = inscricaoMap.get(line.id)
          return {
            ...line,
            ja_inscrita: Boolean(participacao),
            vaga_numero: participacao?.vaga_id ? vagaMap.get(participacao.vaga_id) || null : null,
            participacao_id: participacao?.id || null,
          }
        }),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro na busca.' }, { status: 400 })
  }
}
