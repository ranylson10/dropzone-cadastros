import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAccountByUserId, getBearerUser } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { randomToken } from '@/lib/validation'

const HIDDEN_DATA_KEYS = new Set([
  'senha',
  'senha_dono',
  'senha_hash',
  'email_contato',
  'email_verificado',
])

function safeData(row: any, extra: Record<string, any> = {}) {
  const data = { ...row, ...extra }
  for (const key of HIDDEN_DATA_KEYS) delete data[key]
  return data
}

function baseRow(row: any, entityType: string, extra: Partial<any> = {}) {
  return {
    id: row.id,
    entity_type: entityType,
    auth_user_id: row.auth_user_id ?? null,
    profile_type: row.profile_type ?? null,
    username: row.username ?? null,
    public_id: row.public_id ?? null,
    name: row.nome || row.nome_exibido || row.nick || row.token || null,
    token: row.token ?? null,
    parent_id: row.campeonato_id || row.parent_id || null,
    ref_id: row.equipe_id || row.ref_id || null,
    status: row.status || 'ativo',
    data: safeData(row, extra.data || {}),
    created_by: row.criado_por || row.auth_user_id || row.dono_auth_user_id || row.jogador_auth_user_id || row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  }
}

function hashInvitePassword(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

const TABLE_BY_ENTITY: Record<string, string> = {
  championship: 'campeonatos',
  team: 'equipes',
  player_team: 'equipe_jogadores',
  championship_team: 'campeonato_equipes',
  phase: 'campeonato_fases',
  group: 'campeonato_grupos',
  group_slot: 'campeonato_grupo_slots',
  game: 'campeonato_jogos',
  invite_token: 'convites_tokens',
  player_registration: 'inscricoes_jogadores',
  registration_link: 'campeonato_links_inscricao',
  lineup_rule: 'campeonato_regras_escalacao',
}

const PUBLIC_TYPES = Object.keys(TABLE_BY_ENTITY)

function canCreate(profileType: string | null, entityType: string) {
  if (profileType === 'produtora') return ['championship', 'team', 'championship_team', 'phase', 'group', 'group_slot', 'game', 'invite_token', 'registration_link', 'lineup_rule'].includes(entityType)
  if (profileType === 'equipe') return ['championship_team', 'invite_token', 'player_registration', 'player_team'].includes(entityType)
  if (profileType === 'manager') return ['championship_team', 'invite_token', 'player_registration', 'player_team'].includes(entityType)
  if (profileType === 'jogador') return ['player_registration'].includes(entityType)
  return false
}

async function selectRows(table: string, entityType: string, mapper = (row: any) => baseRow(row, entityType)) {
  const { data, error } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  return (data || []).map(mapper)
}

async function requireChampionshipOwner(championshipId: string | null | undefined, userId: string) {
  if (!championshipId) throw new Error('Campeonato obrigatorio.')
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id, criado_por')
    .eq('id', championshipId)
    .maybeSingle()
  if (error) throw error
  if (!data || data.criado_por !== userId) throw new Error('Voce nao pode gerenciar esse campeonato.')
  return data
}

async function requireManagedTeam(teamId: string | null | undefined, userId: string) {
  if (!teamId) throw new Error('Equipe obrigatoria.')
  const { data, error } = await supabaseAdmin
    .from('equipes_perfis')
    .select('id, auth_user_id')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data || data.auth_user_id !== userId) throw new Error('Voce nao pode gerenciar essa equipe.')
  return data
}

async function requireTeamInChampionship(championshipId: string | null | undefined, teamId: string | null | undefined) {
  if (!championshipId || !teamId) throw new Error('Campeonato e equipe obrigatorios.')
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id, grupo_id')
    .eq('campeonato_id', championshipId)
    .eq('equipe_id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Essa equipe nao esta inscrita nesse campeonato.')
  return data
}


async function getLineupRule(campeonatoId: string, grupoId?: string | null) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_regras_escalacao')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .or(grupoId ? `grupo_id.eq.${grupoId},grupo_id.is.null` : 'grupo_id.is.null')
    .order('grupo_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

function assertLineupOpen(rule: any, action = 'inscricao') {
  const now = Date.now()
  if (rule?.abre_em && new Date(rule.abre_em).getTime() > now) throw new Error('Escalacao ainda nao abriu.')
  if (rule?.encerra_em && new Date(rule.encerra_em).getTime() < now) throw new Error('Escalacao encerrada.')
  if (action === 'substituicao') {
    if (!rule?.permite_substituicao) throw new Error('Substituicao nao permitida neste campeonato.')
    if (rule?.substituicao_encerra_em && new Date(rule.substituicao_encerra_em).getTime() < now) throw new Error('Prazo de substituicao encerrado.')
  }
}

async function assertPlayerCapacity(campeonatoId: string, equipeId: string, vagas = 6) {
  const { count, error } = await supabaseAdmin
    .from('inscricoes_jogadores')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)
    .eq('equipe_id', equipeId)
  if (error) throw error
  if ((count || 0) >= vagas) throw new Error('Essa equipe ja atingiu o limite de vagas de escalacao.')
}

async function assertInviteAllowed(campeonatoId: string, equipeId?: string | null) {
  let grupoId: string | null = null
  if (equipeId) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('grupo_id')
      .eq('campeonato_id', campeonatoId)
      .eq('equipe_id', equipeId)
      .maybeSingle()
    if (error) throw error
    grupoId = data?.grupo_id || null
  }
  const rule = await getLineupRule(campeonatoId, grupoId)
  if (rule?.bloquear_convites_apos_encerramento !== false) assertLineupOpen(rule)
  return rule
}

function championshipsOwnedBy(row: any, rows: any[], userId: string) {
  const championshipId = row.parent_id || row.data?.championship_id
  return rows.some((item) => item.entity_type === 'championship' && item.id === championshipId && item.created_by === userId)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getAccountByUserId(user.id)
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entity_type')

    const output: any[] = []

    async function add(type: string) {
      if (type === 'championship') output.push(...await selectRows('campeonatos', type, (row) => baseRow(row, type, { data: { nome: row.nome } })))
      if (type === 'team') output.push(...await selectRows('equipes_perfis', type, (row) => baseRow(row, type, { data: { tag: row.tag, logo_url: row.logo_url, profile_team: true } })))
      if (type === 'championship_team') output.push(...await selectRows('campeonato_equipes', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, team_id: row.equipe_id, grupo_id: row.grupo_id, slot: row.slot_numero } })))
      if (type === 'player_team') output.push(...await selectRows('equipe_jogadores', type, (row) => baseRow(row, type, { data: { player_user_id: row.jogador_auth_user_id, team_id: row.equipe_id, origem: row.origem, nick: row.nick, id_jogo: row.id_jogo, funcao: row.funcao, foto_url: row.foto_url } })))
      if (type === 'phase') output.push(...await selectRows('campeonato_fases', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, ordem: row.ordem } })))
      if (type === 'group') output.push(...await selectRows('campeonato_grupos', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, slots: row.slots } })))
      if (type === 'group_slot') output.push(...await selectRows('campeonato_grupo_slots', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, group_id: row.grupo_id, grupo_id: row.grupo_id, team_id: row.equipe_id, equipe_id: row.equipe_id, slot_numero: row.slot_numero } })))
      if (type === 'game') output.push(...await selectRows('campeonato_jogos', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, data_jogo: row.data_jogo, horario: row.horario, numero_partidas: row.numero_partidas, mapas: row.mapas, grupos_ids: row.grupos_ids } })))
      if (type === 'invite_token') output.push(...await selectRows('convites_tokens', type, (row) => baseRow(row, type, { data: { token_kind: row.tipo, championship_id: row.campeonato_id, team_id: row.equipe_id, game_id: row.jogo_id, usado: row.usado, expira_em: row.expira_em } })))
      if (type === 'player_registration') output.push(...await selectRows('inscricoes_jogadores', type, (row) => baseRow(row, type, { data: { nick: row.nick, id_jogo: row.id_jogo, funcao: row.funcao, localidade: row.localidade, team_tag: row.tag, championship_id: row.campeonato_id, team_id: row.equipe_id, game_id: row.jogo_id, foto_url: row.foto_url } })))
      if (type === 'registration_link') output.push(...await selectRows('campeonato_links_inscricao', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, group_id: row.grupo_id, titulo: row.titulo, descricao: row.descricao, ativo: row.ativo, acompanhamento_publico: row.acompanhamento_publico, expira_em: row.expira_em, public_url: `/i/${row.token}` } })))
      if (type === 'lineup_rule') output.push(...await selectRows('campeonato_regras_escalacao', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, group_id: row.grupo_id, vagas_por_equipe: row.vagas_por_equipe, abre_em: row.abre_em, encerra_em: row.encerra_em, permite_substituicao: row.permite_substituicao, max_substituicoes_por_equipe: row.max_substituicoes_por_equipe, substituicao_encerra_em: row.substituicao_encerra_em, bloquear_convites_apos_encerramento: row.bloquear_convites_apos_encerramento } })))
    }

    if (entityType) await add(entityType)
    else for (const type of PUBLIC_TYPES) await add(type)

    const managedTeamIds = new Set([
      ...output.filter((row) => row.entity_type === 'team' && row.created_by === user.id).map((row) => row.id),
      ...output.filter((row) => row.entity_type === 'championship_team' && row.created_by === user.id && row.ref_id).map((row) => row.ref_id),
    ])

    const visible = output.filter((row) => {
      if (row.entity_type === 'invite_token' || row.entity_type === 'registration_link' || row.entity_type === 'lineup_rule') return row.created_by === user.id
      if (row.entity_type === 'player_registration') {
        if (account.profile_type === 'jogador') return row.created_by === user.id
        if (account.profile_type === 'produtora') return championshipsOwnedBy(row, output, user.id)
        if (account.profile_type === 'equipe' || account.profile_type === 'manager') return managedTeamIds.has(row.ref_id)
        return false
      }
      return true
    })

    visible.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return NextResponse.json({ rows: visible })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar.' }, { status: 400 })
  }
}

async function consumeToken(token: string | null | undefined, tipo?: string) {
  const clean = String(token || '').trim().toUpperCase()
  if (!clean) return null
  let query = supabaseAdmin.from('convites_tokens').select('*').eq('token', clean).eq('usado', false)
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Token invalido ou ja utilizado.')
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Token expirado.')
  const { error: updateError } = await supabaseAdmin.from('convites_tokens').update({ usado: true, usado_em: new Date().toISOString() }).eq('id', data.id)
  if (updateError) throw updateError
  return data
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getAccountByUserId(user.id)
    const body = await req.json()
    const entityType = String(body.entity_type || '').trim()

    if (!canCreate(account.profile_type, entityType)) throw new Error('Seu tipo de perfil nao pode criar esse cadastro.')

    let row: any
    if (entityType === 'championship') {
      const data = body.data || {}
      const { data: inserted, error } = await supabaseAdmin.from('campeonatos').insert({
        nome: body.name || data.nome,
        logo_url: data.logo_url || null,
        premiacao: data.premiacao || null,
        divisao_premiacao: data.divisao_premiacao || null,
        regras_url: data.regras_url || null,
        criado_por: user.id,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'team') {
      const data = body.data || {}
      const { data: inserted, error } = await supabaseAdmin.from('equipes').insert({
        nome: body.name || data.nome,
        tag: data.tag,
        logo_url: data.logo_url || null,
        dono_auth_user_id: user.id,
        senha_dono: data.senha_dono || null,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'championship_team') {
      const token = await consumeToken(body.token, 'team_invite')
      const campeonatoId = body.parent_id || token?.campeonato_id
      const equipeId = body.ref_id || token?.equipe_id
      if (account.profile_type === 'produtora' && !token) await requireChampionshipOwner(campeonatoId, user.id)
      if ((account.profile_type === 'equipe' || account.profile_type === 'manager') && !token) await requireManagedTeam(equipeId, user.id)
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_equipes').insert({
        campeonato_id: campeonatoId,
        equipe_id: equipeId,
        grupo_id: body.data?.grupo_id || null,
        slot_numero: body.data?.slot_numero || null,
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'phase') {
      const data = body.data || {}
      await requireChampionshipOwner(body.parent_id || data.campeonato_id, user.id)
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_fases').insert({
        campeonato_id: body.parent_id || data.campeonato_id,
        nome: body.name || data.nome,
        ordem: Number(data.ordem || 1),
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'group') {
      const data = body.data || {}
      await requireChampionshipOwner(body.parent_id || data.campeonato_id, user.id)
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_grupos').insert({
        campeonato_id: body.parent_id || data.campeonato_id,
        fase_id: data.fase_id || null,
        nome: body.name || data.nome,
        slots: Number(data.slots || 12),
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'group_slot') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id)
      if (!data.grupo_id || !data.equipe_id || !data.slot_numero) throw new Error('Grupo, equipe e slot sao obrigatorios.')
      const { error: updateError } = await supabaseAdmin
        .from('campeonato_equipes')
        .update({ grupo_id: data.grupo_id, slot_numero: Number(data.slot_numero) })
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', data.equipe_id)
      if (updateError) throw updateError
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_grupo_slots').upsert({
        campeonato_id: campeonatoId,
        grupo_id: data.grupo_id,
        equipe_id: data.equipe_id,
        slot_numero: Number(data.slot_numero),
      }, { onConflict: 'grupo_id,slot_numero' }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'game') {
      const data = body.data || {}
      await requireChampionshipOwner(body.parent_id || data.campeonato_id, user.id)
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogos').insert({
        campeonato_id: body.parent_id || data.campeonato_id,
        fase_id: data.fase_id || null,
        nome: body.name || data.nome,
        data_jogo: data.data_jogo || null,
        horario: data.horario || null,
        numero_partidas: Number(data.numero_partidas || 1),
        mapas: String(data.mapas || '').split(',').map((x) => x.trim()).filter(Boolean),
        grupos_ids: data.grupos_ids || [],
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'invite_token') {
      const data = body.data || {}
      const tipo = data.token_kind || body.tipo || 'team_invite'
      if (tipo === 'team_invite') await requireChampionshipOwner(body.parent_id || data.championship_id, user.id)
      if (tipo === 'manager_invite') {
        await requireChampionshipOwner(body.parent_id || data.championship_id, user.id)
        if (!String(data.senha_convite || '').trim()) throw new Error('Informe a senha do convite de manager.')
      }
      if (tipo === 'player_invite') {
        await requireManagedTeam(body.ref_id || data.team_id, user.id)
        await requireTeamInChampionship(body.parent_id || data.championship_id, body.ref_id || data.team_id)
        await assertInviteAllowed(body.parent_id || data.championship_id, body.ref_id || data.team_id)
      }
      const prefix = String(body.token_prefix || (tipo === 'manager_invite' ? 'MG' : tipo === 'player_invite' ? 'JG' : 'EQ'))
      const { data: inserted, error } = await supabaseAdmin.from('convites_tokens').insert({
        token: body.generate_token ? randomToken(prefix) : body.token,
        tipo,
        campeonato_id: body.parent_id || data.championship_id || null,
        equipe_id: body.ref_id || data.team_id || null,
        jogo_id: data.game_id || null,
        senha_hash: tipo === 'manager_invite' ? hashInvitePassword(String(data.senha_convite || '').trim()) : null,
        criado_por: user.id,
        expira_em: data.expira_em || null,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
     } else if (entityType === 'lineup_rule') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id)
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_regras_escalacao').upsert({
        campeonato_id: campeonatoId,
        grupo_id: data.group_id || data.grupo_id || null,
        vagas_por_equipe: Number(data.vagas_por_equipe || 6),
        abre_em: data.abre_em || null,
        encerra_em: data.encerra_em || null,
        permite_substituicao: Boolean(data.permite_substituicao),
        max_substituicoes_por_equipe: Number(data.max_substituicoes_por_equipe || 0),
        substituicao_encerra_em: data.substituicao_encerra_em || null,
        bloquear_convites_apos_encerramento: data.bloquear_convites_apos_encerramento !== false,
      }, { onConflict: 'campeonato_id,grupo_id' }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'registration_link') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id
      const grupoId = data.group_id || data.grupo_id
      await requireChampionshipOwner(campeonatoId, user.id)
      if (!grupoId) throw new Error('Grupo obrigatorio para gerar link de inscricao.')
      const rulePayload = {
        championship_id: campeonatoId,
        group_id: grupoId,
        vagas_por_equipe: data.vagas_por_equipe,
        abre_em: data.abre_em,
        encerra_em: data.encerra_em,
        permite_substituicao: data.permite_substituicao,
        max_substituicoes_por_equipe: data.max_substituicoes_por_equipe,
        substituicao_encerra_em: data.substituicao_encerra_em,
        bloquear_convites_apos_encerramento: data.bloquear_convites_apos_encerramento,
      }
      const { error: ruleError } = await supabaseAdmin.from('campeonato_regras_escalacao').upsert({
        campeonato_id: campeonatoId,
        grupo_id: grupoId,
        vagas_por_equipe: Number(rulePayload.vagas_por_equipe || 6),
        abre_em: rulePayload.abre_em || null,
        encerra_em: rulePayload.encerra_em || null,
        permite_substituicao: Boolean(rulePayload.permite_substituicao),
        max_substituicoes_por_equipe: Number(rulePayload.max_substituicoes_por_equipe || 0),
        substituicao_encerra_em: rulePayload.substituicao_encerra_em || null,
        bloquear_convites_apos_encerramento: rulePayload.bloquear_convites_apos_encerramento !== false,
      }, { onConflict: 'campeonato_id,grupo_id' })
      if (ruleError) throw ruleError
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_links_inscricao').insert({
        campeonato_id: campeonatoId,
        grupo_id: grupoId,
        token: body.generate_token ? randomToken('INSC') : body.token,
        titulo: body.name || data.titulo || 'Inscricao de jogadores',
        descricao: data.descricao || null,
        ativo: data.ativo !== false,
        acompanhamento_publico: data.acompanhamento_publico !== false,
        criado_por: user.id,
        expira_em: data.expira_em || data.encerra_em || null,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'player_registration') {
      const token = await consumeToken(body.data?.token || body.token, 'player_invite')
      const data = body.data || {}
      const campeonatoId = body.parent_id || token?.campeonato_id
      const equipeId = body.ref_id || token?.equipe_id
      const champTeam = await requireTeamInChampionship(campeonatoId, equipeId)
      const rule = await getLineupRule(campeonatoId, champTeam.grupo_id)
      assertLineupOpen(rule)
      await assertPlayerCapacity(campeonatoId, equipeId, Number(rule?.vagas_por_equipe || 6))
      const { error: linkError } = await supabaseAdmin.from('equipe_jogadores').upsert({
        jogador_auth_user_id: user.id,
        equipe_id: equipeId,
        nick: body.name || data.nick,
        foto_url: data.foto_url || null,
        id_jogo: data.id_jogo,
        funcao: data.funcao,
        localidade: data.localidade || null,
        origem: 'token_jogador',
        status: 'ativo',
      }, { onConflict: 'jogador_auth_user_id,equipe_id' })
      if (linkError) throw linkError
      const { data: inserted, error } = await supabaseAdmin.from('inscricoes_jogadores').insert({
        campeonato_id: campeonatoId,
        equipe_id: equipeId,
        jogo_id: token?.jogo_id || data.game_id || null,
        tag: data.team_tag || null,
        nick: body.name || data.nick,
        foto_url: data.foto_url || null,
        id_jogo: data.id_jogo,
        funcao: data.funcao,
        localidade: data.localidade || null,
        senha: data.senha || null,
        jogador_auth_user_id: user.id,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'player_team') {
      const data = body.data || {}
      await requireManagedTeam(body.ref_id || data.team_id, user.id)
      const { data: inserted, error } = await supabaseAdmin.from('equipe_jogadores').insert({
        jogador_auth_user_id: data.player_user_id || null,
        equipe_id: body.ref_id || data.team_id,
        nick: body.name || data.nick,
        foto_url: data.foto_url || null,
        id_jogo: data.id_jogo || null,
        funcao: data.funcao || null,
        localidade: data.localidade || null,
        origem: data.origem || 'manual',
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else {
      throw new Error('Tipo de cadastro invalido.')
    }

    return NextResponse.json({ row })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar.' }, { status: 400 })
  }
}
