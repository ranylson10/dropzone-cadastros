import { supabaseAdmin } from '../shared/supabase-admin'

export async function findRegisteredAuthUserByEmail(email: string) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find((item) => String(item.email || '').trim().toLowerCase() === normalized)
    if (found) return found
    if (data.users.length < 1000) break
  }
  return null
}
