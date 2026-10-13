import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { readTeamInvite } from '@backend/campeonatos/invites/team-invite-read'
import { acceptInvite } from '@backend/campeonatos/invites/invite-enrollment'
import { enrollmentErrorResponse } from '@backend/campeonatos/invites/atomic-enrollment'
import type { InviteActor } from '@backend/campeonatos/invites/types'

const headers = { 'Cache-Control': 'no-store' }
async function actorForRequest(req: NextRequest): Promise<InviteActor> {
  const user = await getBearerUser(req)
  return { user, accounts: await getAccountsForUser(user) }
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    let actor: InviteActor | null = null
    if (req.headers.has('authorization')) {
      try { actor = await actorForRequest(req) }
      catch (error) {
        if (!(error instanceof Error) || !/^(Sessao (ausente|invalida)|Conta (banida|suspensa))/.test(error.message)) throw error
      }
    }
    return NextResponse.json(await readTeamInvite(token, actor, String(req.nextUrl.searchParams.get('equipe_id') || '').trim()), { headers })
  } catch (error) {
    return NextResponse.json(enrollmentErrorResponse(error, 'Convite inválido.').body, { status: 404, headers })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const actor = await actorForRequest(req)
    const body = await req.json().catch(() => ({}))
    const { token } = await context.params
    return NextResponse.json(await acceptInvite('team', actor, token, body, req.headers.get('Idempotency-Key')), { headers })
  } catch (error) {
    const result = enrollmentErrorResponse(error, 'Erro ao aceitar convite.')
    return NextResponse.json(result.body, { status: result.status, headers })
  }
}
