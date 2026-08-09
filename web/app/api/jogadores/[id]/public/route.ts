import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const [{ data: player, error: playerError }, { data: registrations, error: registrationsError }] = await Promise.all([
      supabaseAdmin.from('jogadores').select('id,nick,nome,username,avatar_url,foto_url,id_jogo,funcao,public_id,status,localidade,cidade,estado,pais,bio,disponivel_recrutamento').eq('id', id).eq('status', 'ativo').maybeSingle(),
      supabaseAdmin.from('campeonato_jogadores').select('id,jogador_id,campeonato_id,equipe_id,line_id,campeonato_equipe_id,nick,funcao,status,capitao,slot_numero').eq('jogador_id', id).neq('status', 'deletado'),
    ])
    if (playerError) throw playerError
    if (!player) return NextResponse.json({ error: 'Jogador não encontrado.' }, { status: 404 })
    if (registrationsError) throw registrationsError

    const championshipIds = [...new Set((registrations || []).map((row: any) => row.campeonato_id).filter(Boolean))]
    const teamIds = [...new Set((registrations || []).map((row: any) => row.equipe_id).filter(Boolean))]
    const lineIds = [...new Set((registrations || []).map((row: any) => row.line_id).filter(Boolean))]
    const [{ data: championships }, { data: teams }, { data: lines }] = await Promise.all([
      championshipIds.length ? supabaseAdmin.from('campeonatos').select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status').in('id', championshipIds).is('deleted_at', null) : Promise.resolve({ data: [] as any[] }),
      teamIds.length ? supabaseAdmin.from('equipes').select('id,nome,tag,logo_url,username').in('id', teamIds) : Promise.resolve({ data: [] as any[] }),
      lineIds.length ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url,equipe_id').in('id', lineIds) : Promise.resolve({ data: [] as any[] }),
    ])
    const championshipMap = new Map((championships || []).map((row: any) => [row.id, row]))
    const teamMap = new Map((teams || []).map((row: any) => [row.id, row]))
    const lineMap = new Map((lines || []).map((row: any) => [row.id, row]))
    return NextResponse.json({
      player,
      participations: (registrations || []).map((row: any) => ({
        ...row,
        campeonato: championshipMap.get(row.campeonato_id) || null,
        equipe: teamMap.get(row.equipe_id) || null,
        line: lineMap.get(row.line_id) || null,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar jogador.' }, { status: 400 })
  }
}
