import { supabase } from '@/lib/supabase-browser'

/** Upload PNG público via /api/upload (precisa sessão). */
export async function uploadPublicFile(
  file: File,
  bucket: string,
  profileType?: string | null,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })

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
      content_type: 'image/png',
      data_url: dataUrl,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao enviar arquivo.')
  return String(json.url || '')
}
