import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ALLOWED_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'campeonato'])
const MAX_FILE_SIZE = 4 * 1024 * 1024


export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const bucket = String(formData.get('bucket') || '').trim()
    const file = formData.get('file')

    if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Bucket invalido.')
    if (!(file instanceof File)) throw new Error('Arquivo ausente.')
    if (!file.type.startsWith('image/')) throw new Error('Envie apenas imagem.')
    if (file.size > MAX_FILE_SIZE) throw new Error('Imagem muito pesada. Limite: 4 MB.')

    const bytes = await file.arrayBuffer()
    const path = `${bucket}/${Date.now()}-${crypto.randomUUID()}.png`

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, Buffer.from(bytes), {
        contentType: 'image/png',
        upsert: false,
      })

    if (error) throw new Error(error.message)

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path, bucket })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao enviar arquivo.' }, { status: 400 })
  }
}
