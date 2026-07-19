'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout'
import { supabase } from '@/lib/supabase-browser'
import { AgendaCalendar } from './AgendaCalendar'

export function AgendaPageClient() {
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(Boolean(data.session))
      setReady(true)
    })
  }, [])

  return (
    <AppShell activeLabel="Agenda" loadSession mainClassName="directory-page page page-authenticated">
      <div className="directory-page-body" style={{ paddingTop: 18 }}>
        {!ready ? (
          <div className="agenda-empty-month">Carregando...</div>
        ) : !loggedIn ? (
          <section className="agenda-root">
            <div className="agenda-toolbar">
              <div className="agenda-toolbar-copy">
                <p className="eyebrow">Agenda</p>
                <h2>Sua agenda competitiva</h2>
              </div>
            </div>
            <div className="agenda-error" style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--line)' }}>
              Faça login para ver jogos dos seus campeonatos/equipes e adicionar horários livres.{' '}
              <a href="/login?returnTo=/agenda">Entrar agora</a>
            </div>
          </section>
        ) : (
          <AgendaCalendar
            title="MINHA AGENDA"
            scope="me"
            canCreate
          />
        )}
      </div>
    </AppShell>
  )
}
