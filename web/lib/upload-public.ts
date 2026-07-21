import { supabase } from '@/lib/supabase-browser'

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

type UploadContext = { entityId?: string | null; campeonatoId?: string | null }

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
  const contentType = file.type || guessContentType(file.name)

  const prep = await fetch('/api/upload/signed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      bucket,
      file_name: file.name || `${bucket}-media`,
      content_type: contentType,
      size: file.size,
      entity_id: context?.entityId || null,
      campeonato_id: context?.campeonatoId || currentCampeonatoId(bucket),
    }),
  })
  const signed = await prep.json().catch(() => ({}))
  if (!prep.ok) throw new Error(signed.error || 'Falha ao preparar upload.')

  const put = await fetch(String(signed.signed_url), {
    method: 'PUT',
    headers: {
      'Content-Type': String(signed.content_type || contentType),
    },
    body: file,
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
