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
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#0f1420',
      color: '#fff',
      padding: 24,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    }}>
      <section style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 28,
        background: '#151b27',
        border: '1px solid rgba(255,255,255,.12)',
        padding: 28,
        textAlign: 'center',
        boxShadow: '0 24px 70px rgba(0,0,0,.35)',
      }}>
        <p style={{
          margin: 0,
          color: '#d7ae28',
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}>
          DropZone Mobile
        </p>
        <h1 style={{ margin: '14px 0 10px', fontSize: 30, lineHeight: 1.05 }}>
          Voltando para o app
        </h1>
        <p style={{ margin: '0 0 22px', color: '#cbd5e1', lineHeight: 1.5 }}>
          Se o DropZone não abrir automaticamente, toque no botão abaixo.
        </p>
        <a
          href={appUrl}
          style={{
            display: 'block',
            borderRadius: 18,
            background: '#ff4058',
            color: '#fff',
            padding: '16px 18px',
            fontWeight: 900,
            textDecoration: 'none',
            textTransform: 'uppercase',
          }}
        >
          Abrir DropZone
        </a>
      </section>
    </main>
  )
}
