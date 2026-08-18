import { supabaseAdmin } from '../../shared/supabase-admin'
import { sincronizarEstatisticasGarena } from './garena-matchstats.service'

export type ParsedPlayer = { ordem: number; nick: string; id_jogo: string; abates: number }
export type ParsedTeam = { ordem: number; nome: string; posicao: number; abates: number; pontos_posicao_arquivo: number; pontos_total_arquivo: number; jogadores: ParsedPlayer[]; abates_jogadores: number; jogadores_contagem: number; abates_conferem: boolean; diferenca_abates: number }

export function normalizeName(value: string) {
  return value.normalize('NFKC').replace(/[\u00A0\u3164\uFFA0]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function auditarAbatesEquipe(team: { abates: number; jogadores: Array<{ abates: number }> }) {
  const abatesJogadores = team.jogadores.reduce((sum, player) => sum + Number(player.abates || 0), 0)
  const killScore = Number(team.abates || 0)
  return {
    abates_jogadores: abatesJogadores,
    jogadores_contagem: team.jogadores.length,
    abates_conferem: abatesJogadores === killScore,
    diferenca_abates: abatesJogadores - killScore,
  }
}

async function garantirMembroDaLine(input: {
  equipeId: string
  lineId: string | null
  jogadorId: string | null
  jogadorTemporarioId: string | null
  nick: string
  idJogo: string
  funcao: string | null
  adicionadoPor: string
}) {
  const { equipeId, lineId, jogadorId, jogadorTemporarioId, nick, idJogo, funcao, adicionadoPor } = input
  let profile: any = null
  if (jogadorId) {
    const { data, error } = await supabaseAdmin
      .from('jogadores')
      .select('auth_user_id,avatar_url,funcao,localidade')
      .eq('id', jogadorId)
      .maybeSingle()
    if (error) throw error
    profile = data
  }

  let rosterQuery = supabaseAdmin.from('equipe_jogadores').select('id,origem,created_at').eq('equipe_id', equipeId)
  rosterQuery = jogadorId ? rosterQuery.eq('jogador_id', jogadorId) : rosterQuery.eq('jogador_temporario_id', jogadorTemporarioId)
  let { data: roster, error: rosterError } = await rosterQuery.maybeSingle()
  if (rosterError) throw rosterError

  const rosterPayload = {
    jogador_auth_user_id: profile?.auth_user_id || null,
    jogador_id: jogadorId,
    jogador_temporario_id: jogadorTemporarioId,
    nick,
    foto_url: profile?.avatar_url || null,
    id_jogo: idJogo,
    funcao: funcao || profile?.funcao || 'rush',
    localidade: profile?.localidade || null,
    status: 'ativo',
    updated_at: new Date().toISOString(),
  }
  if (roster?.id) {
    const { error } = await supabaseAdmin.from('equipe_jogadores').update(rosterPayload).eq('id', roster.id)
    if (error) throw error
  } else {
    const { data, error } = await supabaseAdmin
      .from('equipe_jogadores')
      .insert({ equipe_id: equipeId, ...rosterPayload, origem: 'matchresult' })
      .select('id,origem,created_at')
      .single()
    if (error) throw error
    roster = data
  }
  if (!roster?.id) throw new Error('Nao foi possivel vincular o jogador ao elenco da equipe.')

  if (lineId) {
    const { data: lineMember, error: lineMemberError } = await supabaseAdmin
      .from('equipe_line_jogadores')
      .select('id')
      .eq('line_id', lineId)
      .eq('equipe_jogador_id', roster.id)
      .eq('status', 'ativo')
      .maybeSingle()
    if (lineMemberError) throw lineMemberError
    if (!lineMember?.id) {
      const { error } = await supabaseAdmin.from('equipe_line_jogadores').insert({
        equipe_id: equipeId,
        line_id: lineId,
        equipe_jogador_id: roster.id,
        status: 'ativo',
        adicionado_por: adicionadoPor,
      })
      if (error?.code !== '23505') {
        if (error) throw error
      }
    }
  }
  return roster.id as string
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as any).message || 'Erro desconhecido.')
  return String(error || 'Erro desconhecido.')
}

type ConfirmedImportSnapshot = {
  id: string
  created_at: string | null
  equipes: Array<{ campeonato_equipe_id: string | null }>
  jogadores: Array<{ campeonato_jogador_id: string | null; jogador_temporario_id: string | null; jogador_id: string | null }>
}

async function carregarImportacaoConfirmadaAnterior(partidaId: string): Promise<ConfirmedImportSnapshot | null> {
  const { data: importacao, error } = await supabaseAdmin
    .from('matchresult_importacoes')
    .select('id,created_at')
    .eq('partida_id', partidaId)
    .eq('status', 'confirmada')
    .maybeSingle()
  if (error) throw error
  if (!importacao?.id) return null

  const [{ data: equipes, error: equipesError }, { data: jogadores, error: jogadoresError }] = await Promise.all([
    supabaseAdmin
      .from('matchresult_importacoes_equipes')
      .select('campeonato_equipe_id')
      .eq('importacao_id', importacao.id),
    supabaseAdmin
      .from('matchresult_importacoes_jogadores')
      .select('campeonato_jogador_id,jogador_temporario_id,jogador_id')
      .eq('importacao_id', importacao.id),
  ])
  if (equipesError) throw equipesError
  if (jogadoresError) throw jogadoresError

  return {
    id: String(importacao.id),
    created_at: importacao.created_at || null,
    equipes: equipes || [],
    jogadores: jogadores || [],
  }
}

async function reconciliarSubstituicaoMatchResult(input: {
  campeonatoId: string
  partidaId: string
  userId: string
  anterior: ConfirmedImportSnapshot | null
  equipesAtuais: string[]
  jogadoresAtuais: string[]
}) {
  const { campeonatoId, partidaId, userId, anterior } = input
  if (!anterior) return { jogadores_removidos: 0, equipes_removidas: 0, membros_removidos: 0 }

  const equipesAtuais = new Set(input.equipesAtuais.filter(Boolean))
  const jogadoresAtuais = new Set(input.jogadoresAtuais.filter(Boolean))
  const equipesAnteriores = [...new Set(anterior.equipes.map((row) => row.campeonato_equipe_id).filter(Boolean) as string[])]
  const jogadoresAnteriores = [...new Set(anterior.jogadores.map((row) => row.campeonato_jogador_id).filter(Boolean) as string[])]
  const equipesObsoletas = equipesAnteriores.filter((id) => !equipesAtuais.has(id))
  const jogadoresObsoletos = jogadoresAnteriores.filter((id) => !jogadoresAtuais.has(id))

  if (jogadoresObsoletos.length) {
    const { error } = await supabaseAdmin
      .from('campeonato_resultados_jogadores')
      .delete()
      .eq('partida_id', partidaId)
      .eq('origem', 'matchresult')
      .in('campeonato_jogador_id', jogadoresObsoletos)
    if (error) throw error
  }

  if (equipesObsoletas.length) {
    const [{ error: resultError }, { error: presenceError }] = await Promise.all([
      supabaseAdmin
        .from('campeonato_resultados_equipes')
        .delete()
        .eq('partida_id', partidaId)
        .eq('origem', 'matchresult')
        .in('campeonato_equipe_id', equipesObsoletas),
      supabaseAdmin
        .from('campeonato_partidas_equipes_presenca')
        .delete()
        .eq('partida_id', partidaId)
        .eq('origem', 'matchresult')
        .in('campeonato_equipe_id', equipesObsoletas),
    ])
    if (resultError) throw resultError
    if (presenceError) throw presenceError
  }

  if (!jogadoresObsoletos.length) {
    return { jogadores_removidos: 0, equipes_removidas: equipesObsoletas.length, membros_removidos: 0 }
  }

  const { data: participacoes, error: participacoesError } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id,equipe_jogador_id,jogador_temporario_id,origem,criado_automaticamente,created_at,status')
    .eq('campeonato_id', campeonatoId)
    .in('id', jogadoresObsoletos)
  if (participacoesError) throw participacoesError

  const automaticas = (participacoes || []).filter((row: any) => row.origem === 'matchresult' && row.criado_automaticamente === true)
  const automaticasIds = automaticas.map((row: any) => String(row.id))
  if (!automaticasIds.length) {
    return { jogadores_removidos: jogadoresObsoletos.length, equipes_removidas: equipesObsoletas.length, membros_removidos: 0 }
  }

  const [resultadosRestantes, refsImportacoes, substituicoesSaida, substituicoesEntrada, historicoFormacao] = await Promise.all([
    supabaseAdmin.from('campeonato_resultados_jogadores').select('campeonato_jogador_id').in('campeonato_jogador_id', automaticasIds),
    supabaseAdmin.from('matchresult_importacoes_jogadores').select('campeonato_jogador_id,importacao_id').in('campeonato_jogador_id', automaticasIds).neq('importacao_id', anterior.id),
    supabaseAdmin.from('campeonato_substituicoes').select('inscricao_saiu_id').eq('campeonato_id', campeonatoId).in('inscricao_saiu_id', automaticasIds),
    supabaseAdmin.from('campeonato_substituicoes').select('inscricao_entrou_id').eq('campeonato_id', campeonatoId).in('inscricao_entrou_id', automaticasIds),
    supabaseAdmin.from('equipe_formacao_historico').select('campeonato_jogador_id').eq('campeonato_id', campeonatoId).in('campeonato_jogador_id', automaticasIds),
  ])
  if (resultadosRestantes.error) throw resultadosRestantes.error
  if (refsImportacoes.error) throw refsImportacoes.error
  if (substituicoesSaida.error) throw substituicoesSaida.error
  if (substituicoesEntrada.error) throw substituicoesEntrada.error
  if (historicoFormacao.error) throw historicoFormacao.error

  const importacaoIds = [...new Set((refsImportacoes.data || []).map((row: any) => row.importacao_id).filter(Boolean))]
  let importacoesConfirmadas = new Set<string>()
  if (importacaoIds.length) {
    const { data: confirmadas, error: confirmadasError } = await supabaseAdmin
      .from('matchresult_importacoes')
      .select('id')
      .in('id', importacaoIds)
      .eq('status', 'confirmada')
    if (confirmadasError) throw confirmadasError
    importacoesConfirmadas = new Set((confirmadas || []).map((row: any) => String(row.id)))
  }

  const protegidos = new Set<string>()
  for (const row of resultadosRestantes.data || []) protegidos.add(String((row as any).campeonato_jogador_id))
  for (const row of refsImportacoes.data || []) {
    if (importacoesConfirmadas.has(String((row as any).importacao_id))) protegidos.add(String((row as any).campeonato_jogador_id))
  }
  for (const row of substituicoesSaida.data || []) {
    if ((row as any).inscricao_saiu_id) protegidos.add(String((row as any).inscricao_saiu_id))
  }
  for (const row of substituicoesEntrada.data || []) {
    if ((row as any).inscricao_entrou_id) protegidos.add(String((row as any).inscricao_entrou_id))
  }
  for (const row of historicoFormacao.data || []) {
    if ((row as any).campeonato_jogador_id) protegidos.add(String((row as any).campeonato_jogador_id))
  }

  const removiveis = automaticas.filter((row: any) => !protegidos.has(String(row.id)))
  const removiveisIds = removiveis.map((row: any) => String(row.id))
  if (!removiveisIds.length) {
    return { jogadores_removidos: jogadoresObsoletos.length, equipes_removidas: equipesObsoletas.length, membros_removidos: 0 }
  }

  const now = new Date().toISOString()
  const { error: removeParticipationError } = await supabaseAdmin
    .from('campeonato_jogadores')
    .update({ status: 'deletado', removido_em: now, removido_por: userId, updated_at: now })
    .in('id', removiveisIds)
  if (removeParticipationError) throw removeParticipationError

  const rosterIds = [...new Set(removiveis.map((row: any) => row.equipe_jogador_id).filter(Boolean).map(String))]
  if (!rosterIds.length) {
    return { jogadores_removidos: jogadoresObsoletos.length, equipes_removidas: equipesObsoletas.length, membros_removidos: 0 }
  }

  const { data: activeUses, error: activeUsesError } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('equipe_jogador_id')
    .in('equipe_jogador_id', rosterIds)
    .eq('status', 'ativo')
  if (activeUsesError) throw activeUsesError
  const rosterEmUso = new Set((activeUses || []).map((row: any) => String(row.equipe_jogador_id)))
  const candidatosRoster = rosterIds.filter((id) => !rosterEmUso.has(id))
  if (!candidatosRoster.length) {
    return { jogadores_removidos: jogadoresObsoletos.length, equipes_removidas: equipesObsoletas.length, membros_removidos: 0 }
  }

  const { data: rosterRows, error: rosterRowsError } = await supabaseAdmin
    .from('equipe_jogadores')
    .select('id,origem,created_at')
    .in('id', candidatosRoster)
    .eq('status', 'ativo')
  if (rosterRowsError) throw rosterRowsError
  const anteriorTs = anterior.created_at ? new Date(anterior.created_at).getTime() : 0
  const rosterRemovivel = (rosterRows || []).filter((row: any) => {
    if (row.origem !== 'matchresult') return false
    if (!anteriorTs || !row.created_at) return true
    return new Date(row.created_at).getTime() >= anteriorTs
  }).map((row: any) => String(row.id))
  if (!rosterRemovivel.length) {
    return { jogadores_removidos: jogadoresObsoletos.length, equipes_removidas: equipesObsoletas.length, membros_removidos: 0 }
  }

  const [{ error: lineError }, { error: rosterError }] = await Promise.all([
    supabaseAdmin
      .from('equipe_line_jogadores')
      .update({ status: 'inativo', removido_por: userId, removido_em: now, updated_at: now })
      .in('equipe_jogador_id', rosterRemovivel)
      .eq('status', 'ativo'),
    supabaseAdmin
      .from('equipe_jogadores')
      .update({ status: 'inativo', updated_at: now })
      .in('id', rosterRemovivel)
      .eq('status', 'ativo'),
  ])
  if (lineError) throw lineError
  if (rosterError) throw rosterError

  return {
    jogadores_removidos: jogadoresObsoletos.length,
    equipes_removidas: equipesObsoletas.length,
    membros_removidos: rosterRemovivel.length,
  }
}

export function parseMatchResult(content: string): ParsedTeam[] {
  const teams: ParsedTeam[] = []
  let current: ParsedTeam | null = null
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const teamMatch = line.match(/^TeamName:\s*(.*?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i)
    if (teamMatch) {
      current = {
        ordem: teams.length + 1,
        nome: teamMatch[1].trim(),
        posicao: Number(teamMatch[2]),
        abates: Number(teamMatch[3]),
        pontos_posicao_arquivo: Number(teamMatch[4]),
        pontos_total_arquivo: Number(teamMatch[5]),
        jogadores: [],
        abates_jogadores: 0,
        jogadores_contagem: 0,
        abates_conferem: true,
        diferenca_abates: 0,
      }
      teams.push(current)
      continue
    }
    const playerMatch = line.match(/^NAME:\s*(.*?)\s+ID:\s*([^\s]+)\s+KILL:\s*(\d+)/i)
    if (playerMatch && current) {
      current.jogadores.push({
        ordem: current.jogadores.length + 1,
        nick: playerMatch[1].trim(),
        id_jogo: playerMatch[2].trim(),
        abates: Number(playerMatch[3]),
      })
    }
  }
  if (!teams.length) throw new Error('O arquivo não contém equipes no formato MatchResult esperado.')
  return teams.map((team) => ({ ...team, ...auditarAbatesEquipe(team) }))
}

export async function previewMatchResult(campeonatoId: string, partidaId: string, content: string) {
  const parsed = parseMatchResult(content)
  const { data: campeonato, error: campeonatoError } = await supabaseAdmin.from('campeonatos').select('id,produtora_id').eq('id', campeonatoId).maybeSingle()
  if (campeonatoError) throw campeonatoError
  if (!campeonato?.produtora_id) throw new Error('Campeonato sem produtora vinculada.')
  const { data: partida, error: partidaError } = await supabaseAdmin.from('campeonato_partidas').select('id,jogo_id,status').eq('id', partidaId).eq('campeonato_id', campeonatoId).maybeSingle()
  if (partidaError) throw partidaError
  if (!partida) throw new Error('Queda não encontrada.')
  if (partida.status === 'finalizada') throw new Error('A queda já foi finalizada.')

  const [{ data: links }, { data: officialPlayers }, { data: tempPlayers }, { data: slots }] = await Promise.all([
    supabaseAdmin.from('matchresult_vinculos_equipes').select('nome_raw,nome_normalizado,campeonato_equipe_id').eq('campeonato_id', campeonatoId).eq('jogo_id', partida.jogo_id),
    supabaseAdmin.from('jogadores').select('id,id_jogo,nome,avatar_url').not('id_jogo', 'is', null),
    supabaseAdmin.from('jogadores_temporarios').select('id,id_jogo,nick,foto_url,status').eq('produtora_id', campeonato.produtora_id),
    supabaseAdmin.from('campeonato_pontuador_slots_jogo').select('campeonato_equipe_id,equipe_nome,equipe_tag,equipe_logo_url,grupo_id,grupo_nome,slot_numero,slot_vazio').eq('campeonato_id', campeonatoId).eq('jogo_id', partida.jogo_id).eq('slot_vazio', false),
  ])
  const linkMap = new Map((links || []).map((row: any) => [row.nome_normalizado, row.campeonato_equipe_id]))
  const officialMap = new Map((officialPlayers || []).map((row: any) => [normalizeName(row.id_jogo), row]))
  const tempMap = new Map((tempPlayers || []).map((row: any) => [normalizeName(row.id_jogo), row]))
  const availableTeams = (slots || []).filter((row: any) => row.campeonato_equipe_id)
  const exactNameMap = new Map<string, string[]>()
  for (const team of availableTeams) {
    const normalized = normalizeName(team.equipe_nome || '')
    if (!normalized) continue
    const values = exactNameMap.get(normalized) || []
    values.push(team.campeonato_equipe_id)
    exactNameMap.set(normalized, values)
  }

  const mappedTeams = parsed.map(team => {
    const normalized = normalizeName(team.nome)
    const persisted = linkMap.get(normalized) || null
    const exactCandidates = exactNameMap.get(normalized) || []
    const automatic = persisted || (exactCandidates.length === 1 ? exactCandidates[0] : null)
    return {
      ...team,
      nome_normalizado: normalized,
      campeonato_equipe_id: automatic,
      status_vinculo: persisted ? 'automatico_historico' : automatic ? 'automatico_nome' : exactCandidates.length > 1 ? 'conflito' : 'pendente',
      jogadores: team.jogadores.map(player => {
        const official = officialMap.get(normalizeName(player.id_jogo))
        const temporary = tempMap.get(normalizeName(player.id_jogo))
        return {
          ...player,
          nick_normalizado: normalizeName(player.nick),
          jogador_id: official?.id || null,
          jogador_temporario_id: official ? null : temporary?.id || null,
          status_vinculo: official ? 'oficial' : temporary ? 'temporario' : 'pendente',
        }
      }),
    }
  })

  const linkedIds = new Set(mappedTeams.map(team => team.campeonato_equipe_id).filter(Boolean))
  const equipesAusentes = availableTeams
    .filter((team: any) => !linkedIds.has(team.campeonato_equipe_id))
    .map((team: any) => ({ ...team, status_vinculo: 'vinculo_perdido', opcoes: ['selecionar_novo_nome', 'falta'] }))

  return {
    partida_id: partidaId,
    jogo_id: partida.jogo_id,
    equipes: mappedTeams,
    equipes_disponiveis: availableTeams,
    equipes_ausentes: equipesAusentes,
  }
}

export async function confirmarMatchResult(campeonatoId: string, userId: string, body: any) {
  const preview = await previewMatchResult(campeonatoId, body.partida_id, body.conteudo_bruto)
  const { data: campeonato } = await supabaseAdmin.from('campeonatos').select('produtora_id').eq('id', campeonatoId).single()
  const { data: partida } = await supabaseAdmin.from('campeonato_partidas').select('id,fase_id,jogo_id,grupo_id').eq('id', body.partida_id).single()
  if (!campeonato?.produtora_id || !partida) throw new Error('Contexto do campeonato inválido.')

  for (const teamValue of preview.equipes) {
    const team: any = teamValue
    const suppliedTeam = (body.equipes || []).find((x: any) => normalizeName(x.nome) === team.nome_normalizado)
    team.campeonato_equipe_id = suppliedTeam?.campeonato_equipe_id || team.campeonato_equipe_id
    team.posicao = Number(suppliedTeam?.posicao ?? team.posicao)
    team.abates = Number(suppliedTeam?.abates ?? team.abates)
    team.punicao_pontos = Math.min(Number(suppliedTeam?.punicao_pontos || 0), 0)
    team.punicao_motivo = String(suppliedTeam?.punicao_motivo || '').trim() || null
    team.jogadores = team.jogadores.map((player: any) => {
      const suppliedPlayer = (suppliedTeam?.jogadores || []).find((item: any) => Number(item.ordem) === player.ordem)
      if (!suppliedPlayer) return player
      const idChanged = normalizeName(suppliedPlayer.id_jogo) !== normalizeName(player.id_jogo)
      return { ...player, nick: String(suppliedPlayer.nick || player.nick).trim(), id_jogo: String(suppliedPlayer.id_jogo || player.id_jogo).trim(), abates: Math.max(Number(suppliedPlayer.abates ?? player.abates), 0), jogador_id: idChanged ? null : player.jogador_id, jogador_temporario_id: idChanged ? null : player.jogador_temporario_id }
    })
    Object.assign(team, auditarAbatesEquipe(team))
  }

  preview.equipes = preview.equipes.filter((team: any) => Boolean(team.campeonato_equipe_id))
  if (!preview.equipes.length) throw new Error('Vincule pelo menos uma equipe para aplicar o MatchResult.')

  const duplicatedTeam = preview.equipes.find((team: any, index: number, all: any[]) =>
    all.findIndex(other => other.campeonato_equipe_id === team.campeonato_equipe_id) !== index,
  )
  if (duplicatedTeam) {
    throw new Error('Duas equipes do MatchResult foram vinculadas à mesma equipe do campeonato. Revise os vínculos.')
  }

  const importacaoAnterior = await carregarImportacaoConfirmadaAnterior(partida.id)

  const { data: importacao, error: importError } = await supabaseAdmin.from('matchresult_importacoes').insert({
    produtora_id: campeonato.produtora_id,
    campeonato_id: campeonatoId,
    fase_id: partida.fase_id,
    jogo_id: partida.jogo_id,
    partida_id: partida.id,
    nome_arquivo: body.nome_arquivo || null,
    conteudo_bruto: body.conteudo_bruto,
    status: 'aguardando_revisao',
    total_equipes: preview.equipes.length,
    total_jogadores: preview.equipes.reduce((sum: number, team: any) => sum + team.jogadores.length, 0),
    criado_por: userId,
  }).select('id').single()
  if (importError) throw importError

  try {
  const manualPayload: any = { partida_id: partida.id, origem: 'matchresult', equipes: [] }
  for (const teamValue of preview.equipes) {
    const team: any = teamValue
    const { data: ce, error: ceError } = await supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,grupo_id').eq('id', team.campeonato_equipe_id).eq('campeonato_id', campeonatoId).single()
    if (ceError) throw ceError

    const { data: importTeam, error: importTeamError } = await supabaseAdmin.from('matchresult_importacoes_equipes').insert({
      importacao_id: importacao.id,
      ordem: team.ordem,
      nome_raw: team.nome,
      nome_normalizado: team.nome_normalizado,
      posicao: team.posicao,
      abates: team.abates,
      pontos_posicao_arquivo: team.pontos_posicao_arquivo,
      pontos_total_arquivo: team.pontos_total_arquivo,
      campeonato_equipe_id: ce.id,
      status_vinculo: 'confirmado',
    }).select('id').single()
    if (importTeamError) throw importTeamError

    const { error: linkError } = await supabaseAdmin.rpc('fn_registrar_vinculo_matchresult_equipe', {
      p_jogo_id: partida.jogo_id,
      p_nome_raw: team.nome,
      p_campeonato_equipe_id: ce.id,
      p_criado_por: userId,
    })
    if (linkError) throw linkError

    const manualTeam: any = { campeonato_equipe_id: ce.id, posicao: team.posicao, abates: team.abates, punicao_pontos: team.punicao_pontos, punicao_motivo: team.punicao_motivo, raw_team_name: team.nome, importacao_equipe_id: importTeam.id, jogadores: [] }
    for (const player of team.jogadores) {
      let jogadorId = player.jogador_id
      let tempId = player.jogador_temporario_id
      if (!jogadorId) {
        const { data: officialCandidates, error: officialError } = await supabaseAdmin.from('jogadores').select('id,id_jogo').not('id_jogo', 'is', null)
        if (officialError) throw officialError
        jogadorId = (officialCandidates || []).find((candidate: any) => normalizeName(candidate.id_jogo) === normalizeName(player.id_jogo))?.id || null
        if (jogadorId) tempId = null
      }
      if (!jogadorId && !tempId) {
        const { data: temporaryCandidates, error: candidatesError } = await supabaseAdmin
          .from('jogadores_temporarios')
          .select('id,id_jogo,status')
          .eq('produtora_id', campeonato.produtora_id)
        if (candidatesError) throw candidatesError
        const existingTemporary = (temporaryCandidates || []).find(
          (candidate: any) => normalizeName(candidate.id_jogo) === normalizeName(player.id_jogo),
        )
        if (existingTemporary) {
          if (existingTemporary.status !== 'ativo') {
            throw new Error(`O jogador temporário de ID ${player.id_jogo} não está ativo.`)
          }
          tempId = existingTemporary.id
          const { error: updateTempError } = await supabaseAdmin.from('jogadores_temporarios').update({ nick: player.nick }).eq('id', tempId)
          if (updateTempError) throw updateTempError
        } else {
          const { data: temp, error: tempError } = await supabaseAdmin.from('jogadores_temporarios').insert({
            produtora_id: campeonato.produtora_id,
            id_jogo: player.id_jogo,
            nick: player.nick,
            origem: 'matchresult',
            status: 'ativo',
          }).select('id').single()
          if (tempError) throw tempError
          tempId = temp.id
        }
      }

      const equipeJogadorId = await garantirMembroDaLine({
        equipeId: ce.equipe_id,
        lineId: ce.line_id || null,
        jogadorId: jogadorId || null,
        jogadorTemporarioId: tempId || null,
        nick: player.nick,
        idJogo: player.id_jogo,
        funcao: null,
        adicionadoPor: userId,
      })

      let participationQuery = supabaseAdmin.from('campeonato_jogadores').select('id,equipe_jogador_id').eq('campeonato_id', campeonatoId).eq('campeonato_equipe_id', ce.id).eq('status', 'ativo')
      participationQuery = jogadorId ? participationQuery.eq('jogador_id', jogadorId) : participationQuery.eq('jogador_temporario_id', tempId)
      let { data: participation } = await participationQuery.maybeSingle()
      if (!participation) {
        const { data: created, error: createError } = await supabaseAdmin.from('campeonato_jogadores').insert({
          campeonato_id: campeonatoId,
          campeonato_equipe_id: ce.id,
          equipe_id: ce.equipe_id,
          line_id: ce.line_id,
          jogador_id: jogadorId || null,
          jogador_temporario_id: tempId || null,
          equipe_jogador_id: equipeJogadorId,
          nick: player.nick,
          id_jogo: player.id_jogo,
          funcao: 'rush',
          origem: 'matchresult',
          criado_automaticamente: true,
          criado_por: userId,
          status: 'ativo',
        }).select('id,equipe_jogador_id').single()
        if (createError) throw createError
        participation = created
      } else if (participation.equipe_jogador_id !== equipeJogadorId) {
        const { error: updateParticipationError } = await supabaseAdmin
          .from('campeonato_jogadores')
          .update({ equipe_jogador_id: equipeJogadorId, equipe_id: ce.equipe_id, line_id: ce.line_id, updated_at: new Date().toISOString() })
          .eq('id', participation.id)
        if (updateParticipationError) throw updateParticipationError
      }
      if (!participation?.id) throw new Error('Nao foi possivel vincular o jogador a participacao do campeonato.')

      const { error: importPlayerError } = await supabaseAdmin.from('matchresult_importacoes_jogadores').insert({
        importacao_id: importacao.id,
        importacao_equipe_id: importTeam.id,
        ordem: player.ordem,
        nick_raw: player.nick,
        nick_normalizado: player.nick_normalizado,
        id_jogo: player.id_jogo,
        abates: player.abates,
        campeonato_jogador_id: participation.id,
        jogador_id: jogadorId || null,
        jogador_temporario_id: tempId || null,
        status_vinculo: jogadorId ? 'oficial' : 'temporario',
      })
      if (importPlayerError) throw importPlayerError
      manualTeam.jogadores.push({ campeonato_jogador_id: participation.id, abates: player.abates })
    }
    manualPayload.equipes.push(manualTeam)
  }

  const { salvarPontuacaoManual } = await import('./estatisticas.service')
  const totals = await salvarPontuacaoManual(campeonatoId, userId, manualPayload)
  const reconciliacao = await reconciliarSubstituicaoMatchResult({
    campeonatoId,
    partidaId: partida.id,
    userId,
    anterior: importacaoAnterior,
    equipesAtuais: manualPayload.equipes.map((team: any) => String(team.campeonato_equipe_id || '')).filter(Boolean),
    jogadoresAtuais: manualPayload.equipes.flatMap((team: any) => (team.jogadores || []).map((player: any) => String(player.campeonato_jogador_id || '')).filter(Boolean)),
  })

  if (importacaoAnterior?.id) {
    const { error: cancelPreviousError } = await supabaseAdmin
      .from('matchresult_importacoes')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', importacaoAnterior.id)
      .eq('status', 'confirmada')
    if (cancelPreviousError) throw cancelPreviousError
  }

  const { error: confirmError } = await supabaseAdmin.from('matchresult_importacoes').update({ status: 'confirmada', confirmado_por: userId, confirmado_em: new Date().toISOString() }).eq('id', importacao.id)
  if (confirmError) {
    if (importacaoAnterior?.id) {
      await supabaseAdmin.from('matchresult_importacoes').update({ status: 'confirmada', updated_at: new Date().toISOString() }).eq('id', importacaoAnterior.id).eq('status', 'cancelada')
    }
    throw confirmError
  }
  // Complemento privado: nunca interfere na súmula oficial caso a fonte externa esteja indisponível.
  let garena: Awaited<ReturnType<typeof sincronizarEstatisticasGarena>> = { status: 'ignorado' }
  try {
    garena = await sincronizarEstatisticasGarena({
      campeonatoId,
      jogoId: partida.jogo_id,
      partidaId: partida.id,
      produtoraId: campeonato.produtora_id,
      matchresultImportacaoId: importacao.id,
      nomeArquivo: body.nome_arquivo,
      userId,
    })
  } catch (error) {
    console.error('Não foi possível complementar o MatchResult com estatísticas detalhadas.', error)
  }
  return { importacao_id: importacao.id, garena, reconciliacao, ...totals }
  } catch (error) {
    const message = errorMessage(error)
    await supabaseAdmin.from('matchresult_importacoes').update({
      status: 'erro',
      erro: message.slice(0, 800),
      updated_at: new Date().toISOString(),
    }).eq('id', importacao.id)
    throw new Error(`Não foi possível confirmar o MatchResult: ${message}`)
  }
}
