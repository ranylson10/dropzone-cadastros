import { NextRequest } from 'next/server'
import { atomicOperationHeader, type AtomicOperationFamily } from '@backend/campeonatos/atomic-operation-route'

/** No body read here: the shared handler authenticates before checking this requirement. */
export function atomicOperationRequest(request: NextRequest, family: AtomicOperationFamily) {
  const headers = new Headers(request.headers)
  headers.set(atomicOperationHeader, family)
  return new NextRequest(request, { headers })
}
