import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET() {
  try {
    const [teamsResult, playersResult, championshipsResult] = await Promise.all([
      supabaseAdmin.from('campeonato_estatisticas_equipes_detalhe').select('*').limit(10000),
      supabaseAdmin.from('campeonato_estatisticas_mvp_detalhe').select('*').limit(10000),
      supabaseAdmin.from('campeonatos').select('id').eq('status', 'ativo').eq('aprovacao_status', 'aprovado').is('deleted_at', null),
    ])
    if (teamsResult.error) throw teamsResult.error
    if (playersResult.error) throw playersResult.error
    if (championshipsResult.error) throw championshipsResult.error
    const publicChampionshipIds = new Set((championshipsResult.data || []).map((item) => String(item.id)))

    const teams = new Map<string, any>()
    for (const row of teamsResult.data || []) {
      if (!publicChampionshipIds.has(String(row.campeonato_id || ''))) continue
      const key = String(row.line_id || row.equipe_id || row.campeonato_equipe_id || '')
      if (!key) continue
      const current = teams.get(key) || { key, equipe_id: row.equipe_id || null, line_id: row.line_id || null, nome: row.nome_exibicao || row.line_nome || row.equipe_nome || 'Equipe', tag: row.line_tag || row.equipe_tag || null, logo_url: row.line_logo_url || row.equipe_logo_url || null, quedas: 0, booyahs: 0, abates: 0, pontos: 0 }
      current.quedas += 1
      current.booyahs += row.booyah ? 1 : 0
      current.abates += Number(row.abates || 0)
      current.pontos += Number(row.pontos_total || 0)
      teams.set(key, current)
    }

    const players = new Map<string, any>()
    for (const row of playersResult.data || []) {
      if (!publicChampionshipIds.has(String(row.campeonato_id || ''))) continue
      const key = String(row.jogador_id || row.id_jogo || row.campeonato_jogador_id || '')
      if (!key) continue
      const current = players.get(key) || { key, jogador_id: row.jogador_id || null, nick: row.nick || row.nick_snapshot || 'Jogador', id_jogo: row.id_jogo || row.id_jogo_snapshot || null, foto_url: row.foto_url || null, quedas: 0, abates: 0, dano: 0, assistencias: 0, revives: 0 }
      current.quedas += 1
      current.abates += Number(row.abates || 0)
      current.dano += Number(row.dano || 0)
      current.assistencias += Number(row.assistencias || 0)
      current.revives += Number(row.revives || 0)
      players.set(key, current)
    }

    return NextResponse.json({
      teams: [...teams.values()].sort((a, b) => b.pontos - a.pontos || b.booyahs - a.booyahs || b.abates - a.abates).slice(0, 100).map((item, index) => ({ ...item, rank: index + 1 })),
      players: [...players.values()].sort((a, b) => b.abates - a.abates || b.dano - a.dano || b.assistencias - a.assistencias).slice(0, 100).map((item, index) => ({ ...item, rank: index + 1 })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar o ranking.' }, { status: 400 })
  }
}
