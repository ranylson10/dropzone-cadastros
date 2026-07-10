import { NextRequest, NextResponse } from 'next/server'
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
    created_by: row.criado_por || row.auth_user_id || row.dono_auth_user_id || row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  }
}

const TABLE_BY_ENTITY: Record<string, string> = {
  championship: 'campeonatos',
  team: 'equipes',
  player_team: 'equipe_jogadores',
  championship_team: 'campeonato_equipes',
  player_registration: 'campeonato_jogadores',
  phase: 'campeonato_fases',
  group: 'campeonato_grupos',
  group_slot: 'campeonato_slots',
  game: 'campeonato_jogos',
  invite_token: 'tokens',
  registration_link: 'campeonato_links',
  lineup_rule: 'campeonato_regras',
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
  if (error) {
    if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }
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
    .from('equipes')
    .select('id, auth_user_id, dono_auth_user_id')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data || ![data.auth_user_id, data.dono_auth_user_id].includes(userId)) throw new Error('Voce nao pode gerenciar essa equipe.')
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
    .from('campeonato_regras')
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

async function saveLineupRule(data: Record<string, any>, createdByChampionshipId: string) {
  const payload = {
    campeonato_id: createdByChampionshipId,
    fase_id: data.fase_id || null,
    grupo_id: data.group_id || data.grupo_id || null,
    vagas_por_equipe: Number(data.vagas_por_equipe || 6),
    abre_em: data.abre_em || null,
    encerra_em: data.encerra_em || null,
    permite_substituicao: Boolean(data.permite_substituicao),
    max_substituicoes_por_equipe: Number(data.max_substituicoes_por_equipe || 0),
    substituicao_encerra_em: data.substituicao_encerra_em || null,
    bloquear_convites_apos_encerramento: data.bloquear_convites_apos_encerramento !== false,
    status: 'ativo',
  }

  let query = supabaseAdmin.from('campeonato_regras').select('id').eq('campeonato_id', payload.campeonato_id)
  query = payload.grupo_id ? query.eq('grupo_id', payload.grupo_id) : query.is('grupo_id', null)
  const { data: existing, error: existingError } = await query.maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { data: updated, error } = await supabaseAdmin.from('campeonato_regras').update(payload).eq('id', existing.id).select('*').single()
    if (error) throw error
    return updated
  }

  const { data: inserted, error } = await supabaseAdmin.from('campeonato_regras').insert(payload).select('*').single()
  if (error) throw error
  return inserted
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
    .from('campeonato_jogadores')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)
    .eq('equipe_id', equipeId)
    .neq('status', 'deletado')
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
      if (type === 'team') output.push(...await selectRows('equipes', type, (row) => baseRow(row, type, { data: { tag: row.tag, logo_url: row.logo_url, profile_team: true } })))
      if (type === 'championship_team') output.push(...await selectRows('campeonato_equipes', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, team_id: row.equipe_id, grupo_id: row.grupo_id, slot: row.slot_numero } })))
      if (type === 'player_team') output.push(...await selectRows('equipe_jogadores', type, (row) => baseRow(row, type, { data: { player_user_id: row.jogador_auth_user_id, team_id: row.equipe_id, origem: row.origem, nick: row.nick, id_jogo: row.id_jogo, funcao: row.funcao, foto_url: row.foto_url } })))
      if (type === 'player_registration') output.push(...await selectRows('campeonato_jogadores', type, (row) => baseRow(row, type, { data: { nick: row.nick, id_jogo: row.id_jogo, funcao: row.funcao, localidade: row.localidade, championship_id: row.campeonato_id, team_id: row.equipe_id, game_id: row.jogo_id, foto_url: row.foto_url, jogador_id: row.jogador_id } })))
      if (type === 'phase') output.push(...await selectRows('campeonato_fases', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, ordem: row.ordem } })))
      if (type === 'group') output.push(...await selectRows('campeonato_grupos', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, slots: row.slots } })))
      if (type === 'group_slot') output.push(...await selectRows('campeonato_slots', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, group_id: row.grupo_id, grupo_id: row.grupo_id, team_id: row.equipe_id, equipe_id: row.equipe_id, slot_numero: row.slot_numero } })))
      if (type === 'game') output.push(...await selectRows('campeonato_jogos', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, data_jogo: row.data_jogo, horario: row.horario, numero_partidas: row.numero_partidas, mapas: row.mapas, grupos_ids: row.grupos_ids } })))
      if (type === 'invite_token') output.push(...await selectRows('tokens', type, (row) => baseRow(row, type, { data: { token_kind: row.tipo, championship_id: row.campeonato_id, phase_id: row.fase_id, group_id: row.grupo_id, team_id: row.equipe_id, player_id: row.jogador_id, manager_id: row.manager_id, game_id: row.jogo_id, usado: row.usado, expira_em: row.expira_em } })))
      if (type === 'registration_link') output.push(...await selectRows('campeonato_links', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, group_id: row.grupo_id, titulo: row.titulo, descricao: row.descricao, ativo: row.ativo, acompanhamento_publico: row.acompanhamento_publico, expira_em: row.expira_em, public_url: `/i/${row.token}` } })))
      if (type === 'lineup_rule') output.push(...await selectRows('campeonato_regras', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, fase_id: row.fase_id, group_id: row.grupo_id, vagas_por_equipe: row.vagas_por_equipe, abre_em: row.abre_em, encerra_em: row.encerra_em, permite_substituicao: row.permite_substituicao, max_substituicoes_por_equipe: row.max_substituicoes_por_equipe, substituicao_encerra_em: row.substituicao_encerra_em, bloquear_convites_apos_encerramento: row.bloquear_convites_apos_encerramento } })))
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
        if (account.profile_type === 'jogador') return row.data?.jogador_id === account.id || row.created_by === user.id
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
  let query = supabaseAdmin.from('tokens').select('*').eq('token', clean).eq('usado', false)
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Token invalido ou ja utilizado.')
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Token expirado.')
  const { error: updateError } = await supabaseAdmin.from('tokens').update({ usado: true, usado_em: new Date().toISOString() }).eq('id', data.id)
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
        status: 'ativo',
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
      const campeonatoId = body.parent_id || data.campeonato_id
      const groupName = String(body.name || data.nome || '').trim()
      await requireChampionshipOwner(campeonatoId, user.id)
      let existingQuery = supabaseAdmin
        .from('campeonato_grupos')
        .select('*')
        .eq('campeonato_id', campeonatoId)
        .ilike('nome', groupName)
        .limit(1)
      existingQuery = data.fase_id ? existingQuery.eq('fase_id', data.fase_id) : existingQuery.is('fase_id', null)
      const { data: existingGroup, error: existingGroupError } = await existingQuery.maybeSingle()
      if (existingGroupError) throw existingGroupError
      if (existingGroup) {
        if (!existingGroup.fase_id && data.fase_id) {
          const { data: updatedGroup, error: updateGroupError } = await supabaseAdmin
            .from('campeonato_grupos')
            .update({ fase_id: data.fase_id, slots: Number(data.slots || existingGroup.slots || 12) })
            .eq('id', existingGroup.id)
            .select('*')
            .single()
          if (updateGroupError) throw updateGroupError
          row = baseRow(updatedGroup, entityType, { data: { championship_id: updatedGroup.campeonato_id, fase_id: updatedGroup.fase_id, slots: updatedGroup.slots } })
        } else {
          row = baseRow(existingGroup, entityType, { data: { championship_id: existingGroup.campeonato_id, fase_id: existingGroup.fase_id, slots: existingGroup.slots } })
        }
      } else {
        const { data: inserted, error } = await supabaseAdmin.from('campeonato_grupos').insert({
          campeonato_id: campeonatoId,
          fase_id: data.fase_id || null,
          nome: groupName,
          slots: Number(data.slots || 12),
        }).select('*').single()
        if (error) {
          if (error.code === '23505') throw new Error('Ja existe um grupo com esse nome em outro lugar do banco. Remova a constraint antiga campeonato_grupos_nome_unique ou use outro nome.')
          throw error
        }
        row = baseRow(inserted, entityType)
      }
    } else if (entityType === 'group_slot') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id)
      if (!data.grupo_id || !data.slot_numero) throw new Error('Grupo e slot sao obrigatorios.')
      const slotPayload = {
        campeonato_id: campeonatoId,
        fase_id: data.fase_id || null,
        grupo_id: data.grupo_id,
        equipe_id: data.equipe_id || null,
        slot_numero: Number(data.slot_numero),
        status: 'ativo',
      }
      if (data.equipe_id) {
        const { error: updateError } = await supabaseAdmin
          .from('campeonato_equipes')
          .update({ grupo_id: data.grupo_id, slot_numero: Number(data.slot_numero) })
          .eq('campeonato_id', campeonatoId)
          .eq('equipe_id', data.equipe_id)
        if (updateError) throw updateError
      }
      const { data: existing } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id')
        .eq('grupo_id', data.grupo_id)
        .eq('slot_numero', Number(data.slot_numero))
        .maybeSingle()
      const query = existing?.id
        ? supabaseAdmin.from('campeonato_slots').update(slotPayload).eq('id', existing.id)
        : supabaseAdmin.from('campeonato_slots').insert(slotPayload)
      const { data: inserted, error } = await query.select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'game') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id)
      const gruposIds = Array.isArray(data.grupos_ids) ? data.grupos_ids : []
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogos').insert({
        campeonato_id: campeonatoId,
        fase_id: data.fase_id || null,
        nome: body.name || data.nome,
        data_jogo: data.data_jogo || null,
        horario: data.horario || null,
        numero_partidas: Number(data.numero_partidas || 1),
        mapas: String(data.mapas || '').split(',').map((x) => x.trim()).filter(Boolean),
        grupos_ids: gruposIds,
      }).select('*').single()
      if (error) throw error
      if (gruposIds.length > 0) {
        const rows = gruposIds.map((grupoId: string) => ({ campeonato_id: campeonatoId, jogo_id: inserted.id, grupo_id: grupoId }))
        const { error: gruposError } = await supabaseAdmin.from('campeonato_jogos_grupos').insert(rows)
        if (gruposError) throw gruposError
      }
      row = baseRow(inserted, entityType)
    } else if (entityType === 'invite_token') {
      const data = body.data || {}
      const tipo = data.token_kind || body.tipo || 'team_invite'
      if (tipo === 'team_invite') await requireChampionshipOwner(body.parent_id || data.championship_id, user.id)
      if (tipo === 'manager_invite') await requireChampionshipOwner(body.parent_id || data.championship_id, user.id)
      if (tipo === 'player_invite') {
        await requireManagedTeam(body.ref_id || data.team_id, user.id)
        await requireTeamInChampionship(body.parent_id || data.championship_id, body.ref_id || data.team_id)
        await assertInviteAllowed(body.parent_id || data.championship_id, body.ref_id || data.team_id)
      }
      const prefix = String(body.token_prefix || (tipo === 'manager_invite' ? 'MG' : tipo === 'player_invite' ? 'JG' : 'EQ'))
      const { data: inserted, error } = await supabaseAdmin.from('tokens').insert({
        token: body.generate_token ? randomToken(prefix) : body.token,
        tipo,
        campeonato_id: body.parent_id || data.championship_id || null,
        fase_id: data.phase_id || data.fase_id || null,
        grupo_id: data.group_id || data.grupo_id || null,
        equipe_id: body.ref_id || data.team_id || null,
        jogador_id: data.player_id || null,
        manager_id: data.manager_id || null,
        jogo_id: data.game_id || null,
        criado_por: user.id,
        expira_em: data.expira_em || null,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'lineup_rule') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id)
      const inserted = await saveLineupRule(data, campeonatoId)
      row = baseRow(inserted, entityType)
    } else if (entityType === 'registration_link') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id
      const grupoId = data.group_id || data.grupo_id
      await requireChampionshipOwner(campeonatoId, user.id)
      if (!grupoId) throw new Error('Grupo obrigatorio para gerar link de inscricao.')
      await saveLineupRule({ ...data, grupo_id: grupoId }, campeonatoId)
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_links').insert({
        campeonato_id: campeonatoId,
        fase_id: data.fase_id || null,
        grupo_id: grupoId,
        token: body.generate_token ? randomToken('INSC') : body.token,
        tipo: 'inscricao',
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
      const { data: jogador, error: jogadorError } = await supabaseAdmin.from('jogadores').select('*').eq('auth_user_id', user.id).maybeSingle()
      if (jogadorError) throw jogadorError
      if (!jogador) throw new Error('Entre com uma conta de jogador.')
      const { error: linkError } = await supabaseAdmin.from('equipe_jogadores').upsert({
        equipe_id: equipeId,
        jogador_auth_user_id: user.id,
        nick: body.name || data.nick || jogador.nome,
        foto_url: data.foto_url || jogador.avatar_url || null,
        id_jogo: data.id_jogo || jogador.id_jogo,
        funcao: data.funcao || jogador.funcao || null,
        localidade: data.localidade || jogador.localidade || null,
        origem: 'token',
        status: 'ativo',
      }, { onConflict: 'equipe_id,jogador_auth_user_id' })
      if (linkError) throw linkError
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogadores').insert({
        campeonato_id: campeonatoId,
        equipe_id: equipeId,
        jogo_id: token?.jogo_id || data.game_id || null,
        jogador_id: jogador.id,
        nick: body.name || data.nick || jogador.nome,
        foto_url: data.foto_url || jogador.avatar_url || null,
        id_jogo: data.id_jogo || jogador.id_jogo,
        funcao: data.funcao || jogador.funcao || 'support',
        localidade: data.localidade || jogador.localidade || null,
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'player_team') {
      const data = body.data || {}
      await requireManagedTeam(body.ref_id || data.team_id, user.id)
      if (!data.player_id) throw new Error('Selecione um jogador existente para adicionar ao elenco.')
      const { data: inserted, error } = await supabaseAdmin.from('equipe_jogadores').insert({
        equipe_id: body.ref_id || data.team_id,
        jogador_auth_user_id: data.player_user_id || data.jogador_auth_user_id,
        nick: data.nick || null,
        foto_url: data.foto_url || null,
        id_jogo: data.id_jogo || null,
        funcao: data.funcao || null,
        localidade: data.localidade || null,
        origem: 'manual',
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
