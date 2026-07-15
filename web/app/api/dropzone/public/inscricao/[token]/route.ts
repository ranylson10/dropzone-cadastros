import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function optionalPlayer(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'jogador') || null
    if (!account) return { autenticado: true, jogador: null }
    const row = account.data || {}
    return {
      autenticado: true,
      jogador: {
        id: account.id,
        username: account.username || row.username || null,
        nome: account.name || row.nome || row.username || null,
        avatar_url: row.avatar_url || row.foto_url || null,
        id_jogo: row.id_jogo || null,
        funcao: row.funcao || null,
      },
    }
  } catch {
    return { autenticado: false, jogador: null }
  }
}

async function getToken(ctx: any) {
  const params = await ctx.params
  return String(params?.token || '').trim().toUpperCase()
}

async function loadLink(token: string) {
  const { data: link, error } = await supabaseAdmin
    .from('campeonato_links')
    .select('*')
    .eq('token', token)
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('Link de inscricao invalido ou inativo.')
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) throw new Error('Link de inscricao expirado.')
  return link
}

function isOpen(rule: any, link: any) {
  const now = Date.now()
  if (link.expira_em && new Date(link.expira_em).getTime() < now) return false
  if (rule?.abre_em && new Date(rule.abre_em).getTime() > now) return false
  if (rule?.encerra_em && new Date(rule.encerra_em).getTime() < now) return false
  return true
}

export async function GET(req: NextRequest, ctx: any) {
  try {
    const token = await getToken(ctx)
    const link = await loadLink(token)
    const auth = await optionalPlayer(req)
    const [{ data: campeonato, error: champError }, { data: grupo, error: groupError }, { data: rule, error: ruleError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url,premiacao,status').eq('id', link.campeonato_id).maybeSingle(),
      supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).maybeSingle(),
      supabaseAdmin.from('campeonato_regras').select('*').eq('campeonato_id', link.campeonato_id).or(`grupo_id.eq.${link.grupo_id},grupo_id.is.null`).order('grupo_id', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    ])
    if (champError) throw champError
    if (groupError) throw groupError
    if (ruleError) throw ruleError

    const { data: teamLinks, error: teamsError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,equipe_id,line_id,slot_id,slot_numero,status,nome_exibicao,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)')
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .eq('status', 'ativo')
      .order('slot_numero')
    if (teamsError) throw teamsError

    const equipes = await Promise.all((teamLinks || []).map(async (item: any) => {
      const { count } = await supabaseAdmin
        .from('campeonato_jogadores')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_id', link.campeonato_id)
        .eq('campeonato_equipe_id', item.id)
        .neq('status', 'deletado')
      const line = Array.isArray(item.equipe_lines) ? item.equipe_lines[0] : item.equipe_lines
      return {
        campeonato_equipe_id: item.id,
        id: item.id,
        equipe_id: item.equipe_id,
        line_id: item.line_id,
        slot_numero: item.slot_numero,
        nome: line?.nome || item.nome_exibicao || item.equipes?.nome,
        line_nome: line?.nome || item.nome_exibicao || item.equipes?.nome,
        equipe_nome: item.equipes?.nome,
        username: item.equipes?.username,
        tag: line?.tag || item.equipes?.tag,
        logo_url: line?.logo_url || item.equipes?.logo_url,
        vagas_usadas: count || 0,
      }
    }))

    return NextResponse.json({
      link: { token: link.token, titulo: link.titulo, descricao: link.descricao, acompanhamento_publico: link.acompanhamento_publico },
      campeonato,
      grupo,
      regras: rule,
      inscricao_aberta: isOpen(rule, link),
      equipes,
      autenticado: auth.autenticado,
      jogador: auth.jogador,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao abrir link.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const user = await getBearerUser(req)
    const token = await getToken(ctx)
    const link = await loadLink(token)
    const body = await req.json()
    const campeonatoEquipeId = String(body.campeonato_equipe_id || body.equipe_id || '')
    if (!campeonatoEquipeId) throw new Error('Selecione uma line.')

    const { data: champTeam, error: champTeamError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,equipe_id,grupo_id,line_id,status')
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .eq('id', campeonatoEquipeId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (champTeamError) throw champTeamError
    if (!champTeam) throw new Error('Essa equipe nao pertence ao grupo deste link ou foi removida.')

    const { data: rule, error: ruleError } = await supabaseAdmin
      .from('campeonato_regras')
      .select('*')
      .eq('campeonato_id', link.campeonato_id)
      .or(`grupo_id.eq.${link.grupo_id},grupo_id.is.null`)
      .order('grupo_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (ruleError) throw ruleError
    if (!isOpen(rule, link)) throw new Error('Inscricao encerrada para este grupo.')

    const vagas = Number(rule?.vagas_por_equipe || 6)
    const { count, error: countError } = await supabaseAdmin
      .from('campeonato_jogadores')
      .select('id', { count: 'exact', head: true })
      .eq('campeonato_id', link.campeonato_id)
      .eq('campeonato_equipe_id', champTeam.id)
      .neq('status', 'deletado')
    if (countError) throw countError
    if ((count || 0) >= vagas) throw new Error('Essa equipe ja atingiu o limite de vagas.')

    const { data: account, error: accountError } = await supabaseAdmin
      .from('jogadores')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (accountError) throw accountError
    if (!account) throw new Error('Entre com uma conta de jogador para se inscrever.')

    const nick = String(body.nick || account.nome || '').trim()
    const idJogo = String(body.id_jogo || account.id_jogo || '').trim()
    const funcao = String(body.funcao || account.funcao || 'support')
    if (!nick || !idJogo) throw new Error('Nick e ID de jogo sao obrigatorios.')

    const { data: config, error: configError } = await supabaseAdmin
      .from('campeonato_configuracoes')
      .select('permite_jogador_multiplas_equipes')
      .eq('campeonato_id', link.campeonato_id)
      .maybeSingle()
    if (configError) throw configError

    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from('campeonato_jogadores')
      .select('id, campeonato_equipe_id')
      .eq('campeonato_id', link.campeonato_id)
      .eq('id_jogo', idJogo)
      .neq('status', 'deletado')
      .limit(1)
      .maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate && (!config?.permite_jogador_multiplas_equipes || duplicate.campeonato_equipe_id === champTeam.id)) {
      throw new Error('Esse ID de jogo ja esta inscrito neste campeonato.')
    }

    const { error: teamPlayerError } = await supabaseAdmin.from('equipe_jogadores').upsert({
      equipe_id: champTeam.equipe_id,
      jogador_auth_user_id: user.id,
      nick,
      foto_url: account.avatar_url || body.foto_url || null,
      id_jogo: idJogo,
      funcao,
      localidade: account.localidade || body.localidade || null,
      origem: 'link',
      status: 'ativo',
    }, { onConflict: 'equipe_id,jogador_auth_user_id' })
    if (teamPlayerError) throw teamPlayerError

    const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogadores').insert({
      campeonato_id: link.campeonato_id,
      equipe_id: champTeam.equipe_id,
      jogo_id: null,
      jogador_id: account.id,
      nick,
      foto_url: account.avatar_url || body.foto_url || null,
      id_jogo: idJogo,
      funcao,
      localidade: account.localidade || body.localidade || null,
      campeonato_equipe_id: champTeam.id,
      line_id: champTeam.line_id || null,
      origem: 'link',
      status: 'ativo',
    }).select('id,nick,id_jogo,funcao,created_at').single()
    if (error) throw error

    return NextResponse.json({ inscricao: inserted })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao inscrever jogador.' }, { status: 400 })
  }
}
