import { supabase } from '@/lib/supabase-browser'

const PUBLIC_MEDIA_CACHE_SECONDS = 31_536_000
const MAX_IMAGE_EDGE = 2_560

/**
 * Entrega um objeto pÃºblico pelo cache do prÃ³prio app. Ãštil para cenas OBS,
 * nas quais uma revalidaÃ§Ã£o do CDN do Storage a cada atualizaÃ§Ã£o vira egress.
 * URLs externas e valores antigos que nÃ£o sejam do nosso Storage nÃ£o mudam.
 */
export function cachedStorageMediaUrl(value: string) {
  const raw = String(value || '').trim()
  const storageBase = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  if (!raw || !storageBase) return raw
  try {
    const url = new URL(raw)
    const storage = new URL(storageBase)
    const prefix = '/storage/v1/object/public/'
    if (url.origin !== storage.origin || !url.pathname.startsWith(prefix)) return raw
    const parts = url.pathname.slice(prefix.length).split('/').filter(Boolean)
    if (parts.length < 2) return raw
    return `/api/media/${parts.map(encodeURIComponent).join('/')}`
  } catch {
    return raw
  }
}

function isOptimizableImage(file: File) {
  return /^(image\/(png|jpe?g|webp))$/i.test(file.type)
}

/** Reduz imagens antes do envio; GIF e SVG ficam intactos para preservar animaÃ§Ã£o e vetores. */
async function optimizeImageForStorage(file: File): Promise<File> {
  if (!isOptimizableImage(file) || typeof document === 'undefined') return file

  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('NÃ£o foi possÃ­vel preparar a imagem.'))
      element.src = sourceUrl
    })
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight)
    if (!largestSide) return file

    const scale = Math.min(1, MAX_IMAGE_EDGE / largestSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return file
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84))
    // MantÃ©m o original se WebP nÃ£o estiver disponÃ­vel ou nÃ£o trouxer economia.
    if (!blob || blob.size >= file.size) return file
    const baseName = (file.name || 'imagem').replace(/\.[^.]+$/, '') || 'imagem'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified })
  } catch {
    // A economia de banda nÃ£o pode impedir um upload vÃ¡lido.
    return file
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

async function authHeaders(profileType?: string | null) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')
  return {
    Authorization: `Bearer ${token}`,
    ...(profileType ? { 'x-profile-type': profileType } : {}),
  }
}

function currentCampeonatoId(bucket: string) {
  if (bucket !== 'campeonato' || typeof window === 'undefined') return null
  return window.location.pathname.match(/\/campeonatos\/([^/]+)/)?.[1] || null
}

type UploadContext = {
  entityId?: string | null
  campeonatoId?: string | null
  uploadIntent?: 'create_profile' | 'create_campeonato' | null
}

/** Upload PNG público via /api/upload (precisa sessão). */
export async function uploadPublicFile(
  file: File,
  bucket: string,
  profileType?: string | null,
  context?: UploadContext,
): Promise<string> {
  // arquivos maiores → upload assinado direto no Storage
  if (file.size > 900_000) {
    const media = await uploadPublicMedia(file, bucket, profileType, context)
    return media.url
  }

  const dataUrl = await fileToDataUrl(file)
  const headers = await authHeaders(profileType)

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      bucket,
      file_name: file.name || `${bucket}.png`,
      content_type: file.type || 'image/png',
      data_url: dataUrl,
      entity_id: context?.entityId || null,
      campeonato_id: context?.campeonatoId || currentCampeonatoId(bucket),
      upload_intent: context?.uploadIntent || null,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao enviar arquivo.')
  return String(json.url || '')
}

/**
 * Upload de mídia (PNG ou vídeo) via URL assinada (direto no Supabase Storage).
 * Evita limite de body do Next/Vercel — necessário para vídeos.
 */
export async function uploadPublicMedia(
  file: File,
  bucket: string,
  profileType?: string | null,
  context?: UploadContext,
): Promise<{ url: string; content_type: string; kind: 'image' | 'video' }> {
  const headers = await authHeaders(profileType)
  const uploadFile = await optimizeImageForStorage(file)
  const contentType = uploadFile.type || guessContentType(uploadFile.name)

  const prep = await fetch('/api/upload/signed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      bucket,
      file_name: uploadFile.name || `${bucket}-media`,
      content_type: contentType,
      size: uploadFile.size,
      entity_id: context?.entityId || null,
      campeonato_id: context?.campeonatoId || currentCampeonatoId(bucket),
      upload_intent: context?.uploadIntent || null,
    }),
  })
  const signed = await prep.json().catch(() => ({}))
  if (!prep.ok) throw new Error(signed.error || 'Falha ao preparar upload.')

  const put = await fetch(String(signed.signed_url), {
    method: 'PUT',
    headers: {
      'Content-Type': String(signed.content_type || contentType),
      // O caminho tem UUID e nunca Ã© sobrescrito: pode ser cacheado por longo prazo.
      'Cache-Control': `max-age=${PUBLIC_MEDIA_CACHE_SECONDS}`,
    },
    body: uploadFile,
  })
  if (!put.ok) {
    const detail = await put.text().catch(() => '')
    throw new Error(`Falha no upload do arquivo (${put.status}). ${detail.slice(0, 120)}`)
  }

  return {
    url: String(signed.public_url || ''),
    content_type: String(signed.content_type || contentType),
    kind: signed.kind === 'video' ? 'video' : 'image',
  }
}

function guessContentType(name: string) {
  const n = String(name || '').toLowerCase()
  if (n.endsWith('.webm')) return 'video/webm'
  if (n.endsWith('.mp4') || n.endsWith('.mov')) return 'video/mp4'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}
