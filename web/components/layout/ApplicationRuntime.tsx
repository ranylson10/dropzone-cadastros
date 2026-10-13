'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { LiliGlobalLauncher } from '@/components/lili/LiliGlobalLauncher'
import { GlobalLanguageRuntime } from '@/features/i18n/GlobalLanguageRuntime'
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider'
import { CommerceProvider } from '@/features/commerce'

export function ApplicationRuntime({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname.startsWith('/broadcast/obs/')) return <>{children}</>
  return <FeedbackProvider><CommerceProvider>{children}<LiliGlobalLauncher /><GlobalLanguageRuntime /></CommerceProvider></FeedbackProvider>
}
