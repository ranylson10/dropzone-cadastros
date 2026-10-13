import type { NextRequest } from 'next/server'
import { atomicOperationRequest } from '@/lib/atomic-operation-request'
import { PATCH as patch } from '../route'

export function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return patch(atomicOperationRequest(request, 'movement'), context)
}
