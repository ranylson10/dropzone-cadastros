import { NextRequest, NextResponse } from 'next/server'
import { authorizeStreamData } from '@backend/campeonatos/stream/stream-key-auth'
import { STREAM_SHEETS } from '@/features/campeonatos/stream/types/stream.types'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-DropZone-Stream-Key',
  'Cache-Control': 'no-store',
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await authorizeStreamData(req, id)
    return NextResponse.json({
      schema_version: 1,
      campeonato_id: id,
      header: 'X-DropZone-Stream-Key',
      datasets: STREAM_SHEETS.map((sheet) => ({
        id: sheet.id,
        nome: sheet.title,
        filtro: sheet.filter || 'none',
        colunas: sheet.columns.map((column) => ({
          chave: column.key,
          nome: column.label,
          imagem: Boolean(column.image),
        })),
      })),
    }, { headers: CORS_HEADERS })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro ao carregar catalogo Stream.',
    }, { status: 401, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
