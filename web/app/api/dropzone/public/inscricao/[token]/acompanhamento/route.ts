import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const params = await ctx.params
    const token = String(params?.token || '').trim().toUpperCase()
    const { data: link, error: linkError } = await supabaseAdmin
      .from('campeonato_links')
      .select('*')
      .eq('token', token)
      .eq('ativo', true)
      .maybeSingle()
    if (linkError) throw linkError
    if (!link || !link.acompanhamento_publico) throw new Error('Acompanhamento indisponivel.')

    const [{ data: campeonato }, { data: grupo }, { data: teamLinks, error: teamsError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').eq('id', link.campeonato_id).maybeSingle(),
      supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).maybeSingle(),
      supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,slot_numero,nome_exibicao,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)').eq('campeonato_id', link.campeonato_id).eq('grupo_id', link.grupo_id).order('slot_numero'),
    ])
    if (teamsError) throw teamsError

    const equipes = await Promise.all((teamLinks || []).map(async (item: any) => {
      const { data: jogadores, error } = await supabaseAdmin
        .from('campeonato_jogadores')
        .select('id,nick,id_jogo,funcao,foto_url,created_at')
        .eq('campeonato_id', link.campeonato_id)
        .eq('campeonato_equipe_id', item.id)
        .neq('status', 'deletado')
        .order('created_at')
      if (error) throw error
      const line = Array.isArray(item.equipe_lines) ? item.equipe_lines[0] : item.equipe_lines
      return {
        id: item.id,
        equipe_id: item.equipe_id,
        line_id: item.line_id,
        nome: line?.nome || item.nome_exibicao || item.equipes?.nome,
        line_nome: line?.nome || item.nome_exibicao || item.equipes?.nome,
        equipe_nome: item.equipes?.nome,
        username: item.equipes?.username,
        tag: line?.tag || item.equipes?.tag,
        logo_url: line?.logo_url || item.equipes?.logo_url,
        slot_numero: item.slot_numero,
        jogadores: jogadores || [],
      }
    }))

    return NextResponse.json({ campeonato, grupo, equipes })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao acompanhar inscricoes.' }, { status: 400 })
  }
}
