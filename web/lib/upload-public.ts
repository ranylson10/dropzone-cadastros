import { supabase } from '@/lib/supabase-browser'

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

/** Upload PNG público via /api/upload (precisa sessão). */
export async function uploadPublicFile(
  file: File,
  bucket: string,
  profileType?: string | null,
): Promise<string> {
  const dataUrl = await fileToDataUrl(file)

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(profileType ? { 'x-profile-type': profileType } : {}),
    },
    body: JSON.stringify({
      bucket,
      file_name: file.name || `${bucket}.png`,
      content_type: file.type || 'image/png',
      data_url: dataUrl,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao enviar arquivo.')
  return String(json.url || '')
}

/** Upload de mídia (PNG ou vídeo) — retorna url + content_type. */
export async function uploadPublicMedia(
  file: File,
  bucket: string,
  profileType?: string | null,
): Promise<{ url: string; content_type: string }> {
  const dataUrl = await fileToDataUrl(file)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(profileType ? { 'x-profile-type': profileType } : {}),
    },
    body: JSON.stringify({
      bucket,
      file_name: file.name || `${bucket}-media`,
      content_type: file.type || 'application/octet-stream',
      data_url: dataUrl,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao enviar arquivo.')
  return {
    url: String(json.url || ''),
    content_type: String(json.content_type || file.type || ''),
  }
}
