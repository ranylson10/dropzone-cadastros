import { PROFILE_TYPES, type ProfileType } from './types'

export function cleanUsername(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
}

export function assertProfileType(value: unknown): ProfileType {
  if (PROFILE_TYPES.includes(value as ProfileType)) return value as ProfileType
  throw new Error('Tipo de perfil invalido.')
}

export function assertUsername(value: unknown) {
  const username = cleanUsername(value)
  if (!/^[a-z0-9._]{3,24}$/.test(username)) {
    throw new Error('Use um login com 3 a 24 caracteres: letras, numeros, ponto ou underline.')
  }
  return username
}

export function cleanEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail valido.')
  return email
}

// Mantem um login tecnico unico no Supabase Auth por tipo + usuario.
// Assim o mesmo e-mail de contato pode ter um perfil de equipe, jogador, produtora e manager.
export function authEmail(profileType: ProfileType, username: string) {
  return `${profileType}.${username}@dropzone.local`
}

export function randomToken(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const body = Array.from(bytes)
    .map((byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12)
    .toUpperCase()
  return `${prefix}-${body}`
}
