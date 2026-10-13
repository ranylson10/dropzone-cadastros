'use client'

import { useCallback, useEffect, useRef } from 'react'
import { dialogTabStops } from './dialog-layer'

/** Nonmodal popup: enter its controls, dismiss on Escape or when focus leaves.
 * Modal surfaces use Dialog, which also isolates the background. */
export function useDisclosureFocus<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, focusFirstControl = true) {
  const panelRef = useRef<T>(null)
  const originRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const close = useCallback((restoreFocus = false) => {
    onCloseRef.current()
    const origin = originRef.current
    if (restoreFocus && origin?.isConnected && !origin.closest('[inert]') && origin.getClientRects().length) {
      origin.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!open || !panelRef.current) return
    const panel = panelRef.current
    const openingWidth = window.innerWidth
    originRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (focusFirstControl) dialogTabStops(panel)[0]?.focus({ preventScroll: true })

    function outside(target: EventTarget | null) {
      return target instanceof Node && !panel.contains(target) && !originRef.current?.contains(target)
    }
    function onFocus(event: FocusEvent) { if (outside(event.target)) close() }
    function onPointer(event: PointerEvent) { if (outside(event.target)) close() }
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== 'Escape') return
      const target = document.activeElement
      if (!panel.contains(target) && !originRef.current?.contains(target)) return
      event.preventDefault()
      close(true)
    }
    function onResize() { if (window.innerWidth !== openingWidth || !panel.getClientRects().length) close() }

    document.addEventListener('focusin', onFocus)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, close, focusFirstControl])

  return { panelRef, close }
}
