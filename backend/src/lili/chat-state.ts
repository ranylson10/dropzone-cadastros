import type { NextRequest } from 'next/server'
import type { getBearerUser } from '@backend/auth/server-auth'
import type { LiliChatResponse, LiliClientContext, LiliIntent, LiliLocale } from './types'

export type LiliChatState = {
  req: NextRequest
  user: Awaited<ReturnType<typeof getBearerUser>> | null
  message: string
  context: LiliClientContext
  locale: LiliLocale
  match: { intent: LiliIntent; confidence: number; source: 'rule' | 'pattern' | 'gemini' | 'system'; searchTerm?: string; locale?: LiliLocale }
}
export type LiliIntentHandler = (state: LiliChatState) => Promise<LiliChatResponse>
