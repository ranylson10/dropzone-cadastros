import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { isSystemAdmin } from '@backend/admin/admin-auth'

/**
 * Verifica se o JWT atual é administrador do sistema.
 * Não vaza existência de outros admins — só responde sobre o caller.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const admin = await isSystemAdmin(user.id)
    if (!admin) {
      return NextResponse.json({ isAdmin: false })
    }
    return NextResponse.json({
      isAdmin: true,
      admin: {
        email: admin.email,
        nome: admin.nome,
      },
    })
  } catch {
    // sem sessão / inválido → não é admin (não 401 ruidoso na home)
    return NextResponse.json({ isAdmin: false })
  }
}
