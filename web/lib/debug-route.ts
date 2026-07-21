import { NextResponse } from 'next/server'

export function blockDebugRouteInProduction(): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null
  return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 })
}
