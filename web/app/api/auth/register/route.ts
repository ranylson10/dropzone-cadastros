import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertProfileType, assertUsername, cleanEmail } from '@/lib/validation'
import { profileTable } from '@backend/auth/server-auth'

const TYPE_PREFIX = {
  produtora: 'PD',
  equipe: 'EQ',
  manager: 'MN',
  jogador: 'JG',
} as const

const PROFILE_TABLES = ['produtoras', 'equipes', 'jogadores', 'managers'] as const

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function buildLocalidade(details: Record<string, any>) {
  return [cleanText(details.cidade), cleanText(details.estado), cleanText(details.pais)].filter(Boolean).join(' - ')
}

function hashInvitePassword(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function assertGlobalUsernameAvailable(username: string) {
  for (const table of PROFILE_TABLES) {
    const { data, error } = await supabaseAdmin.from(table).select('id').ilike('username', username).maybeSingle()
    if (error) throw error
    if (data) throw new Error('Esse login ja existe. Escolha outro login.')
  }
}

async function getLinkedUser(request: Request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) throw new Error('Sessao invalida para criar perfil vinculado.')
  return data.user
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const profileType = assertProfileType(body.profile_type)
    const username = assertUsername(body.username)
    const name = cleanText(body.name)
    const mediaUrl = cleanText(body.media_url) || null
    const details = (body.details || {}) as Record<string, any>
    const linkedUser = body.link_existing ? await getLinkedUser(req) : null
    const linked = Boolean(linkedUser)

    const password = String(body.password || '')
    const confirmPassword = String(body.confirm_password || '')
    const verificationCode = cleanText(body.verification_code)
    const emailContato = linked
      ? cleanEmail(linkedUser?.email || '')
      : body.email ? cleanEmail(body.email) : null

    if (!name) throw new Error('Informe o nome do cadastro.')
    if (!emailContato) throw new Error('Informe o e-mail de confirmação.')

    if (!linked) {
      if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')
      if (!/^\d{6}$/.test(verificationCode)) throw new Error('Informe o código de 6 dígitos enviado por e-mail.')
    }

    if (profileType === 'equipe' && !cleanText(details.tag)) throw new Error('Informe a tag da equipe.')
    if (profileType === 'jogador') {
      if (!cleanText(details.id_jogo)) throw new Error('Informe o ID de jogo.')
      if (!['support', 'rush', 'sniper', 'bomber'].includes(cleanText(details.funcao))) throw new Error('Selecione uma função válida.')
    }
    if (profileType === 'manager') {
      if (!cleanText(details.token_convite)) throw new Error('Informe o token de convite do manager.')
      if (!cleanText(details.senha_convite)) throw new Error('Informe a senha do convite do manager.')
    }

    const table = profileTable(profileType)

    if (linked) {
      const { data: sameType, error } = await supabaseAdmin
        .from(table)
        .select('id')
        .eq('auth_user_id', linkedUser!.id)
        .maybeSingle()
      if (error) throw error
      if (sameType) throw new Error(`Este login já possui um perfil de ${profileType}.`)
    }

    let managerInvite: any = null
    if (profileType === 'manager') {
      const { data, error } = await supabaseAdmin
        .from('tokens')
        .select('*')
        .eq('token', cleanText(details.token_convite).toUpperCase())
        .eq('tipo', 'manager_invite')
        .eq('usado', false)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Token de manager invalido ou ja utilizado.')
      if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Token de manager expirado.')
      if (data.senha_hash && data.senha_hash !== hashInvitePassword(cleanText(details.senha_convite))) {
        throw new Error('Senha do convite de manager invalida.')
      }
      managerInvite = data
    }

    await assertGlobalUsernameAvailable(username)

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

    let authUser = linkedUser
    let session: any = null

    if (!linked) {
      const { data: verified, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        email: emailContato,
        token: verificationCode,
        type: 'signup',
      })
      if (verifyError || !verified.user) throw new Error(verifyError?.message || 'Código inválido ou expirado.')
      authUser = verified.user
      session = verified.session
    }

    if (!authUser) throw new Error('Usuário de autenticação não encontrado.')

    const payload: Record<string, any> = {
      auth_user_id: authUser.id,
      username,
      nome: name,
      email_contato: emailContato,
      email_verificado: true,
      pais: cleanText(details.pais) || null,
      estado: cleanText(details.estado) || null,
      cidade: cleanText(details.cidade) || null,
      localidade: buildLocalidade(details) || null,
      status: 'ativo',
    }

    if (profileType !== 'jogador' || table !== 'jogadores') payload.public_id_prefix = TYPE_PREFIX[profileType]
    if (profileType === 'produtora') payload.logo_url = mediaUrl
    if (profileType === 'equipe') {
      payload.logo_url = mediaUrl
      payload.tag = cleanText(details.tag).toUpperCase()
      payload.dono_auth_user_id = authUser.id
    }
    if (profileType === 'jogador') {
      payload.avatar_url = mediaUrl
      payload.id_jogo = cleanText(details.id_jogo)
      payload.funcao = cleanText(details.funcao)
    }
    if (profileType === 'manager') payload.avatar_url = mediaUrl

    const { data: account, error: accountError } = await supabaseAdmin.from(table).insert(payload).select('*').single()
    if (accountError) {
      if (!linked) await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(`Perfil/${table}: ${accountError.message}`)
    }

    if (managerInvite) {
      const { error: tokenError } = await supabaseAdmin
        .from('tokens')
        .update({ usado: true, usado_em: new Date().toISOString() })
        .eq('id', managerInvite.id)
      if (tokenError) throw tokenError
    }

    if (linked) return NextResponse.json({ account, linked: true })

    if (!session) {
      const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({ email: emailContato, password })
      if (loginError || !loginData.session) throw new Error(loginError?.message || 'Conta criada, mas não foi possível iniciar a sessão.')
      session = loginData.session
    }

    return NextResponse.json({
      account,
      session: { access_token: session.access_token, refresh_token: session.refresh_token },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cadastrar.' }, { status: 400 })
  }
}
