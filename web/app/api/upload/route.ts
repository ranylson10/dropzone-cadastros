import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin, serviceRoleKey, supabaseUrl } from '@backend/shared/supabase-admin'
import { requireUploadAccess } from '@backend/uploads/upload-access'

export const runtime = 'nodejs'

type UploadPayload = {
  bucket?: string
  file_name?: string
  data_url?: string
  base64?: string
  content_type?: string
  entity_id?: string
  campeonato_id?: string
  upload_intent?: 'create_profile' | 'create_campeonato'
}

const ALLOWED_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast', 'campeonato'])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_CHAMPIONSHIP_IMAGE_SIZE = 15 * 1024 * 1024
const MAX_VIDEO_SIZE = 25 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function cleanHeader(value: string) {
  return String(value || '').replace(/^\uFEFF/, '').trim()
}

function safeName(value: string) {
  return String(value || 'imagem.png')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()
    .slice(0, 70) || 'imagem'
}

type DecodedUpload = {
  buffer: Buffer
  contentType: 'image/png' | 'video/mp4' | 'video/webm'
  ext: 'png' | 'mp4' | 'webm'
}

function decodeUpload(payload: UploadPayload): DecodedUpload {
  const raw = String(payload.data_url || payload.base64 || '').replace(/^\uFEFF/, '').trim()
  if (!raw) throw new Error('Arquivo ausente.')

  let header = ''
  let b64 = raw
  if (raw.startsWith('data:')) {
    const commaIndex = raw.indexOf(',')
    if (commaIndex === -1) throw new Error('Arquivo em base64 invalido.')
    header = raw.slice(0, commaIndex).toLowerCase()
    b64 = raw.slice(commaIndex + 1).replace(/\s/g, '')
  }

  const declared = String(payload.content_type || '').toLowerCase()
  const isVideo =
    header.includes('video/mp4')
    || header.includes('video/webm')
    || declared.includes('video/mp4')
    || declared.includes('video/webm')

  if (isVideo) {
    const webm = header.includes('webm') || declared.includes('webm')
    return {
      buffer: Buffer.from(b64, 'base64'),
      contentType: webm ? 'video/webm' : 'video/mp4',
      ext: webm ? 'webm' : 'mp4',
    }
  }

  if (header && !header.includes('image/png') && !header.includes('image/')) {
    throw new Error('Formato nao suportado. Use PNG/JPG ou video MP4/WebM.')
  }
  if (header.includes('image/') && !header.includes('image/png')) {
    throw new Error('A imagem final precisa estar em PNG.')
  }

  return {
    buffer: Buffer.from(b64.replace(/\s/g, ''), 'base64'),
    contentType: 'image/png',
    ext: 'png',
  }
}

async function ensureBucket(bucket: string, allowVideo: boolean) {
  const config = {
    public: true,
    fileSizeLimit: `${allowVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE}`,
    allowedMimeTypes: allowVideo
      ? ['image/png', 'video/mp4', 'video/webm']
      : ['image/png'],
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) throw new Error(`Storage/listBuckets: ${listError.message}`)

  const exists = buckets?.some((item) => item.id === bucket)
  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(bucket, config)
    if (error) throw new Error(`Storage/createBucket: ${error.message}`)
    return
  }

  const { error } = await supabaseAdmin.storage.updateBucket(bucket, config)
  if (error) throw new Error(`Storage/updateBucket: ${error.message}`)
}

async function uploadToStorage(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string,
) {
  const endpoint = `${cleanHeader(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: cleanHeader(serviceRoleKey),
      Authorization: `Bearer ${cleanHeader(serviceRoleKey)}`,
      'Content-Type': contentType,
      'Cache-Control': '31536000',
      'x-upsert': 'false',
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) {
    let details = ''
    try {
      details = JSON.stringify(await res.json())
    } catch {
      details = await res.text()
    }
    throw new Error(`Storage/upload ${res.status}: ${details || 'falhou'}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const payload = (await req.json()) as UploadPayload
    const bucket = String(payload.bucket || '').replace(/^\uFEFF/, '').trim()

    if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Bucket invalido.')
    await requireUploadAccess({
      user,
      bucket,
      entityId: String(payload.entity_id || '').trim() || null,
      campeonatoId: String(payload.campeonato_id || '').trim() || null,
      uploadIntent: payload.upload_intent || null,
    })

    const decoded = decodeUpload(payload)
    const isVideo = decoded.contentType.startsWith('video/')

    if (!decoded.buffer.length) throw new Error(isVideo ? 'Video vazio.' : 'Imagem vazia.')
    if (isVideo) {
      // vídeo de fundo da composição Stream: só bucket campeonato
      if (bucket !== 'campeonato') throw new Error('Video so e permitido no bucket campeonato.')
      if (decoded.buffer.length > MAX_VIDEO_SIZE) throw new Error('Video muito pesado. Limite: 25 MB.')
    } else {
      const imageLimit = bucket === 'campeonato' ? MAX_CHAMPIONSHIP_IMAGE_SIZE : MAX_IMAGE_SIZE
      if (decoded.buffer.length > imageLimit) {
        const limitMb = Math.round(imageLimit / 1024 / 1024)
        throw new Error(`Imagem muito pesada. Limite para este envio: ${limitMb} MB.`)
      }
      if (!decoded.buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error('Imagem invalida. Recorte novamente para gerar PNG antes de enviar.')
      }
    }

    await ensureBucket(bucket, isVideo || bucket === 'campeonato')

    const baseName =
      safeName(payload.file_name || bucket).replace(/\.(png|mp4|webm)$/i, '') || bucket
    const path = `${Date.now()}-${crypto.randomUUID()}-${baseName}.${decoded.ext}`

    await uploadToStorage(bucket, path, decoded.buffer, decoded.contentType)

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({
      url: data.publicUrl,
      path,
      bucket,
      content_type: decoded.contentType,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao enviar arquivo.' }, { status: 400 })
  }
}
