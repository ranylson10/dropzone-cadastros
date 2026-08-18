import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    const user = data.users.find((item) => item.email?.trim().toLowerCase() === email)
    if (user) return user
    if (data.users.length < 1000) return null
  }

  throw new Error('Não foi possível concluir a verificação do e-mail.')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }

    const user = await findAuthUserByEmail(email)

    return NextResponse.json(
      {
        exists: Boolean(user),
        confirmed: Boolean(user?.email_confirmed_at),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível validar este e-mail agora. Tente novamente.' },
      { status: 500 },
    )
  }
}
