import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const ALLOWED_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'campeonato'])
const MAX_FILE_SIZE = 5 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type UploadPayload = {
  bucket?: string
  file_name?: string
  content_type?: string
  data_url?: string
  base64?: string
}

function safeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80) || 'imagem.png'
}

function getBase64(payload: UploadPayload) {
  const raw = String(payload.data_url || payload.base64 || '')
  if (!raw) throw new Error('Imagem ausente.')
  if (raw.startsWith('data:')) {
    const [header, value] = raw.split(',')
    if (!header.includes('image/png')) throw new Error('A imagem final precisa estar em PNG.')
    return value || ''
  }
  return raw
}

async function ensureBucket(bucket: string) {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) throw new Error(listError.message)

  const exists = buckets?.some((item) => item.id === bucket)
  const config = {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE}`,
    allowedMimeTypes: ['image/png'],
  }

  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(bucket, config)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabaseAdmin.storage.updateBucket(bucket, config)
  if (error) throw new Error(error.message)
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let bucket = ''
    let fileName = 'imagem.png'
    let buffer: Buffer

    if (contentType.includes('application/json')) {
      const payload = (await req.json()) as UploadPayload
      bucket = String(payload.bucket || '').trim()
      fileName = safeName(String(payload.file_name || 'imagem.png'))
      const base64 = getBase64(payload)
      buffer = Buffer.from(base64, 'base64')
    } else {
      const formData = await req.formData()
      bucket = String(formData.get('bucket') || '').trim()
      const file = formData.get('file')
      if (!(file instanceof File)) throw new Error('Arquivo ausente.')
      fileName = safeName(file.name || 'imagem.png')
      buffer = Buffer.from(await file.arrayBuffer())
    }

    if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Bucket invalido.')
    if (!buffer.length) throw new Error('Imagem vazia.')
    if (buffer.length > MAX_FILE_SIZE) throw new Error('Imagem muito pesada. Limite: 5 MB.')
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error('Imagem invalida. Envie/recorte novamente para gerar PNG.')
    }

    await ensureBucket(bucket)

    const baseName = fileName.replace(/\.png$/i, '') || 'imagem'
    const path = `${Date.now()}-${crypto.randomUUID()}-${baseName}.png`

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      })

    if (error) throw new Error(error.message)

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path, bucket })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao enviar arquivo.' }, { status: 400 })
  }
}
