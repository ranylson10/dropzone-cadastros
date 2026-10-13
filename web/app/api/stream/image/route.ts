import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { loadStreamImage } from '@backend/uploads/stream-image'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await getBearerUser(request)
    const body = await request.json()
    const image = await loadStreamImage(body.url, request.nextUrl.origin)
    return new NextResponse(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.contentType, 'Cache-Control': 'private, max-age=300' } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Falha ao preparar imagem.' }, { status: 400 })
  }
}
