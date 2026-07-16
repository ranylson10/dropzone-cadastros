import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

type MidiaItem = {
  tipo: 'campeonato_logo' | 'equipe_logo' | 'line_logo' | 'jogador_foto'
  ref_id: string
  nome: string
  url: string
  zip_path: string
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

function slugPart(value: unknown, fallback = 'item') {
  const raw = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return raw || fallback
}

function extFromUrl(url: string) {
  try {
    const path = new URL(url).pathname
    const match = path.match(/\.(png|jpe?g|webp|gif|svg)$/i)
    if (match) return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`
  } catch {
    // ignore
  }
  return '.png'
}

/**
 * Pacote de dados do campeonato para SPEC / produção.
 * Query:
 *  - fase_id, grupo_id, line_id, equipe_id (filtros)
 *  - format=json|download
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

    const url = new URL(req.url)
    const faseId = String(url.searchParams.get('fase_id') || '').trim() || null
    const grupoId = String(url.searchParams.get('grupo_id') || '').trim() || null
    const lineId = String(url.searchParams.get('line_id') || '').trim() || null
    const equipeId = String(url.searchParams.get('equipe_id') || '').trim() || null

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

    const [
      { data: fasesRaw },
      { data: gruposAll },
      { data: participacoes, error: partError },
    ] = await Promise.all([
      supabaseAdmin
        .from('campeonato_fases')
        .select('id, nome, ordem')
        .eq('campeonato_id', id)
        .order('ordem', { ascending: true }),
      supabaseAdmin
        .from('campeonato_grupos')
        .select('id, nome, fase_id')
        .eq('campeonato_id', id)
        .order('nome', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('id, equipe_id, line_id, slot_id, grupo_id, slot_numero, nome_exibicao, status')
        .eq('campeonato_id', id)
        .eq('status', 'ativo')
        .order('slot_numero', { ascending: true }),
    ])

    if (campError) throw campError
    if (partError) throw partError
    if (!campeonato) {
      return NextResponse.json({ error: 'Campeonato não encontrado.' }, { status: 404 })
    }

    const fases = (fasesRaw || []).map((f) => ({
      id: f.id,
      nome: f.nome || 'Fase',
      ordem: Number(f.ordem || 0),
    }))
    const fasesMap = new Map(fases.map((f) => [f.id, f]))

    const gruposEstrutura = (gruposAll || []).map((g) => ({
      id: g.id,
      nome: g.nome || 'Grupo',
      fase_id: g.fase_id || null,
      fase_nome: g.fase_id ? (fasesMap.get(g.fase_id)?.nome || null) : null,
    }))
    const gruposMapAll = new Map(gruposEstrutura.map((g) => [g.id, g]))

    // Resolve grupo filter → fase, or fase filter → set of grupos
    let grupoIdsFiltro: Set<string> | null = null
    if (grupoId) {
      grupoIdsFiltro = new Set([grupoId])
    } else if (faseId) {
      grupoIdsFiltro = new Set(
        gruposEstrutura.filter((g) => g.fase_id === faseId).map((g) => g.id),
      )
    }

    let itens = participacoes || []
    if (grupoIdsFiltro) {
      itens = itens.filter((p) => p.grupo_id && grupoIdsFiltro!.has(p.grupo_id))
    }
    if (lineId) {
      itens = itens.filter((p) => p.line_id === lineId)
    }
    if (equipeId) {
      itens = itens.filter((p) => p.equipe_id === equipeId)
    }

    const escopo: 'campeonato' | 'fase' | 'grupo' | 'line' | 'equipe' = lineId
      ? 'line'
      : equipeId
        ? 'equipe'
        : grupoId
          ? 'grupo'
          : faseId
            ? 'fase'
            : 'campeonato'

    const equipeIds = [...new Set(itens.map((item) => item.equipe_id).filter(Boolean))]
    const lineIds = [...new Set(itens.map((item) => item.line_id).filter(Boolean))]
    const slotIds = [...new Set(itens.map((item) => item.slot_id).filter(Boolean))]
    const participacaoIds = itens.map((item) => item.id)

    const [
      { data: equipes },
      { data: lines },
      { data: slots },
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

    const midias: MidiaItem[] = []
    const pushMidia = (item: MidiaItem) => {
      const mediaUrl = String(item.url || '').trim()
      if (!mediaUrl) return
      if (midias.some((m) => m.url === mediaUrl && m.tipo === item.tipo)) return
      midias.push({ ...item, url: mediaUrl })
    }

    // Logo do campeonato só no escopo total (ou sempre útil no pacote)
    if (campeonato.logo_url && escopo === 'campeonato') {
      const name = slugPart(campeonato.nome, 'campeonato')
      pushMidia({
        tipo: 'campeonato_logo',
        ref_id: campeonato.id,
        nome: campeonato.nome,
        url: campeonato.logo_url,
        zip_path: `logos/campeonato/${name}${extFromUrl(campeonato.logo_url)}`,
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
          const name = slugPart(`${equipe.tag || ''}-${equipe.nome}`, equipe.id)
          pushMidia({
            tipo: 'equipe_logo',
            ref_id: equipe.id,
            nome: equipe.nome,
            url: equipe.logo_url,
            zip_path: `logos/equipes/${name}${extFromUrl(equipe.logo_url)}`,
          })
        }
      }

      const slot = part.slot_id ? slotsMap.get(part.slot_id) : null
      const grupoInfo = part.grupo_id ? gruposMapAll.get(part.grupo_id) : null

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

      const lineNome = line?.nome || part.nome_exibicao || 'Line'
      const equipeSlug = slugPart(equipe.nome, equipe.id)

      for (const jogador of jogadoresUnicos) {
        if (jogador.foto_url) {
          const nickSlug = slugPart(jogador.nick || jogador.id_jogo || jogador.id, 'jogador')
          pushMidia({
            tipo: 'jogador_foto',
            ref_id: String(jogador.jogador_id || jogador.id),
            nome: String(jogador.nick || 'Jogador'),
            url: jogador.foto_url,
            zip_path: `fotos/jogadores/${equipeSlug}/${nickSlug}${extFromUrl(jogador.foto_url)}`,
          })
        }
      }

      const linePayload = {
        participacao_id: part.id,
        id: line?.id || null,
        nome: lineNome,
        tag: line?.tag || null,
        logo_url: line?.logo_url || equipe.logo_url || null,
        nome_exibicao: part.nome_exibicao || lineNome || equipe.nome,
        slot: {
          id: part.slot_id || null,
          numero: Number(slot?.slot_numero || part.slot_numero || 0) || null,
          letra: slot?.slot_letra || null,
        },
        grupo: grupoInfo
          ? {
              id: grupoInfo.id,
              nome: grupoInfo.nome,
              fase_id: grupoInfo.fase_id,
              fase_nome: grupoInfo.fase_nome,
            }
          : part.grupo_id
            ? { id: part.grupo_id, nome: null, fase_id: null, fase_nome: null }
            : null,
        jogadores: jogadoresUnicos,
        quantidade_jogadores: jogadoresUnicos.length,
      }

      if (line?.logo_url) {
        const name = slugPart(`${equipe.nome}-${lineNome}`, line.id)
        pushMidia({
          tipo: 'line_logo',
          ref_id: line.id,
          nome: lineNome,
          url: line.logo_url,
          zip_path: `logos/lines/${name}${extFromUrl(line.logo_url)}`,
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
      export_version: 2,
      exported_at: new Date().toISOString(),
      purpose: 'spec_jogo_e_producao',
      filtro: {
        escopo,
        fase_id: faseId,
        grupo_id: grupoId,
        line_id: lineId,
        equipe_id: equipeId,
      },
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
      estrutura: {
        fases,
        grupos: gruposEstrutura,
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

    const format = url.searchParams.get('format') || 'json'
    if (format === 'download') {
      const slug = slugPart(campeonato.nome, campeonato.id)
      const filename = `dropzone-export-${slug}-${Date.now()}.json`
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
