import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { requireUploadAccess } from '@backend/uploads/upload-access'

export const runtime = 'nodejs'

const ALLOWED_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast', 'campeonato'])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_VIDEO_SIZE = 40 * 1024 * 1024

function safeName(value: string) {
  return String(value || 'arquivo')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()
    .slice(0, 70) || 'arquivo'
}

function normalizeMedia(contentType: string, fileName: string) {
  const ct = String(contentType || '').toLowerCase()
  const name = String(fileName || '').toLowerCase()

  if (ct.includes('video/webm') || name.endsWith('.webm')) {
    return { kind: 'video' as const, contentType: 'video/webm', ext: 'webm', max: MAX_VIDEO_SIZE }
  }
  if (ct.includes('video/mp4') || ct.includes('video/quicktime') || name.endsWith('.mp4') || name.endsWith('.mov')) {
    return { kind: 'video' as const, contentType: 'video/mp4', ext: 'mp4', max: MAX_VIDEO_SIZE }
  }
  // imagens → sempre png no storage (cliente já converte quando preciso)
  if (ct.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return { kind: 'image' as const, contentType: 'image/png', ext: 'png', max: MAX_IMAGE_SIZE }
  }
  throw new Error('Formato não suportado. Use PNG/JPG ou vídeo MP4/WebM.')
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

/**
 * POST — gera URL assinada para upload DIRETO no Storage (evita limite de body do Next/Vercel).
 * Body: { bucket, file_name, content_type, size? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const bucket = String(body.bucket || '').trim()
    const fileName = String(body.file_name || 'arquivo')
    const contentTypeIn = String(body.content_type || '')
    const size = Number(body.size || 0)

    if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Bucket invalido.')
    await requireUploadAccess({
      user,
      bucket,
      entityId: String(body.entity_id || '').trim() || null,
      campeonatoId: String(body.campeonato_id || '').trim() || null,
    })

    const media = normalizeMedia(contentTypeIn, fileName)
    if (media.kind === 'video' && bucket !== 'campeonato') {
      throw new Error('Video so e permitido no bucket campeonato.')
    }
    if (size > 0 && size > media.max) {
      throw new Error(
        media.kind === 'video'
          ? 'Video muito pesado. Limite: 40 MB.'
          : 'Imagem muito pesada. Limite: 5 MB.',
      )
    }

    await ensureBucket(bucket, media.kind === 'video' || bucket === 'campeonato')

    const base = safeName(fileName).replace(/\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i, '') || bucket
    const path = `${Date.now()}-${crypto.randomUUID()}-${base}.${media.ext}`

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Falha ao criar URL de upload.')
    }

    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      path,
      bucket,
      content_type: media.contentType,
      kind: media.kind,
      public_url: pub.publicUrl,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao preparar upload.' }, { status: 400 })
  }
}
