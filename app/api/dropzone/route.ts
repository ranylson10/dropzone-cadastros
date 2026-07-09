import { NextRequest, NextResponse } from 'next/server'
import { getAccountByUserId, getBearerUser } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { randomToken } from '@/lib/validation'

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
    data: { ...row, ...(extra.data || {}) },
    created_by: row.criado_por || row.auth_user_id || row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  }
}

const TABLE_BY_ENTITY: Record<string, string> = {
  championship: 'campeonatos',
  team: 'equipes',
  championship_team: 'campeonato_equipes',
  group: 'campeonato_grupos',
  game: 'campeonato_jogos',
  invite_token: 'convites_tokens',
  player_registration: 'inscricoes_jogadores',
}

const PUBLIC_TYPES = Object.keys(TABLE_BY_ENTITY)

function canCreate(profileType: string | null, entityType: string) {
  if (profileType === 'produtora') return PUBLIC_TYPES.includes(entityType)
  if (profileType === 'equipe') return ['team', 'championship_team', 'invite_token', 'player_registration'].includes(entityType)
  if (profileType === 'manager') return ['team', 'championship_team', 'invite_token', 'player_registration'].includes(entityType)
  if (profileType === 'jogador') return ['player_registration'].includes(entityType)
  return false
}

async function selectRows(table: string, entityType: string, mapper = (row: any) => baseRow(row, entityType)) {
  const { data, error } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  return (data || []).map(mapper)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    await getAccountByUserId(user.id)
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entity_type')

    const output: any[] = []

    async function add(type: string) {
      if (type === 'championship') output.push(...await selectRows('campeonatos', type, (row) => baseRow(row, type, { data: { nome: row.nome } })))
      if (type === 'team') output.push(...await selectRows('equipes', type, (row) => baseRow(row, type, { data: { tag: row.tag, logo_url: row.logo_url } })))
      if (type === 'championship_team') output.push(...await selectRows('campeonato_equipes', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, team_id: row.equipe_id, grupo_id: row.grupo_id, slot: row.slot_numero } })))
      if (type === 'group') output.push(...await selectRows('campeonato_grupos', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, slots: row.slots } })))
      if (type === 'game') output.push(...await selectRows('campeonato_jogos', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, data_jogo: row.data_jogo, horario: row.horario, numero_partidas: row.numero_partidas, mapas: row.mapas, grupos_ids: row.grupos_ids } })))
      if (type === 'invite_token') output.push(...await selectRows('convites_tokens', type, (row) => baseRow(row, type, { data: { token_kind: row.tipo, championship_id: row.campeonato_id, team_id: row.equipe_id, game_id: row.jogo_id, usado: row.usado, expira_em: row.expira_em } })))
      if (type === 'player_registration') output.push(...await selectRows('inscricoes_jogadores', type, (row) => baseRow(row, type, { data: { nick: row.nick, id_jogo: row.id_jogo, funcao: row.funcao, localidade: row.localidade, team_tag: row.tag, championship_id: row.campeonato_id, team_id: row.equipe_id, game_id: row.jogo_id } })))
    }

    if (entityType) await add(entityType)
    else for (const type of PUBLIC_TYPES) await add(type)

    output.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return NextResponse.json({ rows: output })
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
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_equipes').insert({
        campeonato_id: campeonatoId,
        equipe_id: equipeId,
        grupo_id: body.data?.grupo_id || null,
        slot_numero: body.data?.slot_numero || null,
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'group') {
      const data = body.data || {}
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_grupos').insert({
        campeonato_id: body.parent_id || data.campeonato_id,
        nome: body.name || data.nome,
        slots: Number(data.slots || 12),
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'game') {
      const data = body.data || {}
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogos').insert({
        campeonato_id: body.parent_id || data.campeonato_id,
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
      const prefix = String(body.token_prefix || (tipo === 'manager_invite' ? 'MG' : tipo === 'player_invite' ? 'JG' : 'EQ'))
      const { data: inserted, error } = await supabaseAdmin.from('convites_tokens').insert({
        token: body.generate_token ? randomToken(prefix) : body.token,
        tipo,
        campeonato_id: body.parent_id || data.championship_id || null,
        equipe_id: body.ref_id || data.team_id || null,
        jogo_id: data.game_id || null,
        criado_por: user.id,
        expira_em: data.expira_em || null,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'player_registration') {
      const token = await consumeToken(body.data?.token || body.token, 'player_invite')
      const data = body.data || {}
      const { data: inserted, error } = await supabaseAdmin.from('inscricoes_jogadores').insert({
        campeonato_id: body.parent_id || token?.campeonato_id,
        equipe_id: body.ref_id || token?.equipe_id,
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
    } else {
      throw new Error('Tipo de cadastro invalido.')
    }

    return NextResponse.json({ row })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar.' }, { status: 400 })
  }
}
