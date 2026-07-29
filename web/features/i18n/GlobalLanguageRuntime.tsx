'use client'

import { useEffect } from 'react'
import { GLOBAL_LOCALE_EVENT, readGlobalLocale, type GlobalLocale } from './global-locale'

const originals = new WeakMap<Node, string>()
const attributeOriginals = new WeakMap<Element, Map<string, string>>()
const appliedValues = new WeakMap<Node, string>()
const appliedAttributes = new WeakMap<Element, Map<string, string>>()
const memory = new Map<string, string>()
const ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const
const SKIP_SELECTOR = 'script,style,code,pre,svg,[data-no-translate],.lili-hub-message-content'

function eligible(value: string) {
  const text = value.trim()
  return text.length >= 2 && text.length <= 500 && /[A-Za-zÀ-ÿ]/.test(text) && !/^https?:\/\//i.test(text)
}

function cacheKey(locale: GlobalLocale, value: string) {
  return `${locale}\u0000${value}`
}

function collect(root: ParentNode) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    const text = current as Text
    const parent = text.parentElement
    if (parent && !parent.closest(SKIP_SELECTOR) && eligible(text.nodeValue || '')) nodes.push(text)
    current = walker.nextNode()
  }
  const attributes: Array<{ element: Element; name: typeof ATTRIBUTES[number] }> = []
  const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')]
  for (const element of elements) {
    if (element.closest(SKIP_SELECTOR)) continue
    for (const name of ATTRIBUTES) if (eligible(element.getAttribute(name) || '')) attributes.push({ element, name })
  }
  return { nodes, attributes }
}

export function GlobalLanguageRuntime() {
  useEffect(() => {
    let locale = readGlobalLocale()
    let timer = 0
    let running = false
    let rerun = false
    let stopped = false

    async function translatePage() {
      if (running) {
        rerun = true
        return
      }
      running = true
      try {
        document.documentElement.lang = locale
        const { nodes, attributes } = collect(document.body)
        const targets: Array<{ original: string; apply: (value: string) => void }> = []
        for (const node of nodes) {
          const current = node.nodeValue || ''
          const lastApplied = appliedValues.get(node)
          if (!originals.has(node) || (lastApplied !== undefined && current !== lastApplied)) originals.set(node, current)
          const original = originals.get(node) || current
          targets.push({ original, apply: (value) => {
            appliedValues.set(node, value)
            if (node.isConnected && node.nodeValue !== value) node.nodeValue = value
          } })
        }
        for (const { element, name } of attributes) {
          let saved = attributeOriginals.get(element)
          if (!saved) {
            saved = new Map()
            attributeOriginals.set(element, saved)
          }
          let applied = appliedAttributes.get(element)
          if (!applied) {
            applied = new Map()
            appliedAttributes.set(element, applied)
          }
          const current = element.getAttribute(name) || ''
          if (!saved.has(name) || (applied.has(name) && current !== applied.get(name))) saved.set(name, current)
          const original = saved.get(name) || current
          targets.push({ original, apply: (value) => {
            applied!.set(name, value)
            if (element.isConnected && element.getAttribute(name) !== value) element.setAttribute(name, value)
          } })
        }
        if (locale === 'pt-BR') {
          targets.forEach((target) => target.apply(target.original))
          return
        }
        const unique = [...new Set(targets.map((target) => target.original.trim()).filter(eligible))]
        const missing = unique.filter((text) => !memory.has(cacheKey(locale, text)))
        for (let start = 0; start < missing.length; start += 60) {
          const texts = missing.slice(start, start + 60)
          const response = await fetch('/api/i18n/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale, texts }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || !Array.isArray(payload.translations)) continue
          texts.forEach((text, index) => memory.set(cacheKey(locale, text), String(payload.translations[index] || text)))
        }
        targets.forEach((target) => {
          const leading = target.original.match(/^\s*/)?.[0] || ''
          const trailing = target.original.match(/\s*$/)?.[0] || ''
          const translated = memory.get(cacheKey(locale, target.original.trim()))
          if (translated) target.apply(`${leading}${translated}${trailing}`)
        })
      } finally {
        running = false
        if (rerun && !stopped) {
          rerun = false
          window.clearTimeout(timer)
          timer = window.setTimeout(() => void translatePage(), 120)
        }
      }
    }

    function schedule() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void translatePage(), 140)
    }
    function languageChanged(event: Event) {
      locale = (event as CustomEvent<GlobalLocale>).detail || readGlobalLocale()
      void translatePage()
    }
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'childList' || mutation.type === 'characterData')) schedule()
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener(GLOBAL_LOCALE_EVENT, languageChanged)
    void translatePage()
    return () => {
      stopped = true
      observer.disconnect()
      window.clearTimeout(timer)
      window.removeEventListener(GLOBAL_LOCALE_EVENT, languageChanged)
    }
  }, [])
  return null
}
