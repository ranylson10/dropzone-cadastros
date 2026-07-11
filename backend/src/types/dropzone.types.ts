export const PROFILE_TYPES = ['produtora', 'equipe', 'jogador', 'manager'] as const

export type ProfileType = (typeof PROFILE_TYPES)[number]

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
