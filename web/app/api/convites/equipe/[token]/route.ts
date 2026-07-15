import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
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

  if (!error && rows) {
    return rows.map((row: any, index: number) => {
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
      }
    })
  }

  // Fallback sem view
  const { data: slots, error: slotsError } = await supabaseAdmin
    .from('campeonato_slots')
    .select('id,slot_numero,slot_letra,equipe_id,line_id')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .order('slot_numero', { ascending: true })
  if (slotsError) throw slotsError

  return (slots || []).map((slot: any, index: number) => {
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
    }
  })
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

  const [campRes, slotRes] = await Promise.all([
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
  ])
  if (campRes.error) throw campRes.error
  if (slotRes.error) throw slotRes.error

  const slot = slotRes.data
  const grupoId = slot?.grupo_id || convite.grupo_id || null
  const modoGrupo = Boolean(grupoId && !convite.slot_id)

  const [grupoRes, vagas] = await Promise.all([
    grupoId
      ? supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id').eq('id', grupoId).maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
    modoGrupo && grupoId
      ? loadGrupoVagas(convite.campeonato_id, grupoId)
      : Promise.resolve([] as any[]),
  ])
  if (grupoRes.error) throw grupoRes.error

  return {
    convite,
    campeonato: campRes.data,
    slot,
    grupo: grupoRes.data,
    vagas,
    modoGrupo,
  }
}

async function carregarEquipeDoLogin(req: NextRequest, campeonatoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipe = accounts.find((account) => account.profile_type === 'equipe') || null
    if (!equipe) {
      return { autenticado: true, equipe: null, lines: [] as any[], lines_disponiveis: [] as any[] }
    }

    const [{ data: lines }, { data: participacoes }] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,tag,logo_url,status')
        .eq('equipe_id', equipe.id)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('line_id')
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', equipe.id)
        .eq('status', 'ativo'),
    ])

    const usadas = new Set((participacoes || []).map((item) => item.line_id).filter(Boolean))
    const mapped = (lines || []).map((line) => ({
      ...line,
      logo_url: line.logo_url || equipe.data?.logo_url || null,
      ja_inscrita: usadas.has(line.id),
    }))

    return {
      autenticado: true,
      equipe: {
        id: equipe.id,
        nome: equipe.name,
        tag: equipe.data?.tag || null,
        logo_url: equipe.data?.logo_url || null,
      },
      lines: mapped,
      lines_disponiveis: mapped.filter((l) => !l.ja_inscrita),
    }
  } catch {
    return { autenticado: false, equipe: null, lines: [], lines_disponiveis: [] }
  }
}

function conviteAindaValido(convite: any) {
  if (convite.status !== 'ativo' || convite.usado) return false
  if (convite.expira_em && new Date(convite.expira_em).getTime() <= Date.now()) return false
  return true
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const data = await carregar(token)
    const sessao = await carregarEquipeDoLogin(req, data.convite.campeonato_id)
    const validoBase = conviteAindaValido(data.convite)

    let valido = validoBase
    let assento: 'slot' | 'grupo' | null = null

    if (data.slot) {
      assento = 'slot'
      valido = valido && !data.slot.equipe_id && !data.slot.line_id
    } else if (data.modoGrupo) {
      assento = 'grupo'
      const livres = (data.vagas || []).filter((v: any) => !v.ocupada).length
      valido = valido && livres > 0
    } else {
      valido = false
    }

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
      resumo_grupo: data.modoGrupo
        ? {
            total: data.vagas.length,
            ocupadas: data.vagas.filter((v: any) => v.ocupada).length,
            livres: data.vagas.filter((v: any) => !v.ocupada).length,
          }
        : null,
      vaga: data.slot
        ? { numero_vaga: data.slot.slot_numero, letra: data.slot.slot_letra }
        : null,
      modelo: { assento, vaga_fisica: 'slot' },
      ...sessao,
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
    const account = accounts.find((item) => item.profile_type === 'equipe')
    if (!account) throw new Error('Este login ainda não possui um perfil de equipe vinculado.')

    const body = await req.json().catch(() => ({}))
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
      if (slotFixo.equipe_id || slotFixo.line_id) throw new Error('Este slot já foi ocupado. Peça um novo convite.')
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
      const slotIdEscolhido = String(body.slot_id || '').trim()
      if (!slotIdEscolhido) throw new Error('Escolha um slot livre do grupo para entrar.')

      const { data: slotEscolhido, error: slotError } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
        .eq('id', slotIdEscolhido)
        .eq('campeonato_id', convite.campeonato_id)
        .eq('grupo_id', convite.grupo_id)
        .maybeSingle()
      if (slotError) throw slotError
      if (!slotEscolhido) throw new Error('Slot não pertence a este grupo do convite.')
      if (slotEscolhido.equipe_id || slotEscolhido.line_id) {
        throw new Error('Esse slot já foi preenchido. Escolha outra letra.')
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

    const { data: tokenUsed, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        status: 'usado',
        equipe_id: account.id,
        line_destino_id: resolved.id,
        // grava o slot escolhido no token (modo grupo)
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
