'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

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
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="system-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`system-modal system-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="system-modal-header">
          <div>
            <p className="eyebrow">DropZone</p>
            <h2 id="system-modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="system-modal-close" type="button" onClick={onClose} aria-label="Fechar janela">
            <X size={20} />
          </button>
        </header>
        <div className="system-modal-content">{children}</div>
      </section>
    </div>
  )
}
