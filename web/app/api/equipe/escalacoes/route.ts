import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function novoToken() {
  return randomBytes(18).toString('base64url')
}

function validFutureDate(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null
  return date.toISOString()
}

function defaultExpiration() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

async function managedTeamIds(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('equipes')
    .select('id')
    .or(`auth_user_id.eq.${userId},dono_auth_user_id.eq.${userId}`)
  if (error) throw error
  return (data || []).map((row: any) => row.id)
}

async function requireManagedParticipation(id: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,campeonato_id,line_id,grupo_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Participação não encontrada.')
  const ids = await managedTeamIds(userId)
  if (!ids.includes(data.equipe_id)) throw new Error('Você não pode gerenciar esta escalação.')
  return data
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const teamIds = await managedTeamIds(user.id)
    if (teamIds.length === 0) return NextResponse.json({ escalacoes: [] })

    const { data: summaries, error } = await supabaseAdmin
      .from('campeonato_escalacoes_resumo')
      .select('*')
      .in('equipe_id', teamIds)
      .order('campeonato_nome')
    if (error) throw error

    const participationIds = (summaries || []).map((row: any) => row.campeonato_equipe_id)
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('equipes')
      .select('id,nome,tag,logo_url')
      .in('id', teamIds)
    if (teamsError) throw teamsError
    let players: any[] = []
    if (participationIds.length) {
      const result = await supabaseAdmin
        .from('campeonato_jogadores')
        .select('id,campeonato_equipe_id,jogador_id,nick,foto_url,id_jogo,funcao,status,slot_numero,capitao,created_at')
        .in('campeonato_equipe_id', participationIds)
        .eq('status', 'ativo')
        .order('slot_numero')
      if (result.error) throw result.error
      players = result.data || []
    }
    let links: any[] = []
    if (participationIds.length) {
      const result = await supabaseAdmin
        .from('campeonato_links_inscricao')
        .select('id,campeonato_equipe_id,token,ativo,expira_em,limite_jogadores,created_at')
        .in('campeonato_equipe_id', participationIds)
        .eq('tipo', 'escalacao_line')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
      if (result.error) throw result.error
      const now = Date.now()
      links = (result.data || []).filter((link: any) => !link.expira_em || new Date(link.expira_em).getTime() > now)
    }
    const linksByParticipation = new Map<string, any>()
    for (const link of links) {
      if (!linksByParticipation.has(link.campeonato_equipe_id)) linksByParticipation.set(link.campeonato_equipe_id, link)
    }

    return NextResponse.json({
      escalacoes: (summaries || []).map((summary: any) => {
        const link = linksByParticipation.get(summary.campeonato_equipe_id)
        return {
          ...summary,
          link_id: link?.id || summary.link_id || null,
          link_token: link?.token || summary.link_token || null,
          link_ativo: link ? true : summary.link_ativo || false,
          link_expira_em: link?.expira_em || summary.link_expira_em || null,
          limite_jogadores: Number(link?.limite_jogadores || summary.limite_jogadores || 6),
          equipe_nome: (teams || []).find((team: any) => team.id === summary.equipe_id)?.nome || 'Equipe',
          equipe_tag: (teams || []).find((team: any) => team.id === summary.equipe_id)?.tag || null,
          equipe_logo_url: (teams || []).find((team: any) => team.id === summary.equipe_id)?.logo_url || null,
          jogadores: players.filter((player) => player.campeonato_equipe_id === summary.campeonato_equipe_id),
        }
      }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar escalações.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json()
    const participation = await requireManagedParticipation(String(body.campeonato_equipe_id || ''), user.id)

    await supabaseAdmin
      .from('campeonato_links_inscricao')
      .update({ ativo: false, encerrado_em: new Date().toISOString() })
      .eq('campeonato_equipe_id', participation.id)
      .eq('tipo', 'escalacao_line')
      .eq('ativo', true)

    const { data: rule } = await supabaseAdmin
      .from('campeonato_regras_escalacao')
      .select('vagas_por_equipe,encerra_em')
      .eq('campeonato_id', participation.campeonato_id)
      .or(participation.grupo_id ? `grupo_id.eq.${participation.grupo_id},grupo_id.is.null` : 'grupo_id.is.null')
      .order('grupo_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const token = novoToken()
    const expiresAt = validFutureDate(body.expira_em) || validFutureDate(rule?.encerra_em) || defaultExpiration()
    const { data, error } = await supabaseAdmin
      .from('campeonato_links_inscricao')
      .insert({
        campeonato_id: participation.campeonato_id,
        grupo_id: participation.grupo_id,
        campeonato_equipe_id: participation.id,
        line_id: participation.line_id,
        token,
        tipo: 'escalacao_line',
        titulo: body.titulo || 'Convite para escalação',
        descricao: body.descricao || null,
        limite_jogadores: Number(body.limite_jogadores || rule?.vagas_por_equipe || 6),
        ativo: true,
        acompanhamento_publico: true,
        criado_por: user.id,
        expira_em: expiresAt,
      })
      .select('*')
      .single()
    if (error) throw error

    const [{ data: summary }, { data: equipe }] = await Promise.all([
      supabaseAdmin
        .from('campeonato_escalacoes_resumo')
        .select('*')
        .eq('campeonato_equipe_id', participation.id)
        .maybeSingle(),
      supabaseAdmin
        .from('equipes')
        .select('nome')
        .eq('id', participation.equipe_id)
        .maybeSingle(),
    ])

    const publicUrl = `${req.nextUrl.origin}/escala/${token}`
    const dataJogo = summary?.data_jogo
      ? new Date(`${summary.data_jogo}T00:00:00`).toLocaleDateString('pt-BR')
      : 'a definir'
    const horario = summary?.horario ? String(summary.horario).slice(0, 5) : 'a definir'
    const validade = data.expira_em
      ? new Date(data.expira_em).toLocaleString('pt-BR')
      : 'até o encerramento da escalação'
    const limite = Number(data.limite_jogadores || summary?.limite_jogadores || 6)
    const confirmados = Number(summary?.jogadores_confirmados || 0)
    const texto = `Você recebeu um convite para participar da escalação do campeonato ${summary?.campeonato_nome || 'campeonato'}.

Equipe: ${equipe?.nome || 'Equipe'}
Line: ${summary?.line_nome || 'Line'}
Fase: ${summary?.fase_nome || 'a definir'}
Grupo: ${summary?.grupo_nome || 'a definir'}
Vagas disponíveis: ${Math.max(0, limite - confirmados)} de ${limite}
Data do jogo: ${dataJogo}
Horário: ${horario}
Validade: ${validade}.

Este mesmo link pode ser usado por todos os jogadores até o limite de vagas.

Acesse: ${publicUrl}`

    return NextResponse.json(
      { link: data, token, public_url: publicUrl, texto },
      { status: 201 },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao gerar link.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json()

    if (body.link_id) {
      const { data: link, error: linkReadError } = await supabaseAdmin
        .from('campeonato_links_inscricao')
        .select('id,campeonato_equipe_id,tipo,ativo')
        .eq('id', String(body.link_id))
        .maybeSingle()
      if (linkReadError) throw linkReadError
      if (!link || link.tipo !== 'escalacao_line' || !link.ativo) throw new Error('Token ativo não encontrado.')
      await requireManagedParticipation(link.campeonato_equipe_id, user.id)

      const limite = Number(body.limite_jogadores || 0)
      if (!Number.isInteger(limite) || limite < 1) throw new Error('Informe um limite de jogadores válido.')

      const { count, error: countError } = await supabaseAdmin
        .from('campeonato_jogadores')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_equipe_id', link.campeonato_equipe_id)
        .eq('status', 'ativo')
      if (countError) throw countError
      if (limite < Number(count || 0)) throw new Error(`O limite não pode ser menor que os ${count || 0} jogadores já escalados.`)

      // datetime-local → ISO UTC (mesma regra da criação)
      let expiraEm: string | null = null
      if (body.expira_em !== undefined && body.expira_em !== null && String(body.expira_em).trim()) {
        const parsed = new Date(String(body.expira_em))
        if (Number.isNaN(parsed.getTime())) throw new Error('Data de validade inválida.')
        if (parsed.getTime() <= Date.now()) throw new Error('A validade do link precisa ser no futuro.')
        expiraEm = parsed.toISOString()
      }

      const { data: updated, error } = await supabaseAdmin
        .from('campeonato_links_inscricao')
        .update({
          limite_jogadores: limite,
          expira_em: expiraEm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ success: true, link: updated })
    }

    const playerId = String(body.jogador_inscricao_id || '')
    const { data: player, error: readError } = await supabaseAdmin
      .from('campeonato_jogadores')
      .select('id,campeonato_equipe_id')
      .eq('id', playerId)
      .maybeSingle()
    if (readError) throw readError
    if (!player) throw new Error('Jogador não encontrado na escalação.')
    await requireManagedParticipation(player.campeonato_equipe_id, user.id)

    const { error } = await supabaseAdmin
      .from('campeonato_jogadores')
      .update({ status: 'deletado', removido_em: new Date().toISOString(), removido_por: user.id })
      .eq('id', playerId)
    if (error) throw error
    return NextResponse.json({ success: true, id: playerId })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover jogador.' }, { status: 400 })
  }
}


export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const linkId = String(req.nextUrl.searchParams.get('link_id') || '')
    if (!linkId) throw new Error('Token não informado.')

    const { data: link, error: readError } = await supabaseAdmin
      .from('campeonato_links_inscricao')
      .select('id,campeonato_equipe_id,tipo,ativo')
      .eq('id', linkId)
      .maybeSingle()
    if (readError) throw readError
    if (!link || link.tipo !== 'escalacao_line' || !link.ativo) throw new Error('Token ativo não encontrado.')
    await requireManagedParticipation(link.campeonato_equipe_id, user.id)

    const now = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('campeonato_links_inscricao')
      .update({ ativo: false, encerrado_em: now, updated_at: now })
      .eq('id', link.id)
    if (error) throw error

    return NextResponse.json({ success: true, id: link.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover token.' }, { status: 400 })
  }
}
