'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { dialogTabStops, focusDialog, isActiveDialog, registerDialog } from './dialog-layer'

let modalLockCount = 0
let previousBodyOverflow = ''

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (modalLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  modalLockCount += 1
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  modalLockCount = Math.max(0, modalLockCount - 1)
  if (modalLockCount === 0) document.body.style.overflow = previousBodyOverflow
}

export type DialogProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  size?: 'medium' | 'large' | 'wide'
  footer?: ReactNode
  closeLabel?: string
  closeOnBackdrop?: boolean
  className?: string
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  size = 'large',
  footer,
  closeLabel = 'Fechar janela',
  closeOnBackdrop = true,
  className = '',
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current, backdrop = backdropRef.current
    if (!panel || !backdrop) return
    if (!panel.contains(document.activeElement)) returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockBodyScroll()
    const unregister = registerDialog(panel, backdrop, returnFocusRef.current)

    function handleKeyDown(event: KeyboardEvent) {
      if (!isActiveDialog(panel!)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogTabStops(panel!)
      if (!focusable.length) {
        event.preventDefault()
        panel!.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!panel!.contains(document.activeElement) || document.activeElement === panel) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function handleFocus(event: FocusEvent) {
      if (isActiveDialog(panel!) && event.target instanceof Node && !panel!.contains(event.target)) focusDialog(panel!)
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocus)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocus)
      unregister()
      unlockBodyScroll()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={backdropRef}
      className="system-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && panelRef.current && isActiveDialog(panelRef.current) && event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={panelRef}
        className={`system-modal system-modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="system-modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton
            className="system-modal-close"
            label={closeLabel}
            icon={<X size={20} />}
            variant="ghost"
            onClick={onClose}
          />
        </header>
        <div className="system-modal-content">{children}</div>
        {footer ? <footer className="dz-dialog-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  )
}
