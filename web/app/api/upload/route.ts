import { NextRequest, NextResponse } from 'next/server'
import { getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin, serviceRoleKey, supabaseUrl } from '@backend/shared/supabase-admin'

export const runtime = 'nodejs'

type UploadPayload = {
  bucket?: string
  file_name?: string
  data_url?: string
  base64?: string
}

const ALLOWED_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'campeonato'])
const PROFILE_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager'])
const MAX_FILE_SIZE = 5 * 1024 * 1024
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

function normalizeBase64(payload: UploadPayload) {
  const raw = String(payload.data_url || payload.base64 || '').replace(/^\uFEFF/, '').trim()
  if (!raw) throw new Error('Imagem ausente.')

  if (raw.startsWith('data:')) {
    const commaIndex = raw.indexOf(',')
    if (commaIndex === -1) throw new Error('Imagem em base64 invalida.')
    const header = raw.slice(0, commaIndex).toLowerCase()
    if (!header.includes('image/png')) throw new Error('A imagem final precisa estar em PNG.')
    return raw.slice(commaIndex + 1).replace(/\s/g, '')
  }

  return raw.replace(/\s/g, '')
}

async function ensureBucket(bucket: string) {
  const config = {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE}`,
    allowedMimeTypes: ['image/png'],
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

async function uploadToStorage(bucket: string, path: string, buffer: Buffer) {
  const endpoint = `${cleanHeader(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: cleanHeader(serviceRoleKey),
      Authorization: `Bearer ${cleanHeader(serviceRoleKey)}`,
      'Content-Type': 'image/png',
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

function assertCanUpload(bucket: string, profileType?: string | null) {
  // Manager pode subir logo de equipe (lines que gerencia)
  if (profileType === 'manager' && (bucket === 'manager' || bucket === 'equipe')) return
  if (PROFILE_BUCKETS.has(bucket) && bucket !== profileType) {
    throw new Error('Este perfil nao pode enviar arquivos para esse bucket.')
  }
  if (bucket === 'campeonato' && profileType !== 'produtora') {
    throw new Error('Somente produtoras podem enviar imagens de campeonato.')
  }
}

/**
 * Resolve o tipo de perfil para permissão de upload.
 * - Conta DropZone existente: usa o perfil ativo
 * - Onboarding (login social sem perfil ainda): aceita x-profile-type se for bucket de perfil
 */
async function resolveUploadProfileType(
  req: NextRequest,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null },
) {
  const headerType = String(req.headers.get('x-profile-type') || '').trim()
  try {
    const account = await getActiveAccount(req, user)
    return account.profile_type as string
  } catch (error: any) {
    const msg = String(error?.message || '')
    // Criando o 1º perfil: autenticado no Supabase, sem row em produtoras/equipes/etc.
    if (msg.includes('Conta nao encontrada') || msg.includes('Conta não encontrada')) {
      if (PROFILE_BUCKETS.has(headerType)) return headerType
    }
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const profileType = await resolveUploadProfileType(req, user)
    const payload = (await req.json()) as UploadPayload
    const bucket = String(payload.bucket || '').replace(/^\uFEFF/, '').trim()

    if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Bucket invalido.')
    assertCanUpload(bucket, profileType)

    const base64 = normalizeBase64(payload)
    const buffer = Buffer.from(base64, 'base64')

    if (!buffer.length) throw new Error('Imagem vazia.')
    if (buffer.length > MAX_FILE_SIZE) throw new Error('Imagem muito pesada. Limite: 5 MB.')
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error('Imagem invalida. Recorte novamente para gerar PNG antes de enviar.')
    }

    await ensureBucket(bucket)

    const baseName = safeName(payload.file_name || bucket).replace(/\.png$/i, '') || bucket
    const path = `${Date.now()}-${crypto.randomUUID()}-${baseName}.png`

    await uploadToStorage(bucket, path, buffer)

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path, bucket })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao enviar arquivo.' }, { status: 400 })
  }
}
