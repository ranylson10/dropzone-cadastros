type Layer = { panel: HTMLElement; backdrop: HTMLElement }
const layers: Layer[] = []
const originalInert = new Map<HTMLElement, boolean>()
let observer: MutationObserver | null = null

function syncBackground() {
  const active = layers[layers.length - 1]?.backdrop
  for (const [node, inert] of originalInert) {
    if (!active || node === active || !node.isConnected) {
      node.inert = inert
      originalInert.delete(node)
    }
  }
  if (!active) return
  for (const node of Array.from(document.body.children)) {
    if (!(node instanceof HTMLElement) || node === active || ['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)) continue
    if (!originalInert.has(node)) originalInert.set(node, node.inert)
    node.inert = true
  }
}

export function isActiveDialog(panel: HTMLElement) {
  return layers[layers.length - 1]?.panel === panel
}

function visible(node: HTMLElement) {
  return node.isConnected && !node.closest('[inert]') && !node.matches(':disabled') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
}

export function dialogTabStops(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex], [contenteditable="true"]'))
    .filter(node => node.tabIndex >= 0 && visible(node))
}

export function focusDialog(panel: HTMLElement) {
  const autofocus = Array.from(panel.querySelectorAll<HTMLElement>('[data-autofocus]')).find(visible)
  ;(autofocus || dialogTabStops(panel)[0] || panel).focus({ preventScroll: true })
}

export function registerDialog(panel: HTMLElement, backdrop: HTMLElement, previous: HTMLElement | null) {
  const layer = { panel, backdrop }
  layers.push(layer)
  layers.sort((left, right) => left.backdrop.compareDocumentPosition(right.backdrop) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
  syncBackground()
  focusDialog(panel)
  if (!observer) {
    observer = new MutationObserver(syncBackground)
    observer.observe(document.body, { childList: true })
  }
  return () => {
    const wasActive = isActiveDialog(panel)
    const index = layers.indexOf(layer)
    if (index < 0) return
    layers.splice(index, 1)
    syncBackground()
    if (!layers.length) { observer?.disconnect(); observer = null }
    const next = layers[layers.length - 1]
    if (wasActive) window.setTimeout(() => {
      // A subsequent open takes precedence over this delayed restoration.
      if (layers[layers.length - 1] !== next) return
      if (previous && visible(previous) && (!next || next.panel.contains(previous))) previous.focus({ preventScroll: true })
      else if (next) focusDialog(next.panel)
    }, 0)
  }
}
