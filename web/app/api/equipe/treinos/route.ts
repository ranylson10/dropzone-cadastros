import { NextRequest, NextResponse } from 'next/server'
import { getAccountsByUserId, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function managedTeamIds(userId: string) {
  const accounts = await getAccountsByUserId(userId)
  const controllable = await listControllableEquipes(userId, accounts)
  return controllable.map((team) => String(team.id)).filter(Boolean)
}

function compactText(value: unknown, max = 120) {
  const text = String(value || '').trim()
  return text ? text.slice(0, max) : null
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const teamIds = await managedTeamIds(user.id)
    if (!teamIds.length) return NextResponse.json({ treinos: [] })

    const { data: participacoes, error: participacoesError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,line_id,grupo_id,status')
      .in('equipe_id', teamIds)
      .eq('status', 'ativo')
    if (participacoesError) throw participacoesError

    const campeonatoIds = [...new Set((participacoes || []).map((item: any) => String(item.campeonato_id || '')).filter(Boolean))]
    if (!campeonatoIds.length) return NextResponse.json({ treinos: [] })

    const { data: campeonatos, error: campeonatosError } = await supabaseAdmin
      .from('campeonatos')
      .select('id,nome,tipo,logo_url,status,created_at')
      .in('id', campeonatoIds)
    if (campeonatosError) throw campeonatosError

    const xtreinos = (campeonatos || []).filter((item: any) => String(item.tipo || '').toLowerCase() === 'xtreino')
    const xtreinoIds = new Set(xtreinos.map((item: any) => String(item.id)))
    const xtreinoParticipacoes = (participacoes || []).filter((item: any) => xtreinoIds.has(String(item.campeonato_id)))
    const participacaoIds = xtreinoParticipacoes.map((item: any) => String(item.id)).filter(Boolean)
    const xtreinoCampeonatoIds = [...xtreinoIds]
    if (!participacaoIds.length) return NextResponse.json({ treinos: [] })

    const [resumosResult, equipesStatsResult, jogadoresStatsResult, configResult, annotationsResult] = await Promise.all([
      supabaseAdmin
        .from('campeonato_escalacoes_resumo')
        .select('*')
        .in('campeonato_equipe_id', participacaoIds),
      supabaseAdmin
        .from('campeonato_estatisticas_equipes_detalhe')
        .select('*')
        .in('campeonato_equipe_id', participacaoIds),
      supabaseAdmin
        .from('campeonato_estatisticas_mvp_detalhe')
        .select('*')
        .in('campeonato_equipe_id', participacaoIds),
      supabaseAdmin
        .from('campeonato_configuracoes')
        .select('campeonato_id,xtreino_call_fixa,xtreino_registra_primeira_safe,xtreino_registra_segunda_safe')
        .in('campeonato_id', xtreinoCampeonatoIds),
      supabaseAdmin
        .from('xtreino_anotacoes_equipes_quedas')
        .select('campeonato_equipe_id,partida_id,call_nome,primeira_safe,segunda_safe,updated_at')
        .in('campeonato_equipe_id', participacaoIds),
    ])
    if (resumosResult.error) throw resumosResult.error
    if (equipesStatsResult.error) throw equipesStatsResult.error
    if (jogadoresStatsResult.error) throw jogadoresStatsResult.error
    if (configResult.error) throw configResult.error
    if (annotationsResult.error) throw annotationsResult.error

    // Telemetria detalhada da Garena: continua privada e só é carregada depois
    // de confirmar que a participação pertence a uma equipe controlada pelo usuário.
    // É enriquecimento opcional: falha da Garena nunca invalida MatchResult/estatísticas oficiais.
    let garenaImportacoes: any[] = []
    let garenaJogadores: any[] = []
    let garenaArmas: any[] = []
    let garenaHabilidades: any[] = []

    const garenaImportacoesResult = await supabaseAdmin
      .from('garena_matchstats_importacoes')
      .select('id,campeonato_id,partida_id,status,concluida_em')
      .in('campeonato_id', xtreinoCampeonatoIds)
      .eq('status', 'concluida')

    if (!garenaImportacoesResult.error) {
      garenaImportacoes = garenaImportacoesResult.data || []
      const garenaImportacaoIds = garenaImportacoes.map((item: any) => String(item.id)).filter(Boolean)

      if (garenaImportacaoIds.length) {
        const garenaJogadoresResult = await supabaseAdmin
          .from('garena_matchstats_jogadores')
          .select('id,importacao_id,player_id,campeonato_jogador_id,jogador_id,jogador_temporario_id,campeonato_equipe_id,nick_snapshot,equipe_snapshot,posicao_equipe,abates,assistencias,dano,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,precisao_percentual,taxa_headshot_kill_percentual,precisao_headshot_percentual,revives,membros_revividos,membros_resgatados,granadas_usadas,abates_granada,dano_granada,gel_usado,gel_destruido,kits_medicos,abates_veiculo,abates_oleo,mudanca_posicao')
          .in('importacao_id', garenaImportacaoIds)
          .in('campeonato_equipe_id', participacaoIds)

        if (!garenaJogadoresResult.error) {
          garenaJogadores = garenaJogadoresResult.data || []
          const garenaJogadorIds = garenaJogadores.map((item: any) => String(item.id)).filter(Boolean)

          if (garenaJogadorIds.length) {
            const [armasResult, habilidadesResult] = await Promise.all([
              supabaseAdmin
                .from('garena_matchstats_armas')
                .select('jogador_matchstats_id,ordem,weapon_id,arma,abates,dano,headshots,precisao_percentual,precisao_headshot_percentual')
                .in('jogador_matchstats_id', garenaJogadorIds),
              supabaseAdmin
                .from('garena_matchstats_habilidades')
                .select('jogador_matchstats_id,tipo,ordem,skill_id,personagem,habilidade,usos,informacao,pick_times,pick_rate')
                .in('jogador_matchstats_id', garenaJogadorIds),
            ])
            garenaArmas = armasResult.error ? [] : (armasResult.data || [])
            garenaHabilidades = habilidadesResult.error ? [] : (habilidadesResult.data || [])
          }
        }
      }
    }

    const campeonatoById = new Map(xtreinos.map((item: any) => [String(item.id), item]))
    const configByCampeonato = new Map((configResult.data || []).map((item: any) => [String(item.campeonato_id), item]))
    const resumoByParticipacao = new Map((resumosResult.data || []).map((item: any) => [String(item.campeonato_equipe_id), item]))
    const annotationByDrop = new Map((annotationsResult.data || []).map((item: any) => [`${item.campeonato_equipe_id}:${item.partida_id}`, item]))
    const garenaPartidaByImportacao = new Map((garenaImportacoes || []).map((item: any) => [String(item.id), String(item.partida_id || '')]))
    const armasByJogadorMatchstats = new Map<string, any[]>()
    for (const row of garenaArmas) {
      const key = String(row.jogador_matchstats_id || '')
      if (!key) continue
      armasByJogadorMatchstats.set(key, [...(armasByJogadorMatchstats.get(key) || []), row])
    }
    const habilidadesByJogadorMatchstats = new Map<string, any[]>()
    for (const row of garenaHabilidades) {
      const key = String(row.jogador_matchstats_id || '')
      if (!key) continue
      habilidadesByJogadorMatchstats.set(key, [...(habilidadesByJogadorMatchstats.get(key) || []), row])
    }
    const garenaByParticipacaoPartida = new Map<string, any[]>()
    for (const row of garenaJogadores) {
      const participacaoId = String(row.campeonato_equipe_id || '')
      const partidaId = garenaPartidaByImportacao.get(String(row.importacao_id || '')) || ''
      if (!participacaoId || !partidaId) continue
      const key = `${participacaoId}:${partidaId}`
      const jogadorMatchstatsId = String(row.id || '')
      garenaByParticipacaoPartida.set(key, [...(garenaByParticipacaoPartida.get(key) || []), {
        ...row,
        armas: (armasByJogadorMatchstats.get(jogadorMatchstatsId) || []).sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0)),
        habilidades: (habilidadesByJogadorMatchstats.get(jogadorMatchstatsId) || []).sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0)),
      }])
    }

    const teamRowsByParticipacao = new Map<string, any[]>()
    for (const row of equipesStatsResult.data || []) {
      const key = String((row as any).campeonato_equipe_id || '')
      if (!key) continue
      teamRowsByParticipacao.set(key, [...(teamRowsByParticipacao.get(key) || []), row])
    }

    const playerRowsByParticipacao = new Map<string, any[]>()
    for (const row of jogadoresStatsResult.data || []) {
      const key = String((row as any).campeonato_equipe_id || '')
      if (!key) continue
      playerRowsByParticipacao.set(key, [...(playerRowsByParticipacao.get(key) || []), row])
    }

    const treinos = xtreinoParticipacoes.map((participacao: any) => {
      const participacaoId = String(participacao.id)
      const campeonatoId = String(participacao.campeonato_id)
      const campeonato: any = campeonatoById.get(campeonatoId)
      const config: any = configByCampeonato.get(campeonatoId)
      const resumo: any = resumoByParticipacao.get(participacaoId)
      const teamRows = teamRowsByParticipacao.get(participacaoId) || []
      const positions = teamRows.map((row: any) => Number(row.posicao || 0)).filter((value: number) => value > 0)
      const playerRows = playerRowsByParticipacao.get(participacaoId) || []

      const players = new Map<string, any>()
      const playersByDrop = new Map<string, any[]>()
      for (const row of playerRows) {
        const dropId = String(row.partida_id || '')
        if (dropId) playersByDrop.set(dropId, [...(playersByDrop.get(dropId) || []), row])

        const key = String(row.campeonato_jogador_id || row.jogador_id || row.jogador_temporario_id || row.nick || '')
        if (!key) continue
        const current = players.get(key) || {
          campeonato_jogador_id: key,
          nick: String(row.nick || 'Jogador'),
          id_jogo: row.id_jogo || null,
          foto_url: row.foto_url || null,
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
        players.set(key, current)
      }

      const jogadores = [...players.values()].sort((a: any, b: any) => b.abates - a.abates || b.dano - a.dano)
      const quedasDetalhe = teamRows
        .map((row: any) => {
          const partidaId = String(row.partida_id || '')
          const dropPlayers = playersByDrop.get(partidaId) || []
          const annotation: any = annotationByDrop.get(`${participacaoId}:${partidaId}`)
          const garenaPlayers = garenaByParticipacaoPartida.get(`${participacaoId}:${partidaId}`) || []
          return {
            partida_id: partidaId,
            jogo_id: row.jogo_id || null,
            numero_partida: Number(row.numero_partida || 0),
            mapa_codigo: row.mapa_codigo || null,
            posicao: Number(row.posicao || 0) || null,
            abates: Number(row.abates || 0),
            pontos_total: Number(row.pontos_total || 0),
            booyah: Boolean(row.booyah),
            dano: dropPlayers.reduce((sum: number, player: any) => sum + Number(player.dano || 0), 0),
            assistencias: dropPlayers.reduce((sum: number, player: any) => sum + Number(player.assistencias || 0), 0),
            revives: dropPlayers.reduce((sum: number, player: any) => sum + Number(player.revives || 0), 0),
            call_nome: annotation?.call_nome || '',
            primeira_safe: annotation?.primeira_safe || '',
            segunda_safe: annotation?.segunda_safe || '',
            anotacao_atualizada_em: annotation?.updated_at || null,
            telemetria_garena: garenaPlayers.length > 0,
            jogadores_detalhados: garenaPlayers.map((player: any) => ({
              player_id: String(player.player_id || ''),
              campeonato_jogador_id: player.campeonato_jogador_id || null,
              nick: String(player.nick_snapshot || 'Jogador'),
              abates: Number(player.abates || 0),
              assistencias: Number(player.assistencias || 0),
              dano: Number(player.dano || 0),
              headshots: Number(player.headshots || 0),
              knockdowns: Number(player.knockdowns || 0),
              sobrevivencia_segundos: Number(player.sobrevivencia_segundos || 0),
              distancia_movida: Number(player.distancia_movida || 0),
              distancia_max_abate: Number(player.distancia_max_abate || 0),
              precisao_percentual: Number(player.precisao_percentual || 0),
              taxa_headshot_kill_percentual: Number(player.taxa_headshot_kill_percentual || 0),
              precisao_headshot_percentual: Number(player.precisao_headshot_percentual || 0),
              revives: Number(player.revives || 0),
              membros_revividos: Number(player.membros_revividos || 0),
              membros_resgatados: Number(player.membros_resgatados || 0),
              granadas_usadas: Number(player.granadas_usadas || 0),
              abates_granada: Number(player.abates_granada || 0),
              dano_granada: Number(player.dano_granada || 0),
              gel_usado: Number(player.gel_usado || 0),
              gel_destruido: Number(player.gel_destruido || 0),
              kits_medicos: Number(player.kits_medicos || 0),
              armas: player.armas.map((weapon: any) => ({
                arma: String(weapon.arma || weapon.weapon_id || 'Arma'),
                abates: Number(weapon.abates || 0),
                dano: Number(weapon.dano || 0),
                headshots: Number(weapon.headshots || 0),
                precisao_percentual: Number(weapon.precisao_percentual || 0),
              })),
              habilidades: player.habilidades.map((skill: any) => ({
                tipo: String(skill.tipo || ''),
                personagem: String(skill.personagem || ''),
                habilidade: String(skill.habilidade || ''),
                usos: Number(skill.usos || 0),
              })),
            })),
          }
        })
        .filter((row: any) => row.partida_id)
        .sort((a: any, b: any) => a.numero_partida - b.numero_partida)

      return {
        campeonato_id: campeonatoId,
        campeonato_equipe_id: participacaoId,
        equipe_id: String(participacao.equipe_id),
        nome: String(campeonato?.nome || resumo?.campeonato_nome || 'Xtreino'),
        logo_url: campeonato?.logo_url || null,
        status: campeonato?.status || null,
        line_nome: resumo?.line_nome || null,
        grupo_nome: resumo?.grupo_nome || null,
        fase_nome: resumo?.fase_nome || null,
        created_at: campeonato?.created_at || null,
        configuracao_analise: {
          call_fixa: Boolean(config?.xtreino_call_fixa),
          primeira_safe: Boolean(config?.xtreino_registra_primeira_safe),
          segunda_safe: Boolean(config?.xtreino_registra_segunda_safe),
        },
        quedas: teamRows.length,
        booyahs: teamRows.filter((row: any) => Boolean(row.booyah)).length,
        abates: teamRows.reduce((sum: number, row: any) => sum + Number(row.abates || 0), 0),
        pontos_total: teamRows.reduce((sum: number, row: any) => sum + Number(row.pontos_total || 0), 0),
        colocacao_media: positions.length ? positions.reduce((sum: number, value: number) => sum + value, 0) / positions.length : null,
        melhor_posicao: positions.length ? Math.min(...positions) : null,
        dano: jogadores.reduce((sum: number, row: any) => sum + Number(row.dano || 0), 0),
        assistencias: jogadores.reduce((sum: number, row: any) => sum + Number(row.assistencias || 0), 0),
        revives: jogadores.reduce((sum: number, row: any) => sum + Number(row.revives || 0), 0),
        jogadores,
        quedas_detalhe: quedasDetalhe,
      }
    })

    treinos.sort((a: any, b: any) => String(b.created_at || b.nome).localeCompare(String(a.created_at || a.nome)))
    return NextResponse.json({ treinos })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar treinos da equipe.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const teamIds = await managedTeamIds(user.id)
    if (!teamIds.length) throw new Error('Você não controla nenhuma equipe.')

    const body = await req.json()
    const campeonatoEquipeId = String(body?.campeonato_equipe_id || '').trim()
    const partidaId = String(body?.partida_id || '').trim()
    if (!campeonatoEquipeId || !partidaId) throw new Error('Equipe do campeonato e queda são obrigatórias.')

    const { data: participacao, error: participacaoError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,status')
      .eq('id', campeonatoEquipeId)
      .in('equipe_id', teamIds)
      .eq('status', 'ativo')
      .maybeSingle()
    if (participacaoError) throw participacaoError
    if (!participacao) throw new Error('Você não tem permissão para editar a análise desta equipe.')

    const [{ data: campeonato, error: campeonatoError }, { data: partida, error: partidaError }, { data: config, error: configError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,tipo').eq('id', participacao.campeonato_id).maybeSingle(),
      supabaseAdmin.from('campeonato_partidas').select('id,campeonato_id').eq('id', partidaId).eq('campeonato_id', participacao.campeonato_id).maybeSingle(),
      supabaseAdmin
        .from('campeonato_configuracoes')
        .select('xtreino_call_fixa,xtreino_registra_primeira_safe,xtreino_registra_segunda_safe')
        .eq('campeonato_id', participacao.campeonato_id)
        .maybeSingle(),
    ])
    if (campeonatoError) throw campeonatoError
    if (partidaError) throw partidaError
    if (configError) throw configError
    if (!campeonato || String(campeonato.tipo || '').toLowerCase() !== 'xtreino') throw new Error('Esta análise é exclusiva de XTreinos.')
    if (!partida) throw new Error('A queda não pertence a este XTreino.')

    const payload = {
      campeonato_id: String(participacao.campeonato_id),
      campeonato_equipe_id: campeonatoEquipeId,
      equipe_id: String(participacao.equipe_id),
      partida_id: partidaId,
      call_nome: config?.xtreino_call_fixa ? compactText(body?.call_nome) : null,
      primeira_safe: config?.xtreino_registra_primeira_safe ? compactText(body?.primeira_safe) : null,
      segunda_safe: config?.xtreino_registra_segunda_safe ? compactText(body?.segunda_safe) : null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    const { data: anotacao, error } = await supabaseAdmin
      .from('xtreino_anotacoes_equipes_quedas')
      .upsert(payload, { onConflict: 'campeonato_equipe_id,partida_id' })
      .select('campeonato_equipe_id,partida_id,call_nome,primeira_safe,segunda_safe,updated_at')
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, anotacao })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar análise privada da queda.' }, { status: 400 })
  }
}
