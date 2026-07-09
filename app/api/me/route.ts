import { NextRequest, NextResponse } from 'next/server'
import { getAccountByUserId, getBearerUser } from '@/lib/server-auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getAccountByUserId(user.id)
    return NextResponse.json({ user: { id: user.id, email: user.email }, account })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Nao autorizado.' }, { status: 401 })
  }
}
