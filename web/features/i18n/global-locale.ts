'use client'

import { useEffect, useState } from 'react'

export type GlobalLocale = 'pt-BR' | 'es' | 'en'
export const GLOBAL_LOCALE_KEY = 'dropzone:locale'
export const GLOBAL_LOCALE_EVENT = 'dropzone:locale-change'

export function normalizeGlobalLocale(value?: string | null): GlobalLocale {
  const locale = String(value || '').toLowerCase()
  if (locale.startsWith('es')) return 'es'
  if (locale.startsWith('en')) return 'en'
  return 'pt-BR'
}

export function readGlobalLocale(): GlobalLocale {
  if (typeof window === 'undefined') return 'pt-BR'
  return normalizeGlobalLocale(localStorage.getItem(GLOBAL_LOCALE_KEY) || 'pt-BR')
}

export function setGlobalLocale(locale: GlobalLocale) {
  const normalized = normalizeGlobalLocale(locale)
  localStorage.setItem(GLOBAL_LOCALE_KEY, normalized)
  document.documentElement.lang = normalized === 'pt-BR' ? 'pt-BR' : normalized
  window.dispatchEvent(new CustomEvent(GLOBAL_LOCALE_EVENT, { detail: normalized }))
}

export function useGlobalLocale() {
  const [locale, setLocale] = useState<GlobalLocale>('pt-BR')
  useEffect(() => {
    const update = (event?: Event) => {
      const detail = (event as CustomEvent<GlobalLocale> | undefined)?.detail
      setLocale(detail ? normalizeGlobalLocale(detail) : readGlobalLocale())
    }
    update()
    window.addEventListener(GLOBAL_LOCALE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(GLOBAL_LOCALE_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return [locale, setGlobalLocale] as const
}
