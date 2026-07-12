import { supabaseAdmin } from '../../shared/supabase-admin'

export type ParsedPlayer = { ordem: number; nick: string; id_jogo: string; abates: number }
export type ParsedTeam = { ordem: number; nome: string; posicao: number; abates: number; pontos_posicao_arquivo: number; pontos_total_arquivo: number; jogadores: ParsedPlayer[] }

export function normalizeName(value: string) {
  return value.normalize('NFKC').replace(/[\u00A0\u3164\uFFA0]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
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
  return teams
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

  const [{ data: links }, { data: officialPlayers }, { data: tempPlayers }] = await Promise.all([
    supabaseAdmin.from('matchresult_vinculos_equipes').select('nome_normalizado,campeonato_equipe_id').eq('campeonato_id', campeonatoId).eq('jogo_id', partida.jogo_id),
    supabaseAdmin.from('jogadores').select('id,id_jogo,nome,avatar_url').not('id_jogo', 'is', null),
    supabaseAdmin.from('jogadores_temporarios').select('id,id_jogo,nick,foto_url,status').eq('produtora_id', campeonato.produtora_id),
  ])
  const linkMap = new Map((links || []).map((row: any) => [row.nome_normalizado, row.campeonato_equipe_id]))
  const officialMap = new Map((officialPlayers || []).map((row: any) => [normalizeName(row.id_jogo), row]))
  const tempMap = new Map((tempPlayers || []).map((row: any) => [normalizeName(row.id_jogo), row]))

  return {
    partida_id: partidaId,
    jogo_id: partida.jogo_id,
    equipes: parsed.map(team => ({
      ...team,
      nome_normalizado: normalizeName(team.nome),
      campeonato_equipe_id: linkMap.get(normalizeName(team.nome)) || null,
      status_vinculo: linkMap.has(normalizeName(team.nome)) ? 'automatico' : 'pendente',
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
    })),
  }
}

export async function confirmarMatchResult(campeonatoId: string, userId: string, body: any) {
  const preview = await previewMatchResult(campeonatoId, body.partida_id, body.conteudo_bruto)
  const { data: campeonato } = await supabaseAdmin.from('campeonatos').select('produtora_id').eq('id', campeonatoId).single()
  const { data: partida } = await supabaseAdmin.from('campeonato_partidas').select('id,fase_id,jogo_id,grupo_id').eq('id', body.partida_id).single()
  if (!campeonato?.produtora_id || !partida) throw new Error('Contexto do campeonato inválido.')

  for (const team of preview.equipes) {
    const suppliedTeam = (body.equipes || []).find((x: any) => normalizeName(x.nome) === team.nome_normalizado)
    team.campeonato_equipe_id = suppliedTeam?.campeonato_equipe_id || team.campeonato_equipe_id
    if (!team.campeonato_equipe_id) throw new Error(`Vincule a equipe "${team.nome}" antes de confirmar.`)
  }

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

  const manualPayload: any = { partida_id: partida.id, equipes: [] }
  for (const team of preview.equipes) {
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

    const manualTeam: any = { campeonato_equipe_id: ce.id, posicao: team.posicao, abates: team.abates, jogadores: [] }
    for (const player of team.jogadores) {
      let jogadorId = player.jogador_id
      let tempId = player.jogador_temporario_id
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

      let participationQuery = supabaseAdmin.from('campeonato_jogadores').select('id').eq('campeonato_id', campeonatoId).eq('campeonato_equipe_id', ce.id).eq('status', 'ativo')
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
          nick: player.nick,
          id_jogo: player.id_jogo,
          funcao: 'rush',
          origem: 'matchresult',
          criado_automaticamente: true,
          criado_por: userId,
          status: 'ativo',
        }).select('id').single()
        if (createError) throw createError
        participation = created
      }

      await supabaseAdmin.from('matchresult_importacoes_jogadores').insert({
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
      manualTeam.jogadores.push({ campeonato_jogador_id: participation.id, abates: player.abates })
    }
    manualPayload.equipes.push(manualTeam)
  }

  const { salvarPontuacaoManual } = await import('./estatisticas.service')
  const totals = await salvarPontuacaoManual(campeonatoId, userId, manualPayload)
  const { error: confirmError } = await supabaseAdmin.from('matchresult_importacoes').update({ status: 'confirmada', confirmado_por: userId, confirmado_em: new Date().toISOString() }).eq('id', importacao.id)
  if (confirmError) throw confirmError
  return { importacao_id: importacao.id, ...totals }
}
