import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function carregar(token: string) {
  const { data: convite } = await supabaseAdmin
    .from('tokens')
    .select('*')
    .eq('token', token)
    .eq('tipo', 'convite_equipe_campeonato')
    .maybeSingle()

  if (!convite) throw new Error('Convite não encontrado.')

  const [{ data: campeonato }, { data: vaga }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id, nome, logo_url').eq('id', convite.campeonato_id).single(),
    supabaseAdmin.from('campeonato_vagas').select('*').eq('id', convite.vaga_id).single(),
  ])

  return { convite, campeonato, vaga }
}

async function carregarEquipeDoLogin(req: NextRequest, campeonatoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipe = accounts.find((account) => account.profile_type === 'equipe') || null
    if (!equipe) return { autenticado: true, equipe: null, lines: [] }

    const [{ data: lines }, { data: participacoes }] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id, nome, tag, logo_url, status')
        .eq('equipe_id', equipe.id)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('line_id, vaga_id, status')
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', equipe.id)
        .eq('status', 'ativo'),
    ])

    const usadas = new Set((participacoes || []).map((item) => item.line_id).filter(Boolean))
    return {
      autenticado: true,
      equipe: {
        id: equipe.id,
        nome: equipe.name,
        tag: equipe.data?.tag || null,
        logo_url: equipe.data?.logo_url || null,
      },
      lines: (lines || []).map((line) => ({ ...line, ja_inscrita: usadas.has(line.id) })),
    }
  } catch {
    return { autenticado: false, equipe: null, lines: [] }
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const data = await carregar(token)
    const expirado = !data.convite.expira_em || new Date(data.convite.expira_em).getTime() <= Date.now()
    const sessao = await carregarEquipeDoLogin(req, data.convite.campeonato_id)

    return NextResponse.json({
      ...data,
      ...sessao,
      valido:
        data.convite.status === 'ativo' &&
        !data.convite.usado &&
        !expirado &&
        data.vaga.status === 'reservada',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Convite inválido.' },
      { status: 404 },
    )
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'equipe')
    if (!account) throw new Error('Este login ainda não possui um perfil de equipe vinculado.')

    const body = await req.json().catch(() => ({}))
    const lineIdInformada = String(body.line_id || '').trim()
    const nomeNovaLine = String(body.nome_line || '').trim()

    const { convite, vaga } = await carregar(token)
    if (
      convite.status !== 'ativo' ||
      convite.usado ||
      !convite.expira_em ||
      new Date(convite.expira_em).getTime() <= Date.now()
    ) {
      throw new Error('Este convite expirou ou já foi utilizado.')
    }

    if (vaga.status !== 'reservada' || vaga.reservada_por_token_id !== convite.id) {
      throw new Error('A vaga não está mais reservada para este convite.')
    }

    let lineId = lineIdInformada || null
    let nomeLineReal = ''

    if (lineId) {
      const { data: line } = await supabaseAdmin
        .from('equipe_lines')
        .select('id, nome')
        .eq('id', lineId)
        .eq('equipe_id', account.id)
        .single()
      if (!line) throw new Error('A line selecionada não pertence à sua equipe.')
      nomeLineReal = line.nome
    } else {
      if (!nomeNovaLine) throw new Error('Selecione uma line ou informe o nome de uma nova line.')
      const { data: nova, error } = await supabaseAdmin
        .from('equipe_lines')
        .insert({
          equipe_id: account.id,
          nome: nomeNovaLine,
          tag: account.data?.tag || null,
          logo_url: account.data?.logo_url || null,
          status: 'ativo',
        })
        .select('id, nome')
        .single()
      if (error) throw error
      lineId = nova.id
      nomeLineReal = nova.nome
    }

    const { data: duplicada } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', convite.campeonato_id)
      .eq('line_id', lineId)
      .eq('status', 'ativo')
      .maybeSingle()

    if (duplicada) throw new Error('Esta line já está inscrita neste campeonato. Escolha ou crie outra.')

    const { data: participacao, error: partError } = await supabaseAdmin
      .from('campeonato_equipes')
      .insert({
        campeonato_id: convite.campeonato_id,
        equipe_id: account.id,
        vaga_id: vaga.id,
        line_id: lineId,
        nome_exibicao: nomeLineReal,
        // Constraint real: organizador | convite | inscricao
        origem_entrada: 'convite',
        criado_por: user.id,
        status: 'ativo',
      })
      .select('*')
      .single()

    if (partError) throw partError

    const { data: vagaAtualizada, error: vagaError } = await supabaseAdmin
      .from('campeonato_vagas')
      .update({
        status: 'ocupada',
        campeonato_equipe_id: participacao.id,
        ocupada_em: new Date().toISOString(),
      })
      .eq('id', vaga.id)
      .eq('status', 'reservada')
      .eq('reservada_por_token_id', convite.id)
      .select('id')
      .maybeSingle()

    if (vagaError || !vagaAtualizada) {
      await supabaseAdmin.from('campeonato_equipes').delete().eq('id', participacao.id)
      throw new Error('A vaga foi alterada por outra operação. Atualize o convite e tente novamente.')
    }

    await supabaseAdmin
      .from('tokens')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        status: 'usado',
        equipe_id: account.id,
        line_destino_id: lineId,
      })
      .eq('id', convite.id)
      .eq('usado', false)

    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: lineId, nome: nomeLineReal },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao aceitar convite.' },
      { status: 400 },
    )
  }
}
