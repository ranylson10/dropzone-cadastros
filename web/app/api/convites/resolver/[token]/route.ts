import { NextResponse } from 'next/server'
import { resolveExistingInvite } from '@/features/lili/tools'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const invite = await resolveExistingInvite(decodeURIComponent(String(token || '').trim()))
    return NextResponse.json({ href: invite.href, kind: invite.kind, title: invite.title })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Token inválido.' }, { status: 404 })
  }
}
