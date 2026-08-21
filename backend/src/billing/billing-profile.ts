import { supabaseAdmin } from '../shared/supabase-admin'

type BillingProfileRow = {
  auth_user_id: string
  nome_titular: string
  documento: string
  updated_at?: string
}

export type BillingProfilePublic = {
  name: string
  document_masked: string
  updated_at: string | null
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function validDocument(value: string) {
  return value.length === 11 || value.length === 14
}

export function maskBillingDocument(value: string) {
  const digits = onlyDigits(value)
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`
  return 'Documento protegido'
}

function toPublic(row: BillingProfileRow): BillingProfilePublic {
  return {
    name: String(row.nome_titular || 'Titular'),
    document_masked: maskBillingDocument(row.documento),
    updated_at: row.updated_at || null,
  }
}

export async function getBillingProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('sistema_perfis_cobranca')
    .select('auth_user_id,nome_titular,documento,updated_at')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? data as BillingProfileRow : null
}

/** Salva dados de cobrança, nunca dados de cartão. A rota pública só retorna o documento mascarado. */
export async function saveBillingProfile(input: { userId: string; name: string; document: string }) {
  const document = onlyDigits(input.document)
  const name = String(input.name || '').trim().slice(0, 120)
  if (!validDocument(document)) throw new Error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
  if (name.length < 3) throw new Error('Informe o nome do titular do pagamento.')

  const { data, error } = await supabaseAdmin
    .from('sistema_perfis_cobranca')
    .upsert({
      auth_user_id: input.userId,
      nome_titular: name,
      documento: document,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id' })
    .select('auth_user_id,nome_titular,documento,updated_at')
    .single()
  if (error) throw error
  return data as BillingProfileRow
}

/**
 * Resolve o perfil para uma cobrança direta. Se o cliente informar um novo
 * documento ele é salvo para as próximas compras; se não, reutiliza o perfil.
 */
export async function resolveBillingProfile(input: {
  userId: string
  fallbackName: string
  document?: string | null
  holderName?: string | null
}) {
  const suppliedDocument = onlyDigits(input.document)
  if (suppliedDocument) {
    const saved = await saveBillingProfile({
      userId: input.userId,
      name: String(input.holderName || input.fallbackName || '').trim(),
      document: suppliedDocument,
    })
    return { name: saved.nome_titular, document: saved.documento, public: toPublic(saved) }
  }

  const saved = await getBillingProfile(input.userId)
  if (!saved || !validDocument(onlyDigits(saved.documento))) {
    throw new Error('Ative seus dados de pagamento para continuar. Informe nome e CPF/CNPJ uma única vez.')
  }
  return { name: saved.nome_titular, document: saved.documento, public: toPublic(saved) }
}
