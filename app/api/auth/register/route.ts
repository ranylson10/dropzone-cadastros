import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assertProfileType, assertUsername, authEmail, cleanEmail } from '@/lib/validation'
import { profileTable } from '@/lib/server-auth'

const TYPE_PREFIX = {
  produtora: 'PD',
  equipe: 'EQ',
  manager: 'MN',
  jogador: 'JG',
} as const

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function buildLocalidade(details: Record<string, any>) {
  const pais = cleanText(details.pais)
  const estado = cleanText(details.estado)
  const cidade = cleanText(details.cidade)
  return [cidade, estado, pais].filter(Boolean).join(' - ')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const profileType = assertProfileType(body.profile_type)
    const username = assertUsername(body.username)
    const name = cleanText(body.name)
    const password = String(body.password || '')
    const emailContato = body.email ? cleanEmail(body.email) : null
    const mediaUrl = cleanText(body.media_url) || null
    const details = (body.details || {}) as Record<string, any>
    const pais = cleanText(details.pais)
    const estado = cleanText(details.estado)
    const cidade = cleanText(details.cidade)
    const localidade = buildLocalidade(details)

    if (!name) throw new Error('Informe o nome do cadastro.')
    if (!emailContato) throw new Error('Informe o e-mail de confirmação.')
    if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')

    if (profileType === 'equipe' && !cleanText(details.tag)) throw new Error('Informe a tag da equipe.')
    if (profileType === 'jogador') {
      if (!cleanText(details.id_jogo)) throw new Error('Informe o ID de jogo.')
      if (!['support', 'rush', 'sniper', 'bomber'].includes(cleanText(details.funcao))) throw new Error('Selecione uma função válida.')
    }

    const table = profileTable(profileType)

    const { data: existingLogin } = await supabaseAdmin
      .from(table)
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (existingLogin) throw new Error('Esse login ja existe para esse tipo de perfil.')

    const { data: existingEmail } = await supabaseAdmin
      .from(table)
      .select('id')
      .eq('email_contato', emailContato)
      .maybeSingle()
    if (existingEmail) throw new Error('Esse e-mail ja tem uma conta desse tipo.')

    if (profileType === 'jogador') {
      const { data: existingGameId } = await supabaseAdmin
        .from(table)
        .select('id')
        .eq('id_jogo', cleanText(details.id_jogo))
        .maybeSingle()
      if (existingGameId) throw new Error('Esse ID de jogo ja esta cadastrado.')
    }

    const email = authEmail(profileType, username)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        profile_type: profileType,
        username,
        display_name: name,
        email_contato: emailContato,
      },
    })

    if (userError || !userData.user) throw new Error(`Auth/createUser: ${userError?.message || 'Nao foi possivel criar o usuario.'}`)

    const payload: Record<string, any> = {
      auth_user_id: userData.user.id,
      username,
      nome_exibido: name,
      email_contato: emailContato,
      email_verificado: false,
      pais: pais || null,
      estado: estado || null,
      cidade: cidade || null,
      localidade: localidade || null,
      status: 'ativo',
    }

    if (profileType !== 'jogador') {
      payload.public_id_prefix = TYPE_PREFIX[profileType]
    }

    if (profileType === 'produtora') {
      payload.logo_url = mediaUrl
    }

    if (profileType === 'equipe') {
      payload.logo_url = mediaUrl
      payload.tag = cleanText(details.tag).toUpperCase()
    }

    if (profileType === 'jogador') {
      payload.avatar_url = mediaUrl
      payload.id_jogo = cleanText(details.id_jogo)
      payload.funcao = cleanText(details.funcao)
    }

    if (profileType === 'manager') {
      payload.avatar_url = mediaUrl
      payload.token_convite = cleanText(details.token_convite) || null
      payload.tipo_manager = cleanText(details.tipo_manager) || null
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from(table)
      .insert(payload)
      .select('*')
      .single()

    if (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      throw new Error(`Perfil/${table}: ${accountError.message}`)
    }

    return NextResponse.json({ account })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cadastrar.' }, { status: 400 })
  }
}
