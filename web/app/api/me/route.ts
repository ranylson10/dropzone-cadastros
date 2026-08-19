import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser, toClientProfile } from '@backend/auth/server-auth'

export const dynamic = 'force-dynamic'

class ResolutionTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ResolutionTimeoutError('Tempo esgotado ao resolver a sessão.')), timeoutMs)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export async function GET(req: NextRequest) {
  let user
  try {
    user = await withTimeout(getBearerUser(req), 4_000)
  } catch (error: any) {
    if (error instanceof ResolutionTimeoutError) {
      return NextResponse.json({ error: 'A validação da sessão demorou demais. Tente novamente.' }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Nao autorizado.' }, { status: 401 })
  }

  try {
    const accounts = await withTimeout(getAccountsForUser(user), 4_000)
    if (!accounts.length) {
      return NextResponse.json(
        { user: { id: user.id, email: user.email }, account: null, accounts: [] },
        { status: 404 },
      )
    }

    const requested = String(req.headers.get('x-profile-type') || '').trim()
    const clientAccounts = accounts.map(toClientProfile)
    const account = clientAccounts.find((item) => item.profile_type === requested) || clientAccounts[0]

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      account,
      accounts: clientAccounts,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    // Sessão válida não pode virar falso 401 só porque a consulta de perfis
    // demorou/falhou. O cliente mantém o usuário autenticado e oferece retry.
    return NextResponse.json(
      { error: error instanceof ResolutionTimeoutError ? 'O carregamento dos perfis demorou demais. Tente novamente.' : error?.message || 'Nao foi possivel carregar os perfis.' },
      { status: 503 },
    )
  }
}
