import { NextResponse } from 'next/server'

/**
 * Endpoint de debug de escrita removido por segurança.
 * Criação de managers deve passar pelo fluxo normal de registro.
 */
export async function GET() {
  return NextResponse.json({ error: 'Endpoint desabilitado.' }, { status: 404 })
}

export async function POST() {
  return NextResponse.json({ error: 'Endpoint desabilitado.' }, { status: 404 })
}
