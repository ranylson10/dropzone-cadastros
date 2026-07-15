import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertPassword, assertProfileType, assertUsername, cleanEmail } from '@/lib/validation'
import { profileTable } from '@backend/auth/server-auth'
import { verifyCode } from '@/lib/auth-verification-codes'

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


function friendlyAuthError(message: string) {
  if (/invalid token|expired/i.test(message)) return 'Codigo invalido ou expirado.'
  if (/password/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres, uma letra, um numero e um caractere especial.'
  if (/already registered|already been registered|already exists/i.test(message)) return 'Esse e-mail ja esta em uso. Entre com e-mail e senha ou recupere a conta.'
  return message || 'Erro ao cadastrar.'
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

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (user) return user
    if (data.users.length < 1000) return null
  }
  return null
}

export async function POST(req: Request) {
  let pendingAuthUserId: string | null = null

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
    if (!emailContato) throw new Error('Informe o e-mail de confirmacao.')

    if (!linked) {
      assertPassword(password)
      if (password !== confirmPassword) throw new Error('A confirmacao da senha nao confere.')
      if (!/^\d{6}$/.test(verificationCode)) throw new Error('Informe o codigo de 6 digitos enviado por e-mail.')
    }

    if (profileType === 'equipe' && !cleanText(details.tag)) throw new Error('Informe a tag da equipe.')
    if (profileType === 'jogador') {
      if (!cleanText(details.id_jogo)) throw new Error('Informe o ID de jogo.')
      if (!['support', 'rush', 'sniper', 'bomber'].includes(cleanText(details.funcao))) throw new Error('Selecione uma funcao valida.')
    }

    const table = profileTable(profileType)

    if (linked) {
      const { data: sameType, error } = await supabaseAdmin
        .from(table)
        .select('id')
        .eq('auth_user_id', linkedUser!.id)
        .maybeSingle()
      if (error) throw error
      if (sameType) throw new Error(`Este login ja possui um perfil de ${profileType}.`)
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
      if (existingGameId) throw new Error('Esse ID de jogo ja esta cadastrado. Faca login ou recupere a conta vinculada a esse ID.')
    }

    let authUser = linkedUser
    let session: any = null

    if (!linked) {
      await verifyCode({
        email: emailContato,
        purpose: 'register',
        code: verificationCode,
      })

      const existingAuthUser = await findAuthUserByEmail(emailContato)

      if (existingAuthUser) {
        const { data: updatedUser, error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...existingAuthUser.user_metadata,
            profile_type: profileType,
            username,
          },
        })
        if (updateUserError || !updatedUser.user) throw new Error(friendlyAuthError(updateUserError?.message || 'Usuario de autenticacao nao encontrado.'))
        authUser = updatedUser.user
      } else {
        const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: emailContato,
          password,
          email_confirm: true,
          user_metadata: {
            profile_type: profileType,
            username,
          },
        })
        if (createUserError || !createdUser.user) throw new Error(friendlyAuthError(createUserError?.message || 'Usuario de autenticacao nao encontrado.'))
        authUser = createdUser.user
        pendingAuthUserId = authUser.id
      }

    }

    if (!authUser) throw new Error('Usuario de autenticacao nao encontrado.')

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
      if (!linked && pendingAuthUserId) await supabaseAdmin.auth.admin.deleteUser(pendingAuthUserId)
      if (profileType === 'jogador' && accountError.code === '23505' && String(accountError.message || '').includes('id_jogo')) {
        throw new Error('Esse ID de jogo ja esta cadastrado. Faca login ou recupere a conta vinculada a esse ID.')
      }
      throw new Error(`Perfil/${table}: ${accountError.message}`)
    }

    // Equipe nova ja nasce com uma line principal para poder entrar em campeonatos.
    if (profileType === 'equipe' && account?.id) {
      const { error: lineError } = await supabaseAdmin.from('equipe_lines').insert({
        equipe_id: account.id,
        nome: name,
        tag: payload.tag || null,
        logo_url: mediaUrl,
        status: 'ativo',
      })
      // Nao falha o cadastro se a line ja existir por trigger/corrida.
      if (lineError && lineError.code !== '23505') {
        console.error('Falha ao criar line principal da equipe:', lineError.message)
      }
    }

    pendingAuthUserId = null

    if (linked) return NextResponse.json({ account, linked: true })

    if (!session) {
      const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({ email: emailContato, password })
      if (loginError || !loginData.session) throw new Error(friendlyAuthError(loginError?.message || 'Conta criada, mas nao foi possivel iniciar a sessao.'))
      session = loginData.session
    }

    return NextResponse.json({
      account,
      session: { access_token: session.access_token, refresh_token: session.refresh_token },
    })
  } catch (error: any) {
    return NextResponse.json({ error: friendlyAuthError(error?.message || 'Erro ao cadastrar.') }, { status: 400 })
  }
}
