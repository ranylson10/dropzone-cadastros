import { NextRequest, NextResponse } from 'next/server'
import { loadEditorDatasets } from '@backend/campeonatos/stream/editor-datasets.service'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-DropZone-Stream-Key',
  'Cache-Control': 'no-store',
}

export async function GET(request: NextRequest) {
  try {
    const key = String(request.headers.get('x-dropzone-stream-key') || '').trim()
    if (!key) return NextResponse.json({ error: 'Informe a chave Stream do campeonato.' }, { status: 401, headers: CORS_HEADERS })

    const { data: streamKey, error } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .select('campeonato_id,label')
      .eq('key_token', key)
      .eq('ativo', true)
      .maybeSingle()
    if (error) throw error
    if (!streamKey?.campeonato_id) {
      return NextResponse.json({ error: 'Chave Stream invalida ou revogada.' }, { status: 401, headers: CORS_HEADERS })
    }

    const [{ data: championship }, payload] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome').eq('id', streamKey.campeonato_id).maybeSingle(),
      loadEditorDatasets(String(streamKey.campeonato_id)),
    ])

    return NextResponse.json({
      ...payload,
      campeonato: {
        id: String(streamKey.campeonato_id),
        nome: String(championship?.nome || streamKey.label || 'Campeonato'),
      },
    }, { headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Nao foi possivel carregar as tabelas.' }, { status: 400, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
