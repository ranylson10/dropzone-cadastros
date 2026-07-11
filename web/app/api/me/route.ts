import { NextRequest, NextResponse } from 'next/server'
import { getAccountsByUserId, getBearerUser } from '@backend/auth/server-auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsByUserId(user.id)
    if (!accounts.length) throw new Error('Conta nao encontrada na DropZone.')

    const requested = String(req.headers.get('x-profile-type') || '').trim()
    const account = accounts.find((item) => item.profile_type === requested) || accounts[0]

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      account,
      accounts,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Nao autorizado.' }, { status: 401 })
  }
}
