'use client'

import type { ReactNode } from 'react'
import { Dialog } from '@/components/ui'

/**
 * Compatibilidade para os módulos existentes. A implementação real vive no
 * primitive compartilhado Dialog, evitando arquiteturas paralelas de modal.
 */
export function SystemModal({
  open,
  title,
  description,
  children,
  onClose,
  size = 'large',
}: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  size?: 'medium' | 'large' | 'wide'
}) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose} size={size}>
      {children}
    </Dialog>
  )
}
