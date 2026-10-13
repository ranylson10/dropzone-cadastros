import type { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'

export type EntityContext = {
  user: Awaited<ReturnType<typeof getBearerUser>>
  account: Awaited<ReturnType<typeof getActiveAccount>>
  origin: string
  invalidateTag: (tag: string) => void
  invalidatePath: (path: string) => void
}
