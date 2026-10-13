import { supabaseAdmin } from '../../shared/supabase-admin'
import { readRowsByIds } from '../../shared/paginated-query'
import { readStatsRows, type StatsFilters as Filters } from './statistics-query'

/** Acrescenta o ID público numérico da Line sem expor o UUID como ID de mídia. */
async function attachLinePublicIds<T extends { line_id?: string | null }>(rows: T[]): Promise<Array<T & { line_public_id: number | null }>> {
  const lineIds = [...new Set(rows.map((row) => String(row.line_id || '')).filter(Boolean))]
  if (!lineIds.length) return rows.map((row) => ({ ...row, line_public_id: null }))
  const data = await readRowsByIds<any>(lineIds, batch => supabaseAdmin
    .from('equipe_lines')
    .select('id,public_id')
    .in('id', batch)
    .order('id', { ascending: true }))
  const publicIdByLine = new Map((data || []).map((line: any) => [String(line.id), Number(line.public_id)]))
  return rows.map((row) => ({
    ...row,
    line_public_id: publicIdByLine.get(String(row.line_id || '')) ?? null,
  }))
}

export async function listarEstatisticasEquipes(campeonatoId: string, filters: Filters) {
  const data = await readStatsRows(() => supabaseAdmin
      .from('campeonato_estatisticas_equipes_detalhe')
      .select('*')
      .eq('campeonato_id', campeonatoId),
    filters,
  )

  const aggregate = new Map<string, any>()
  for (const row of data || []) {
    const key = row.campeonato_equipe_id
    const current = aggregate.get(key) || {
      campeonato_equipe_id: key,
      equipe_id: row.equipe_id,
      line_id: row.line_id,
      nome: row.nome_exibicao || row.line_nome || row.equipe_nome || 'Equipe',
      tag: row.line_tag || row.equipe_tag || null,
      logo_url: row.line_logo_url || row.equipe_logo_url || null,
      grupo_id: row.grupo_id || null,
      quedas: 0,
      booyahs: 0,
      abates: 0,
      pontos_posicao: 0,
      pontos_abates: 0,
      pontos_total: 0,
      melhor_posicao: null as number | null,
    }
    current.quedas += 1
    current.booyahs += row.booyah ? 1 : 0
    current.abates += Number(row.abates || 0)
    current.pontos_posicao += Number(row.pontos_posicao || 0)
    current.pontos_abates += Number(row.pontos_abates || 0)
    current.pontos_total += Number(row.pontos_total || 0)
    current.melhor_posicao = current.melhor_posicao === null
      ? Number(row.posicao)
      : Math.min(current.melhor_posicao, Number(row.posicao))
    aggregate.set(key, current)
  }

  const rows = [...aggregate.values()]
    .sort((a, b) => b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates || Number(a.melhor_posicao ?? 999) - Number(b.melhor_posicao ?? 999))
    .map((row, index) => ({ ...row, colocacao: index + 1 }))
  return attachLinePublicIds(rows)
}


async function listarMvpGarenaFallback(campeonatoId: string, filters: Filters) {
  const imports = await readStatsRows(() => supabaseAdmin
    .from('garena_matchstats_importacoes')
    .select('id,jogo_id,partida_id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'concluida')
    .eq('consolidacao_oficial', true),
    { jogoId: filters.jogoId, partidaId: filters.partidaId, partidaIds: filters.partidaIds }, 'id')
  const importIds = (imports || []).map((row: any) => row.id)
  if (!importIds.length) return []

  const rows = await readRowsByIds<any>(importIds, batch => supabaseAdmin
    .from('garena_matchstats_jogadores')
    .select('campeonato_jogador_id,jogador_id,jogador_temporario_id,campeonato_equipe_id,nick_snapshot,player_id,abates,dano,assistencias,revives')
    .in('importacao_id', batch)
    .not('campeonato_jogador_id', 'is', null)
    .order('id', { ascending: true }))

  const aggregate = new Map<string, any>()
  for (const row of rows || []) {
    const key = String(row.campeonato_jogador_id || '')
    if (!key) continue
    const current = aggregate.get(key) || {
      campeonato_jogador_id: key,
      jogador_id: row.jogador_id,
      jogador_temporario_id: row.jogador_temporario_id,
      campeonato_equipe_id: row.campeonato_equipe_id,
      nick: row.nick_snapshot || 'Jogador',
      id_jogo: row.player_id || null,
      foto_url: null,
      tipo_jogador: row.jogador_id ? 'oficial' : 'temporario',
      quedas: 0,
      abates: 0,
      dano: 0,
      assistencias: 0,
      revives: 0,
    }
    current.quedas += 1
    current.abates += Number(row.abates || 0)
    current.dano += Number(row.dano || 0)
    current.assistencias += Number(row.assistencias || 0)
    current.revives += Number(row.revives || 0)
    aggregate.set(key, current)
  }

  return [...aggregate.values()]
    .sort((a, b) => b.abates - a.abates || b.dano - a.dano)
    .map((row, index) => ({ ...row, colocacao: index + 1 }))
}

export async function listarEstatisticasMvp(campeonatoId: string, filters: Filters) {
  const data = await readStatsRows(() => supabaseAdmin
      .from('campeonato_estatisticas_mvp_detalhe')
      .select('*')
      .eq('campeonato_id', campeonatoId),
    filters,
  )
  if (!(data || []).length && !filters.faseId && !filters.rodadaId && !filters.mapaCodigo && !filters.grupoId) {
    return listarMvpGarenaFallback(campeonatoId, filters)
  }

  const aggregate = new Map<string, any>()
  for (const row of data || []) {
    const key = row.campeonato_jogador_id
    const current = aggregate.get(key) || {
      campeonato_jogador_id: key,
      jogador_id: row.jogador_id,
      jogador_temporario_id: row.jogador_temporario_id,
      campeonato_equipe_id: row.campeonato_equipe_id,
      line_id: row.line_id || null,
      nick: row.nick,
      id_jogo: row.id_jogo,
      foto_url: row.foto_url,
      tipo_jogador: row.tipo_jogador,
      quedas: 0,
      abates: 0,
      dano: 0,
      assistencias: 0,
      revives: 0,
    }
    current.quedas += 1
    current.abates += Number(row.abates || 0)
    current.dano += Number(row.dano || 0)
    current.assistencias += Number(row.assistencias || 0)
    current.revives += Number(row.revives || 0)
    aggregate.set(key, current)
  }

  const rows = [...aggregate.values()]
    .sort((a, b) => b.abates - a.abates || b.dano - a.dano)
    .map((row, index) => ({ ...row, colocacao: index + 1 }))
  return attachLinePublicIds(rows)
}
