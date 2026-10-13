import { SlotTransferError } from './slot-transfer'

// No atomic lifecycle RPC has been reviewed or installed. A flag must not
// reactivate the former parallel HTTP writes.
export const lifecycleWriteMode = 'unavailable' as const

export function assertLifecycleActionSafe(action: string) {
  if (action === 'publish_final' || action === 'reopen_final') {
    throw new SlotTransferError('Encerramento e reabertura temporariamente indisponíveis.', 503)
  }
}
