import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

type MidiaItem = {
  tipo: 'campeonato_logo' | 'equipe_logo' | 'line_logo' | 'jogador_foto'
  ref_id: string
  nome: string
  url: string
}

function canExport(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
  )
}

/**
 * Pacote de dados do campeonato para SPEC / overlays / produção.
 * v1: JSON estruturado + lista de mídias (logos e fotos).
 * Próximos passos: ZIP de imagens, filtros por fase/grupo, etc.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)

    if (!canExport(permission)) {
      return NextResponse.json(
        { error: 'Sem permissão para exportar dados deste campeonato.' },
        { status: 403 },
      )
    }

    let campeonato: any = null
    let campError: any = null
    {
      const full = await supabaseAdmin
        .from('campeonatos')
        .select('id, nome, logo_url, status, banner_url, modalidade, created_at')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
      if (full.error && ['42703', 'PGRST204'].includes(full.error.code || '')) {
        const basic = await supabaseAdmin
          .from('campeonatos')
          .select('id, nome, logo_url, status, created_at')
          .eq('id', id)
          .is('deleted_at', null)
          .single()
        campeonato = basic.data
        campError = basic.error
      } else {
        campeonato = full.data
        campError = full.error
      }
    }

    let config: any = null
    {
      const full = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('jogadores_por_vaga, cor_principal, cor_secundaria, bg_image_url')
        .eq('campeonato_id', id)
        .maybeSingle()
      if (full.error && ['42703', 'PGRST204'].includes(full.error.code || '')) {
        const basic = await supabaseAdmin
          .from('campeonato_configuracoes')
          .select('jogadores_por_vaga')
          .eq('campeonato_id', id)
          .maybeSingle()
        config = basic.data
      } else {
        config = full.data
      }
    }

    const { data: participacoes, error: partError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id, equipe_id, line_id, slot_id, grupo_id, slot_numero, nome_exibicao, status')
      .eq('campeonato_id', id)
      .eq('status', 'ativo')
      .order('slot_numero', { ascending: true })

    if (campError) throw campError
    if (partError) throw partError
    if (!campeonato) {
      return NextResponse.json({ error: 'Campeonato não encontrado.' }, { status: 404 })
    }

    const itens = participacoes || []
    const equipeIds = [...new Set(itens.map((item) => item.equipe_id).filter(Boolean))]
    const lineIds = [...new Set(itens.map((item) => item.line_id).filter(Boolean))]
    const slotIds = [...new Set(itens.map((item) => item.slot_id).filter(Boolean))]
    const grupoIds = [...new Set(itens.map((item) => item.grupo_id).filter(Boolean))]
    const participacaoIds = itens.map((item) => item.id)

    const [
      { data: equipes },
      { data: lines },
      { data: slots },
      { data: grupos },
      { data: jogadoresCamp },
      { data: inscricoes },
    ] = await Promise.all([
      equipeIds.length
        ? supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').in('id', equipeIds)
        : Promise.resolve({ data: [] as any[] }),
      lineIds.length
        ? supabaseAdmin.from('equipe_lines').select('id, nome, tag, logo_url, equipe_id').in('id', lineIds)
        : Promise.resolve({ data: [] as any[] }),
      slotIds.length
        ? supabaseAdmin.from('campeonato_slots').select('id, slot_numero, slot_letra, grupo_id').in('id', slotIds)
        : Promise.resolve({ data: [] as any[] }),
      grupoIds.length
        ? supabaseAdmin.from('campeonato_grupos').select('id, nome, fase_id').in('id', grupoIds)
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
    const gruposMap = new Map((grupos || []).map((item) => [item.id, item]))

    const midias: MidiaItem[] = []
    const pushMidia = (item: MidiaItem) => {
      const url = String(item.url || '').trim()
      if (!url) return
      if (midias.some((m) => m.url === url && m.tipo === item.tipo)) return
      midias.push({ ...item, url })
    }

    if (campeonato.logo_url) {
      pushMidia({
        tipo: 'campeonato_logo',
        ref_id: campeonato.id,
        nome: campeonato.nome,
        url: campeonato.logo_url,
      })
    }

    const equipesExport = new Map<string, any>()

    for (const part of itens) {
      const equipe = part.equipe_id ? equipesMap.get(part.equipe_id) : null
      const line = part.line_id ? linesMap.get(part.line_id) : null
      if (!equipe) continue

      if (!equipesExport.has(equipe.id)) {
        equipesExport.set(equipe.id, {
          id: equipe.id,
          nome: equipe.nome,
          tag: equipe.tag || null,
          logo_url: equipe.logo_url || null,
          lines: [] as any[],
        })
        if (equipe.logo_url) {
          pushMidia({
            tipo: 'equipe_logo',
            ref_id: equipe.id,
            nome: equipe.nome,
            url: equipe.logo_url,
          })
        }
      }

      const slot = part.slot_id ? slotsMap.get(part.slot_id) : null
      const grupo = part.grupo_id ? gruposMap.get(part.grupo_id) : null

      const unidos = [
        ...(jogadoresCamp || [])
          .filter((item) => item.campeonato_equipe_id === part.id)
          .map((item) => ({
            id: item.id,
            jogador_id: item.jogador_id || null,
            nick: item.nick || null,
            foto_url: item.foto_url || null,
            id_jogo: item.id_jogo || null,
            funcao: item.funcao || null,
            localidade: item.localidade || null,
            status: item.status || 'inscrito',
            origem: 'campeonato_jogadores' as const,
          })),
        ...(inscricoes || [])
          .filter((item) => item.campeonato_equipe_id === part.id)
          .map((item) => ({
            id: item.id,
            jogador_id: item.jogador_auth_user_id || null,
            nick: item.nick || null,
            foto_url: item.foto_url || null,
            id_jogo: item.id_jogo || null,
            funcao: item.funcao || null,
            localidade: item.localidade || null,
            status: 'inscrito',
            origem: 'inscricoes_jogadores' as const,
          })),
      ]

      const jogadoresUnicos = Array.from(
        new Map(
          unidos.map((item) => [
            String(item.jogador_id || item.id_jogo || item.nick || item.id),
            item,
          ]),
        ).values(),
      )

      for (const jogador of jogadoresUnicos) {
        if (jogador.foto_url) {
          pushMidia({
            tipo: 'jogador_foto',
            ref_id: String(jogador.jogador_id || jogador.id),
            nome: String(jogador.nick || 'Jogador'),
            url: jogador.foto_url,
          })
        }
      }

      const linePayload = {
        participacao_id: part.id,
        id: line?.id || null,
        nome: line?.nome || part.nome_exibicao || 'Line',
        tag: line?.tag || null,
        logo_url: line?.logo_url || equipe.logo_url || null,
        nome_exibicao: part.nome_exibicao || line?.nome || equipe.nome,
        slot: {
          id: part.slot_id || null,
          numero: Number(slot?.slot_numero || part.slot_numero || 0) || null,
          letra: slot?.slot_letra || null,
        },
        grupo: grupo
          ? { id: grupo.id, nome: grupo.nome, fase_id: grupo.fase_id || null }
          : part.grupo_id
            ? { id: part.grupo_id, nome: null, fase_id: null }
            : null,
        jogadores: jogadoresUnicos,
        quantidade_jogadores: jogadoresUnicos.length,
      }

      if (line?.logo_url) {
        pushMidia({
          tipo: 'line_logo',
          ref_id: line.id,
          nome: line.nome,
          url: line.logo_url,
        })
      }

      equipesExport.get(equipe.id).lines.push(linePayload)
    }

    const equipesLista = Array.from(equipesExport.values()).sort((a, b) =>
      String(a.nome).localeCompare(String(b.nome), 'pt-BR'),
    )

    let totalJogadores = 0
    let totalLines = 0
    for (const eq of equipesLista) {
      totalLines += eq.lines.length
      for (const line of eq.lines) totalJogadores += line.quantidade_jogadores
    }

    const payload = {
      export_version: 1,
      exported_at: new Date().toISOString(),
      purpose: 'spec_jogo_e_producao',
      campeonato: {
        id: campeonato.id,
        nome: campeonato.nome,
        logo_url: campeonato.logo_url || null,
        banner_url: (campeonato as any).banner_url || null,
        status: campeonato.status || null,
        modalidade: (campeonato as any).modalidade || null,
        configuracao: {
          jogadores_por_vaga: config?.jogadores_por_vaga ?? null,
          cor_principal: config?.cor_principal ?? null,
          cor_secundaria: config?.cor_secundaria ?? null,
          bg_image_url: config?.bg_image_url ?? null,
        },
      },
      resumo: {
        total_equipes: equipesLista.length,
        total_lines: totalLines,
        total_jogadores: totalJogadores,
        total_midias: midias.length,
      },
      equipes: equipesLista,
      midias,
    }

    const format = new URL(req.url).searchParams.get('format') || 'json'
    if (format === 'download') {
      const slug = String(campeonato.nome || 'campeonato')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 48)
      const filename = `dropzone-export-${slug || campeonato.id}-${Date.now()}.json`
      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao exportar campeonato.'
    const status = message.toLowerCase().includes('autoriza') || message.toLowerCase().includes('token')
      ? 401
      : 400
    return NextResponse.json({ error: message }, { status })
  }
}
