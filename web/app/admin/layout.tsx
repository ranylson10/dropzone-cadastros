import type { ReactNode } from 'react'

/** Evita prerender estático sem env do Supabase no build (Vercel preview). */
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
