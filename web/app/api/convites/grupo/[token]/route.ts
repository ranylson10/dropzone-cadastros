import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { parseLinkMetadata } from '@backend/shared/campeonato-link-metadata'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function loadLink(token: string) {
  const { data: link, error } = await supabaseAdmin
    .from('campeonato_links')
    .select('*')
    .eq('token', token)
    .eq('tipo', 'inscricao_equipes_grupo')
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('Link de equipes invalido ou inativo.')
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) throw new Error('Link de equipes expirado.')
  return link
}

async function sessionTeam(req: NextRequest, campeonatoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipe = accounts.find((account) => account.profile_type === 'equipe') || null
    if (!equipe) return { autenticado: true, equipe: null, lines: [] }
    const [{ data: lines }, { data: participacoes }] = await Promise.all([
      supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url,status').eq('equipe_id', equipe.id).neq('status', 'inativo').order('created_at'),
      supabaseAdmin.from('campeonato_equipes').select('line_id,status').eq('campeonato_id', campeonatoId).eq('equipe_id', equipe.id).eq('status', 'ativo'),
    ])
    const used = new Set((participacoes || []).map((item) => item.line_id).filter(Boolean))
    return {
      autenticado: true,
      equipe: { id: equipe.id, nome: equipe.name, tag: equipe.data?.tag || null, logo_url: equipe.data?.logo_url || null },
      lines: (lines || []).map((line) => ({ ...line, ja_inscrita: used.has(line.id) })),
    }
  } catch {
    return { autenticado: false, equipe: null, lines: [] }
  }
}

async function payloadFor(req: NextRequest, token: string) {
  const link = await loadLink(token)
  const expected = parseLinkMetadata(link).expected_teams
  const [{ data: campeonato }, { data: grupo }, { data: slots }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').eq('id', link.campeonato_id).single(),
    supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).single(),
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,slot_numero,slot_letra,equipe_id,line_id,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)')
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .order('slot_numero'),
  ])
  const session = await sessionTeam(req, link.campeonato_id)
  const vagas = expected.map((nome: string, index: number) => {
    const slot = (slots || [])[index]
    const line = Array.isArray(slot?.equipe_lines) ? slot.equipe_lines[0] : slot?.equipe_lines
    const team = Array.isArray(slot?.equipes) ? slot.equipes[0] : slot?.equipes
    return {
      index,
      nome,
      slot_id: slot?.id || null,
      slot_numero: slot?.slot_numero || index + 1,
      slot_letra: slot?.slot_letra || null,
      ocupada: Boolean(slot?.equipe_id),
      equipe_nome: team?.nome || null,
      line_nome: line?.nome || null,
      logo_url: line?.logo_url || team?.logo_url || null,
    }
  })
  return { link: { token: link.token, titulo: link.titulo }, campeonato, grupo, vagas, ...session }
}

function isMissingLegacyVagas(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code || '') || message.includes('campeonato_vagas') || message.includes('vaga_id')
}

async function findLegacyVaga(link: any, slotNumero: number) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_vagas')
    .select('id,status')
    .eq('campeonato_id', link.campeonato_id)
    .eq('numero_vaga', slotNumero)
    .maybeSingle()
  if (error) {
    if (isMissingLegacyVagas(error)) return null
    throw error
  }
  return data || null
}

async function updateLegacyVaga(vagaId: string | null, participacaoId: string, tokenId?: string | null) {
  if (!vagaId) return
  const { error } = await supabaseAdmin
    .from('campeonato_vagas')
    .update({
      status: 'ocupada',
      campeonato_equipe_id: participacaoId,
      ocupada_em: new Date().toISOString(),
      reservada_por_token_id: tokenId || null,
    })
    .eq('id', vagaId)
  if (error && !isMissingLegacyVagas(error)) throw error
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    return NextResponse.json(await payloadFor(req, token))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Convite invalido.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'equipe')
    if (!account) throw new Error('Este login ainda nao possui um perfil de equipe vinculado.')

    const body = await req.json().catch(() => ({}))
    const vagaIndex = Number(body.vaga_index)
    const lineIdInformada = String(body.line_id || '').trim()
    const nomeNovaLine = String(body.nome_line || '').trim()
    const link = await loadLink(token)
    const expected = parseLinkMetadata(link).expected_teams
    if (!Number.isInteger(vagaIndex) || vagaIndex < 0 || vagaIndex >= expected.length) throw new Error('Selecione uma vaga esperada.')

    const { data: slot } = await supabaseAdmin
      .from('campeonato_slots')
      .select('*')
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .eq('slot_numero', vagaIndex + 1)
      .maybeSingle()
    if (!slot) throw new Error('Slot do grupo nao encontrado.')
    if (slot.equipe_id) throw new Error('Essa vaga ja foi preenchida.')

    let lineId = lineIdInformada || null
    let lineName = ''
    if (lineId) {
      const { data: line } = await supabaseAdmin.from('equipe_lines').select('id,nome').eq('id', lineId).eq('equipe_id', account.id).single()
      if (!line) throw new Error('A line selecionada nao pertence a sua equipe.')
      lineName = line.nome
    } else {
      if (!nomeNovaLine) throw new Error('Selecione uma line ou informe uma nova.')
      const { data: created, error } = await supabaseAdmin.from('equipe_lines').insert({
        equipe_id: account.id,
        nome: nomeNovaLine,
        tag: account.data?.tag || null,
        logo_url: account.data?.logo_url || null,
        status: 'ativo',
      }).select('id,nome').single()
      if (error) throw error
      lineId = created.id
      lineName = created.nome
    }

    const { data: duplicate } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', link.campeonato_id)
      .eq('line_id', lineId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (duplicate) throw new Error('Esta line ja esta inscrita neste campeonato.')

    const legacyVaga = await findLegacyVaga(link, Number(slot.slot_numero))

    const { data: updatedSlot, error: slotError } = await supabaseAdmin
      .from('campeonato_slots')
      .update({ equipe_id: account.id, line_id: lineId, status: 'ocupado', updated_at: new Date().toISOString() })
      .eq('id', slot.id)
      .is('equipe_id', null)
      .select('id')
      .maybeSingle()
    if (slotError || !updatedSlot) {
      throw new Error('A vaga foi preenchida por outra equipe. Atualize e tente novamente.')
    }

    const participationPayload: Record<string, unknown> = {
      campeonato_id: link.campeonato_id,
      equipe_id: account.id,
      vaga_id: legacyVaga?.id || null,
      grupo_id: link.grupo_id,
      slot_numero: slot.slot_numero,
      line_id: lineId,
      nome_exibicao: lineName,
      origem_entrada: 'link',
      criado_por: user.id,
      status: 'ativo',
    }

    let { data: participacao, error: partError } = await supabaseAdmin.from('campeonato_equipes').insert(participationPayload).select('*').single()
    if (partError && isMissingLegacyVagas(partError)) {
      const { vaga_id: _vagaId, ...fallbackPayload } = participationPayload
      const retry = await supabaseAdmin.from('campeonato_equipes').insert(fallbackPayload).select('*').single()
      participacao = retry.data
      partError = retry.error
    }
    if (partError || !participacao) {
      await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre', updated_at: new Date().toISOString() }).eq('id', slot.id).eq('equipe_id', account.id).eq('line_id', lineId)
      throw partError || new Error('Nao foi possivel salvar a equipe no campeonato.')
    }

    await updateLegacyVaga(legacyVaga?.id || null, participacao.id, link.id)

    return NextResponse.json({ ok: true, participacao, equipe: { id: account.id, nome: account.name }, line: { id: lineId, nome: lineName }, referencia: expected[vagaIndex] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao entrar no grupo.' }, { status: 400 })
  }
}
