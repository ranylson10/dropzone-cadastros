import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  inserirParticipacaoNoSlot,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const TOKEN_SELECT =
  'id,token,tipo,status,usado,expira_em,campeonato_id,grupo_id,fase_id,slot_id,vaga_id,nome_equipe_reservada,nome_line_reservada,equipe_id,line_destino_id'

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

  // Campeonato + slot (se houver) em paralelo
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

  // Grupo e vaga legada só se precisarem
  const [grupoRes, vagaRes] = await Promise.all([
    grupoId
      ? supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id').eq('id', grupoId).maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
    !slot && convite.vaga_id
      ? supabaseAdmin
          .from('campeonato_vagas')
          .select('id,status,numero_vaga,reservada_por_token_id,campeonato_id')
          .eq('id', convite.vaga_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
  ])
  if (grupoRes.error) throw grupoRes.error
  if (vagaRes.error) throw vagaRes.error

  return {
    convite,
    campeonato: campRes.data,
    slot,
    grupo: grupoRes.data,
    vaga: vagaRes.data,
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
    if (data.slot) {
      valido = valido && !data.slot.equipe_id && !data.slot.line_id
    } else if (data.vaga) {
      valido = valido && data.vaga.status === 'reservada'
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
      vaga: data.slot
        ? { numero_vaga: data.slot.slot_numero, letra: data.slot.slot_letra }
        : data.vaga
          ? { numero_vaga: data.vaga.numero_vaga }
          : null,
      modelo: {
        assento: data.slot ? 'slot' : data.vaga ? 'vaga_legado' : null,
      },
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
    const { convite, slot, vaga } = await carregar(token)

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

    if (slot) {
      if (slot.equipe_id || slot.line_id) throw new Error('Este slot já foi ocupado. Peça um novo convite.')
      participacao = await inserirParticipacaoNoSlot({
        campeonatoId: convite.campeonato_id,
        slotId: slot.id,
        lineId: resolved.id,
        equipeId: account.id,
        nomeExibicao: resolved.nome,
        origem: 'convite',
        criadoPor: user.id,
        vagaId: convite.vaga_id || null,
      })
      participacaoId = participacao.id
    } else if (vaga) {
      // Legado: tokens antigos sem slot_id
      if (vaga.status !== 'reservada' || vaga.reservada_por_token_id !== convite.id) {
        throw new Error('A vaga não está mais reservada para este convite.')
      }
      const { data: part, error: partError } = await supabaseAdmin
        .from('campeonato_equipes')
        .insert({
          campeonato_id: convite.campeonato_id,
          equipe_id: account.id,
          vaga_id: vaga.id,
          line_id: resolved.id,
          nome_exibicao: resolved.nome,
          origem_entrada: 'convite',
          criado_por: user.id,
          status: 'ativo',
        })
        .select('id,campeonato_id,equipe_id,line_id,vaga_id,nome_exibicao,status')
        .single()
      if (partError) throw partError
      participacao = part
      participacaoId = part.id

      const { data: vagaOk, error: vagaError } = await supabaseAdmin
        .from('campeonato_vagas')
        .update({
          status: 'ocupada',
          campeonato_equipe_id: part.id,
          ocupada_em: new Date().toISOString(),
        })
        .eq('id', vaga.id)
        .eq('status', 'reservada')
        .eq('reservada_por_token_id', convite.id)
        .select('id')
        .maybeSingle()
      if (vagaError || !vagaOk) {
        await softRemoveParticipacao(part.id)
        participacaoId = null
        throw new Error('A vaga foi alterada por outra operação. Atualize o convite e tente novamente.')
      }
    } else {
      throw new Error('Este convite não está vinculado a um slot nem a uma vaga válida.')
    }

    // Marca token usado (e falha se já foi usado em corrida)
    const { data: tokenUsed, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        status: 'usado',
        equipe_id: account.id,
        line_destino_id: resolved.id,
      })
      .eq('id', convite.id)
      .eq('usado', false)
      .select('id')
      .maybeSingle()
    if (tokenError) throw tokenError
    if (!tokenUsed) {
      // Corrida: outra aceitação ganhou — desfaz a part
      await softRemoveParticipacao(participacao.id)
      participacaoId = null
      throw new Error('Este convite já foi utilizado. Atualize a página.')
    }

    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolved.id, nome: resolved.nome, criada_agora: resolved.criada_agora },
      slot: slot ? { id: slot.id, letra: slot.slot_letra, numero: slot.slot_numero } : null,
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
