export const PROFILE_TYPES = ['produtora', 'equipe', 'jogador', 'manager', 'broadcast'] as const

export type ProfileType = (typeof PROFILE_TYPES)[number]

/** Perfis que fazem parte do produto Web. `broadcast` fica somente como legado técnico/integracao. */
export const WEB_PROFILE_TYPES = ['produtora', 'equipe', 'jogador', 'manager'] as const
export type WebProfileType = (typeof WEB_PROFILE_TYPES)[number]

export function isWebProfileType(value: unknown): value is WebProfileType {
  return WEB_PROFILE_TYPES.includes(value as WebProfileType)
}

/** Papéis do perfil Broadcast (MVP foca em stream). */
export const BROADCAST_PAPEIS = ['stream', 'narrador', 'comentarista', 'apresentador'] as const
export type BroadcastPapel = (typeof BROADCAST_PAPEIS)[number]

export type DropZoneRow = {
  id: string
  entity_type: string
  auth_user_id: string | null
  profile_type: ProfileType | null
  username: string | null
  name: string | null
  public_id?: number | null
  token: string | null
  parent_id: string | null
  ref_id: string | null
  status: string
  data: Record<string, any>
  created_by: string | null
  created_at: string
  updated_at: string
}
