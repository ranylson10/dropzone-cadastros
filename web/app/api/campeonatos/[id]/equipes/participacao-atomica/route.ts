import type { NextRequest } from 'next/server'
import { atomicOperationRequest } from '@/lib/atomic-operation-request'
import { POST as post, PATCH as patch, DELETE as remove } from '../route'

type Context = { params: Promise<{ id: string }> }
// A deployment without this endpoint returns 404/405; clients never retry the legacy URL.
export function POST(request: NextRequest, context: Context) { return post(atomicOperationRequest(request, 'participation'), context) }
export function PATCH(request: NextRequest, context: Context) { return patch(atomicOperationRequest(request, 'participation'), context) }
export function DELETE(request: NextRequest, context: Context) { return remove(atomicOperationRequest(request, 'participation'), context) }
