import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import {
  inserirParticipacaoNoSlot,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const TOKEN_SELECT =
  'id,token,tipo,status,usado,expira_em,campeonato_id,grupo_id,fase_id,slot_id,nome_equipe_reservada,nome_line_reservada,equipe_id,line_destino_id'

async function loadGrupoVagas(campeonatoId: string, grupoId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from('vw_campeonato_slots_lines')
    .select(
      'slot_id,slot_numero,slot_letra,status_ui,line_id,equipe_id,line_nome,line_logo_url,equipe_nome,nome_exibicao,participacao_id',
    )
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .order('slot_numero', { ascending: true })

  let vagas: any[] = []
  if (!error && rows) {
    vagas = rows.map((row: any, index: number) => {
      const ocupada = String(row.status_ui || '') === 'ocupada' || Boolean(row.participacao_id || row.line_id)
      const letra = String(row.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)
      return {
        index,
        slot_id: row.slot_id,
        slot_numero: row.slot_numero ?? index + 1,
        slot_letra: letra,
        ocupada,
        equipe_nome: row.equipe_nome || null,
        line_nome: row.line_nome || row.nome_exibicao || null,
        logo_url: row.line_logo_url || null,
        campeonato_equipe_id: row.participacao_id || null,
      }
    })
  } else {
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,slot_numero,slot_letra,equipe_id,line_id')
      .eq('campeonato_id', campeonatoId)
      .eq('grupo_id', grupoId)
      .order('slot_numero', { ascending: true })
    if (slotsError) throw slotsError

    vagas = (slots || []).map((slot: any, index: number) => {
      const ocupada = Boolean(slot.equipe_id || slot.line_id)
      const letra = String(slot.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)
      return {
        index,
        slot_id: slot.id,
        slot_numero: slot.slot_numero || index + 1,
        slot_letra: letra,
        ocupada,
        equipe_nome: null,
        line_nome: null,
        logo_url: null,
        campeonato_equipe_id: null,
      }
    })
  }

  // Jogadores públicos por participação
  const partIds = vagas.map((v) => v.campeonato_equipe_id).filter(Boolean)
  if (partIds.length) {
    const { data: jogadores } = await supabaseAdmin
      .from('campeonato_jogadores')
      .select('id,campeonato_equipe_id,nick,foto_url,id_jogo,funcao,status,slot_numero')
      .in('campeonato_equipe_id', partIds)
      .eq('status', 'ativo')
      .order('slot_numero', { ascending: true })
    const byPart = new Map<string, any[]>()
    for (const player of jogadores || []) {
      const key = String(player.campeonato_equipe_id)
      const list = byPart.get(key) || []
      list.push(player)
      byPart.set(key, list)
    }
    vagas = vagas.map((vaga) => {
      const players = vaga.campeonato_equipe_id ? byPart.get(String(vaga.campeonato_equipe_id)) || [] : []
      return { ...vaga, jogadores: players, quantidade_jogadores: players.length }
    })
  } else {
    vagas = vagas.map((vaga) => ({ ...vaga, jogadores: [], quantidade_jogadores: 0 }))
  }

  return vagas
}

async function carregar(token: string) {
  const clean = decodeURIComponent(String(token || '').trim())
  const { data: convite, error } = await supabaseAdmin
    .from('tokens')
    .select(TOKEN_SELECT)
    .eq('token', clean)
    .eq('tipo', 'convite_equipe_campeonato')
    .maybeSingle()
  if (error) throw error
  if (!convite) throw new Error('Convite não encontrado.')

  const [campRes, slotRes, temaRes] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url')
      .eq('id', convite.campeonato_id)
      .maybeSingle(),
    convite.slot_id
      ? supabaseAdmin
          .from('campeonato_slots')
          .select('id,slot_numero,slot_letra,equipe_id,line_id,status,grupo_id,fase_id,campeonato_id')
          .eq('id', convite.slot_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('cor_principal,cor_secundaria,cor_texto_clara,cor_texto_escura')
      .eq('campeonato_id', convite.campeonato_id)
      .maybeSingle(),
  ])
  if (campRes.error) throw campRes.error
  if (slotRes.error) throw slotRes.error

  const slot = slotRes.data
  const grupoId = slot?.grupo_id || convite.grupo_id || null
  const modoGrupo = Boolean(grupoId && !convite.slot_id)
  const temaRow = temaRes.error ? null : temaRes.data

  const [grupoRes, vagas] = await Promise.all([
    grupoId
      ? supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id').eq('id', grupoId).maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
    grupoId ? loadGrupoVagas(convite.campeonato_id, grupoId) : Promise.resolve([] as any[]),
  ])
  if (grupoRes.error) throw grupoRes.error

  return {
    convite,
    campeonato: campRes.data,
    tema: {
      cor_principal: temaRow?.cor_principal || '#ff4655',
      cor_secundaria: temaRow?.cor_secundaria || '#17191d',
      cor_texto_clara: temaRow?.cor_texto_clara || '#ffffff',
      cor_texto_escura: temaRow?.cor_texto_escura || '#17191d',
    },
    slot,
    grupo: grupoRes.data,
    vagas,
    modoGrupo,
    grupoId,
  }
}

async function carregarEquipeDoLogin(req: NextRequest, campeonatoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const controllable = await listControllableEquipes(user.id, accounts)
    const preferredEquipeId = String(req.nextUrl.searchParams.get('equipe_id') || '').trim()
    const hasManager = accounts.some((a) => a.profile_type === 'manager')
    const selected =
      (preferredEquipeId && controllable.find((e) => e.id === preferredEquipeId))
      || (controllable.length === 1 ? controllable[0] : null)

    if (!selected) {
      return {
        autenticado: true,
        equipe: null,
        papel_sessao: hasManager ? 'manager' : null,
        equipes_disponiveis: controllable.map((e) => ({
          id: e.id,
          nome: e.nome,
          username: e.username,
          logo_url: e.logo_url,
          tag: e.tag,
          papel: e.papel,
        })),
        lines: [] as any[],
        lines_disponiveis: [] as any[],
      }
    }

    const [{ data: lines }, { data: participacoes }] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,tag,logo_url,status')
        .eq('equipe_id', selected.id)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('line_id')
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', selected.id)
        .eq('status', 'ativo'),
    ])

    const usadas = new Set((participacoes || []).map((item) => item.line_id).filter(Boolean))
    const mapped = (lines || []).map((line) => ({
      ...line,
      logo_url: line.logo_url || selected.logo_url || null,
      ja_inscrita: usadas.has(line.id),
    }))
    const livres = mapped.filter((l) => !l.ja_inscrita)

    return {
      autenticado: true,
      papel_sessao: hasManager ? 'manager' : 'equipe',
      equipes_disponiveis: controllable.map((e) => ({
        id: e.id,
        nome: e.nome,
        username: e.username,
        logo_url: e.logo_url,
        tag: e.tag,
        papel: e.papel,
      })),
      equipe: {
        id: selected.id,
        nome: selected.nome,
        tag: selected.tag || null,
        logo_url: selected.logo_url || null,
        papel: selected.papel,
      },
      // Só lines livres — evita opções inválidas
      lines: livres,
      lines_disponiveis: livres,
    }
  } catch {
    return { autenticado: false, equipe: null, equipes_disponiveis: [], lines: [], lines_disponiveis: [] }
  }
}

function conviteAindaValido(convite: any) {
  if (convite.status !== 'ativo' || convite.usado) return false
  if (convite.expira_em && new Date(convite.expira_em).getTime() <= Date.now()) return false
  return true
}

function statusMensagem(params: {
  validoBase: boolean
  valido: boolean
  convite: any
  slotOcupado: boolean
  livres: number
}) {
  if (params.valido) return null
  if (params.convite.usado || params.convite.status === 'usado') {
    return 'Este convite já foi utilizado. Você ainda pode acompanhar o grupo.'
  }
  if (params.convite.expira_em && new Date(params.convite.expira_em).getTime() <= Date.now()) {
    return 'Este convite expirou. Você ainda pode acompanhar o grupo.'
  }
  if (params.slotOcupado) {
    return 'O slot deste convite já está ocupado. Você ainda pode acompanhar o grupo.'
  }
  if (params.livres <= 0) {
    return 'Não há slots livres neste grupo no momento.'
  }
  if (params.convite.status !== 'ativo') {
    return 'Este convite não está mais ativo. Você ainda pode acompanhar o grupo.'
  }
  return 'Este convite não aceita novas inscrições no momento.'
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const data = await carregar(token)
    const sessao = await carregarEquipeDoLogin(req, data.convite.campeonato_id)
    const validoBase = conviteAindaValido(data.convite)

    let valido = validoBase
    let assento: 'slot' | 'grupo' | null = null
    let slotOcupado = false
    let livres = 0

    if (data.slot) {
      assento = 'slot'
      slotOcupado = Boolean(data.slot.equipe_id || data.slot.line_id)
      valido = valido && !slotOcupado
      livres = slotOcupado ? 0 : 1
    } else if (data.modoGrupo) {
      assento = 'grupo'
      livres = (data.vagas || []).filter((v: any) => !v.ocupada).length
      valido = valido && livres > 0
    } else {
      valido = false
    }

    const inscricaoAberta = valido
    const mensagem = statusMensagem({
      validoBase,
      valido,
      convite: data.convite,
      slotOcupado,
      livres,
    })

    return NextResponse.json({
      convite: {
        id: data.convite.id,
        token: data.convite.token,
        nome_equipe_reservada: data.convite.nome_equipe_reservada,
        nome_line_reservada: data.convite.nome_line_reservada,
        expira_em: data.convite.expira_em,
        status: data.convite.status,
        usado: data.convite.usado,
        slot_id: data.convite.slot_id || null,
        grupo_id: data.convite.grupo_id || data.grupo?.id || null,
      },
      campeonato: data.campeonato,
      tema: data.tema,
      slot: data.slot
        ? {
            id: data.slot.id,
            letra: data.slot.slot_letra,
            numero: data.slot.slot_numero,
            grupo_id: data.slot.grupo_id,
          }
        : null,
      grupo: data.grupo,
      vagas: data.vagas || [],
      resumo_grupo: data.grupoId
        ? {
            total: data.vagas.length,
            ocupadas: data.vagas.filter((v: any) => v.ocupada).length,
            livres: data.vagas.filter((v: any) => !v.ocupada).length,
          }
        : null,
      vaga: data.slot
        ? { numero_vaga: data.slot.slot_numero, letra: data.slot.slot_letra }
        : null,
      modelo: { assento, vaga_fisica: 'slot', auto_slot: true },
      modo: inscricaoAberta ? 'inscricao' : 'acompanhamento',
      inscricao_aberta: inscricaoAberta,
      status_mensagem: mensagem,
      ...sessao,
      // lines no response já filtradas
      lines: sessao.lines_disponiveis || sessao.lines || [],
      valido,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Convite inválido.' },
      { status: 404 },
    )
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  let participacaoId: string | null = null
  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))
    const controllable = await listControllableEquipes(user.id, accounts)
    if (!controllable.length) {
      throw new Error('Este login não controla nenhuma equipe. Crie ou aceite um convite de staff primeiro.')
    }
    const equipeIdInformada = String(body.equipe_id || '').trim()
    const selectedTeam = equipeIdInformada
      ? controllable.find((e) => e.id === equipeIdInformada)
      : controllable.length === 1
        ? controllable[0]
        : null
    if (!selectedTeam) throw new Error('Selecione com qual equipe deseja entrar neste campeonato.')
    const account = {
      id: selectedTeam.id,
      name: selectedTeam.nome,
      data: { tag: selectedTeam.tag, logo_url: selectedTeam.logo_url },
    }

    const { convite, slot: slotFixo, modoGrupo, grupo } = await carregar(token)

    if (!conviteAindaValido(convite)) {
      throw new Error('Este convite expirou ou já foi utilizado.')
    }

    const resolved = await resolveLineForInscricao({
      equipeId: account.id,
      campeonatoId: convite.campeonato_id,
      lineId: body.line_id ? String(body.line_id) : null,
      nomeLine: String(body.nome_line || '').trim() || null,
      tag: account.data?.tag || null,
      logoUrl: account.data?.logo_url || null,
    })

    let participacao: any
    let slotUsado: any = slotFixo

    if (slotFixo) {
      if (slotFixo.equipe_id || slotFixo.line_id) {
        throw new Error('Este slot já foi ocupado. Peça um novo convite.')
      }
      participacao = await inserirParticipacaoNoSlot({
        campeonatoId: convite.campeonato_id,
        slotId: slotFixo.id,
        lineId: resolved.id,
        equipeId: account.id,
        nomeExibicao: resolved.nome,
        origem: 'convite',
        criadoPor: user.id,
      })
      participacaoId = participacao.id
    } else if (modoGrupo) {
      // Auto-slot: usa slot informado ou o primeiro livre (espelho + participações)
      const slotIdInformado = String(body.slot_id || '').trim()
      const [{ data: slots, error: slotsError }, { data: partsAtivas, error: partsErr }] =
        await Promise.all([
          supabaseAdmin
            .from('campeonato_slots')
            .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
            .eq('campeonato_id', convite.campeonato_id)
            .eq('grupo_id', convite.grupo_id)
            .order('slot_numero', { ascending: true }),
          supabaseAdmin
            .from('campeonato_equipes')
            .select('slot_id,slot_numero')
            .eq('campeonato_id', convite.campeonato_id)
            .eq('grupo_id', convite.grupo_id)
            .eq('status', 'ativo'),
        ])
      if (slotsError) throw slotsError
      if (partsErr) throw partsErr

      const occupiedIds = new Set((partsAtivas || []).map((p) => p.slot_id).filter(Boolean).map(String))
      const occupiedNums = new Set(
        (partsAtivas || [])
          .map((p) => (p.slot_numero != null ? Number(p.slot_numero) : null))
          .filter((n) => n != null && Number.isFinite(n)),
      )
      const isFree = (s: any) =>
        !s.equipe_id
        && !s.line_id
        && !occupiedIds.has(String(s.id))
        && !occupiedNums.has(Number(s.slot_numero))

      let slotEscolhido =
        (slotIdInformado && (slots || []).find((s) => s.id === slotIdInformado)) ||
        (slots || []).find((s) => isFree(s)) ||
        null

      if (!slotEscolhido) throw new Error('Nenhum slot livre neste grupo no momento.')
      if (!isFree(slotEscolhido)) {
        throw new Error('Esse slot já foi preenchido. Tente novamente.')
      }

      participacao = await inserirParticipacaoNoSlot({
        campeonatoId: convite.campeonato_id,
        slotId: slotEscolhido.id,
        lineId: resolved.id,
        equipeId: account.id,
        nomeExibicao: resolved.nome,
        origem: 'convite',
        criadoPor: user.id,
      })
      participacaoId = participacao.id
      slotUsado = slotEscolhido
    } else {
      throw new Error('Este convite não está vinculado a um slot ou grupo válido.')
    }

    // Marca token como usado de forma condicional (atômico no nível do flag usado)
    const { data: tokenUsed, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        status: 'usado',
        equipe_id: account.id,
        line_destino_id: resolved.id,
        ...(slotUsado?.id ? { slot_id: slotUsado.id } : {}),
      })
      .eq('id', convite.id)
      .eq('usado', false)
      .select('id')
      .maybeSingle()
    if (tokenError) throw tokenError
    if (!tokenUsed) {
      await softRemoveParticipacao(participacao.id)
      participacaoId = null
      throw new Error('Este convite já foi utilizado. Atualize a página.')
    }

    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolved.id, nome: resolved.nome, criada_agora: resolved.criada_agora },
      grupo: grupo ? { id: grupo.id, nome: grupo.nome } : null,
      slot: slotUsado
        ? { id: slotUsado.id, letra: slotUsado.slot_letra, numero: slotUsado.slot_numero }
        : null,
      slot_letra: slotUsado?.slot_letra || null,
      mensagem: resolved.criada_agora
        ? `Line "${resolved.nome}" criada e inscrita.`
        : `Line "${resolved.nome}" inscrita.`,
    })
  } catch (error) {
    if (participacaoId) {
      try {
        await softRemoveParticipacao(participacaoId)
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao aceitar convite.' },
      { status: 400 },
    )
  }
}
