import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTeamsWrite } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTeamsWrite(user.id, id)
    const q = String(req.nextUrl.searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ equipes: [] })

    const termo = q.replace(/[%_,]/g, '')
    const equipePublicIdMatch = termo.match(/^(?:EQ\s*)?(\d+)$/i)
    const linePublicIdMatch = termo.match(/^LN\s*(\d+)$/i)
    const equipePublicId = equipePublicIdMatch ? Number(equipePublicIdMatch[1]) : null
    const linePublicId = linePublicIdMatch ? Number(linePublicIdMatch[1]) : null

    let equipesQuery = supabaseAdmin
      .from('equipes')
      .select('id, nome, tag, logo_url, public_id, public_id_prefix')
      .eq('status', 'ativo')
      .limit(15)

    if (linePublicId === null) {
      equipesQuery = equipePublicId !== null
        ? equipesQuery.eq('public_id', equipePublicId)
        : equipesQuery.or(`nome.ilike.%${termo}%,tag.ilike.%${termo}%`)
    }

    let equipes: any[] = []
    let lines: any[] = []

    if (linePublicId !== null) {
      const { data: matchedLines, error: matchedLinesError } = await supabaseAdmin
        .from('equipe_lines')
        .select('id, equipe_id, nome, tag, logo_url, public_id, public_id_prefix')
        .eq('public_id', linePublicId)
        .eq('status', 'ativo')
        .limit(15)
      if (matchedLinesError) throw matchedLinesError
      lines = matchedLines || []
      const ids = [...new Set(lines.map((line) => line.equipe_id).filter(Boolean))]
      const { data: matchedTeams, error: matchedTeamsError } = ids.length
        ? await supabaseAdmin
            .from('equipes')
            .select('id, nome, tag, logo_url, public_id, public_id_prefix')
            .in('id', ids)
            .eq('status', 'ativo')
        : { data: [] as any[], error: null }
      if (matchedTeamsError) throw matchedTeamsError
      equipes = matchedTeams || []
    } else {
      const { data: matchedTeams, error } = await equipesQuery
      if (error) throw error
      equipes = matchedTeams || []
      const equipeIds = equipes.map((equipe) => equipe.id)
      if (!equipeIds.length) return NextResponse.json({ equipes: [] })

      const { data: matchedLines, error: linesError } = await supabaseAdmin
        .from('equipe_lines')
        .select('id, equipe_id, nome, tag, logo_url, public_id, public_id_prefix')
        .in('equipe_id', equipeIds)
        .eq('status', 'ativo')
        .order('nome')
      if (linesError) throw linesError
      lines = matchedLines || []
    }

    const equipeIds = equipes.map((equipe) => equipe.id)
    if (!equipeIds.length) return NextResponse.json({ equipes: [] })

    const lineIds = (lines || []).map((line) => line.id)

    const { data: participacoes, error: participacoesError } = lineIds.length
      ? await supabaseAdmin
          .from('campeonato_equipes')
          .select('id, line_id, slot_id, slot_numero')
          .eq('campeonato_id', id)
          .eq('status', 'ativo')
          .in('line_id', lineIds)
      : { data: [] as any[], error: null }

    if (participacoesError) throw participacoesError

    const slotIds = [...new Set((participacoes || []).map((item) => item.slot_id).filter(Boolean))]
    const { data: slots } = slotIds.length
      ? await supabaseAdmin.from('campeonato_slots').select('id, slot_numero, slot_letra').in('id', slotIds)
      : { data: [] as any[] }
    const slotMap = new Map((slots || []).map((slot) => [slot.id, slot]))
    const inscricaoMap = new Map((participacoes || []).map((item) => [item.line_id, item]))

    return NextResponse.json({
      equipes: (equipes || []).map((equipe) => ({
        ...equipe,
        lines: (lines || [])
          .filter((line) => line.equipe_id === equipe.id)
          .map((line) => {
            const participacao = inscricaoMap.get(line.id)
            const slot = participacao?.slot_id ? slotMap.get(participacao.slot_id) : null
            return {
              ...line,
              logo_url: line.logo_url || equipe.logo_url || null,
              tag: line.tag || equipe.tag || null,
              ja_inscrita: Boolean(participacao),
              vaga_numero: slot?.slot_numero ?? participacao?.slot_numero ?? null,
              slot_letra: slot?.slot_letra || null,
              participacao_id: participacao?.id || null,
            }
          }),
        lines_livres: (lines || []).filter((line) => line.equipe_id === equipe.id && !inscricaoMap.has(line.id)).length,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro na busca.' }, { status: 400 })
  }
}
