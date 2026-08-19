import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  let user
  try {
    user = await getBearerUser(req)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Nao autorizado.' }, { status: 401 })
  }

  try {
    const accounts = await getAccountsForUser(user)
    if (!accounts.length) {
      return NextResponse.json(
        { user: { id: user.id, email: user.email }, account: null, accounts: [] },
        { status: 404 },
      )
    }

    const requested = String(req.headers.get('x-profile-type') || '').trim()
    const account = accounts.find((item) => item.profile_type === requested) || accounts[0]

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      account,
      accounts,
    })
  } catch (error: any) {
    // Sessão válida não pode virar falso 401 só porque a consulta de perfis
    // demorou/falhou. O cliente mantém o usuário autenticado e oferece retry.
    return NextResponse.json(
      { error: error?.message || 'Nao foi possivel carregar os perfis.' },
      { status: 503 },
    )
  }
}
