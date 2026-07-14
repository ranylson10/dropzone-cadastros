import { NextResponse } from 'next/server'

export async function GET() {
  console.log('[api/ping] ping received')
  return NextResponse.json({ ok: true, now: new Date().toISOString() })
}
