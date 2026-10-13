'use client'

import { useEffect, useMemo } from 'react'

const APP_CALLBACK = 'dropzone://auth/callback'

function buildAppUrl() {
  if (typeof window === 'undefined') return APP_CALLBACK
  return `${APP_CALLBACK}${window.location.search || ''}${window.location.hash || ''}`
}

export default function MobileAuthCallbackPage() {
  const appUrl = useMemo(() => buildAppUrl(), [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(appUrl)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [appUrl])

  return (
    <main className="mobile-callback-page">
      <section className="mobile-callback-card">
        <p className="mobile-callback-kicker">DropZone Mobile</p>
        <h1>Voltando para o app</h1>
        <p>Se o DropZone não abrir automaticamente, toque no botão abaixo.</p>
        <a className="mobile-callback-action" href={appUrl}>Abrir DropZone</a>
      </section>
    </main>
  )
}
