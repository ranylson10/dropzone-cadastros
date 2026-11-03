import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { listWorkspaceContexts } from '@backend/auth/workspace-contexts'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const contexts = await listWorkspaceContexts(user)
    return NextResponse.json({ contexts }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar suas áreas.' }, { status: 403 })
  }
}
