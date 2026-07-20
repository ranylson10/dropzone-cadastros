import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function statusEscalacao(quantidade: number, limite: number | null) {
  if (quantidade === 0) return 'pendente'
  if (limite && quantidade >= limite) return 'completa'
  return 'parcial'
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const [{ data: campeonato, error: campeonatoError }, { data: configuracao }, { data: participacoes, error: participacoesError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id, nome, logo_url, aprovacao_status').eq('id', id).is('deleted_at', null).single(),
      supabaseAdmin.from('campeonato_configuracoes').select('jogadores_por_vaga').eq('campeonato_id', id).maybeSingle(),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('id, equipe_id, line_id, slot_id, grupo_id, slot_numero, nome_exibicao')
        .eq('campeonato_id', id)
        .eq('status', 'ativo')
        .not('line_id', 'is', null),
    ])

    if (campeonatoError) throw campeonatoError
    if (campeonato?.aprovacao_status && campeonato.aprovacao_status !== 'aprovado') {
      throw new Error('Campeonato aguardando liberaÃ§Ã£o para ir ao ar.')
    }
    if (participacoesError) throw participacoesError

    const itens = participacoes || []
    const equipeIds = [...new Set(itens.map((item) => item.equipe_id).filter(Boolean))]
    const lineIds = [...new Set(itens.map((item) => item.line_id).filter(Boolean))]
    const slotIds = [...new Set(itens.map((item) => item.slot_id).filter(Boolean))]
    const participacaoIds = itens.map((item) => item.id)

    const [{ data: equipes }, { data: lines }, { data: slots }, { data: jogadores }, { data: inscricoes }] = await Promise.all([
      equipeIds.length ? supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').in('id', equipeIds) : Promise.resolve({ data: [] as any[] }),
      lineIds.length ? supabaseAdmin.from('equipe_lines').select('id, nome, tag, logo_url').in('id', lineIds) : Promise.resolve({ data: [] as any[] }),
      slotIds.length
        ? supabaseAdmin.from('campeonato_slots').select('id, slot_numero, slot_letra').in('id', slotIds)
        : Promise.resolve({ data: [] as any[] }),
      participacaoIds.length
        ? supabaseAdmin
            .from('campeonato_jogadores')
            .select('id, campeonato_equipe_id, jogador_id, nick, foto_url, id_jogo, funcao, localidade, status')
            .in('campeonato_equipe_id', participacaoIds)
        : Promise.resolve({ data: [] as any[] }),
      participacaoIds.length
        ? supabaseAdmin
            .from('inscricoes_jogadores')
            .select('id, campeonato_equipe_id, jogador_auth_user_id, nick, foto_url, id_jogo, funcao, localidade')
            .in('campeonato_equipe_id', participacaoIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const equipesMap = new Map((equipes || []).map((item) => [item.id, item]))
    const linesMap = new Map((lines || []).map((item) => [item.id, item]))
    const slotsMap = new Map((slots || []).map((item) => [item.id, item]))
    const limite = configuracao?.jogadores_por_vaga ? Number(configuracao.jogadores_por_vaga) : null

    const resultado = itens
      .flatMap((participacao) => {
        const equipe = equipesMap.get(participacao.equipe_id)
        const line = linesMap.get(participacao.line_id)
        if (!equipe || !line) return []

        const slot = participacao.slot_id ? slotsMap.get(participacao.slot_id) : null
        const vaga = {
          id: String(participacao.slot_id || participacao.id),
          numero_vaga: Number(slot?.slot_numero || participacao.slot_numero || 0),
          slot_letra: slot?.slot_letra || null,
        }

        const unidos = [
          ...(jogadores || [])
            .filter((item) => item.campeonato_equipe_id === participacao.id)
            .map((item) => ({ ...item, origem: 'campeonato_jogadores' as const })),
          ...(inscricoes || [])
            .filter((item) => item.campeonato_equipe_id === participacao.id)
            .map((item) => ({ ...item, status: 'inscrito', origem: 'inscricoes_jogadores' as const })),
        ]

        const unicos = Array.from(
          new Map(unidos.map((item) => [String(item.jogador_id || item.jogador_auth_user_id || item.id_jogo || item.id), item])).values(),
        )
        return [{
          id: participacao.id,
          nome_exibicao: participacao.nome_exibicao || line.nome,
          equipe,
          line,
          vaga,
          grupo_id: participacao.grupo_id || null,
          jogadores: unicos,
          quantidade_jogadores: unicos.length,
          limite_jogadores: limite,
          status_escalacao: statusEscalacao(unicos.length, limite),
        }]
      })
      .sort((a, b) => a.vaga.numero_vaga - b.vaga.numero_vaga)

    return NextResponse.json({ campeonato, limite_jogadores: limite, participacoes: resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar escalações.' }, { status: 400 })
  }
}
