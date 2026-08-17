'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout'

export default function AtualizarSenhaPage() {
  useEffect(() => {
    window.location.replace('/login?recovery=1')
  }, [])

  return (
    <AppShell header="never" withAuthOffset={false} mainClassName="login-portal" activeLabel="Início">
      <section className="login-portal-stage">
        <div className="login-portal-media" aria-hidden="true" />
        <div className="login-portal-overlay" aria-hidden="true" />
        <div className="login-portal-loading" role="status" aria-live="polite">
          <Loader2 className="spin" size={30} />
          <strong>Abrindo recuperação</strong>
          <span>A recuperação de senha agora é confirmada por código dentro do DropZone.</span>
        </div>
      </section>
    </AppShell>
  )
}
