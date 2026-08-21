'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Trophy } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { supabase } from '@/lib/supabase-browser'
import { AgendaCalendar } from './AgendaCalendar'
import type { AgendaScope } from '../types/agenda.types'

export function AgendaPageClient() {
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const filter = useMemo(() => {
    const rawScope = String(searchParams.get('scope') || 'me')
    const scope: AgendaScope = rawScope === 'campeonato' || rawScope === 'equipe' ? rawScope : 'me'
    return { scope, scopeId: String(searchParams.get('id') || searchParams.get('scopeId') || '').trim() || null }
  }, [searchParams])
  const isProfileAgenda = filter.scope !== 'me' && Boolean(filter.scopeId)
  const title = filter.scope === 'campeonato' ? 'AGENDA DO CAMPEONATO' : filter.scope === 'equipe' ? 'AGENDA DA EQUIPE' : 'MINHA AGENDA'

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(Boolean(data.session))
      setReady(true)
    })
  }, [])

  return (
    <AppShell
      activeLabel="Agenda"
      loadSession
      withAuthOffset={false}
      mainClassName="agenda-page page directory-page"
    >
      <div className="agenda-page-body">
        {!ready ? (
          <div className="agenda-empty-month">Carregando...</div>
        ) : !loggedIn && !isProfileAgenda ? (
          <section className="agenda-root agenda-guest">
            <div className="agenda-toolbar">
              <div className="agenda-toolbar-copy">
                <p className="eyebrow">Agenda</p>
                <h2>Sua agenda competitiva</h2>
              </div>
            </div>
            <div className="agenda-guest-card">
              <span className="agenda-guest-icon"><CalendarDays size={24} /></span>
              <div className="agenda-guest-copy">
                <p className="eyebrow">Agenda pessoal</p>
                <h3>Centralize seus jogos e horários</h3>
                <p>Entre para acompanhar os jogos dos seus campeonatos e equipes em uma agenda única.</p>
              </div>
              <div className="agenda-guest-actions">
                <a className="button" href="/login?returnTo=/agenda">Entrar na minha agenda <ArrowRight size={15} /></a>
                <a className="button secondary" href="/campeonatos"><Trophy size={15} /> Ver campeonatos</a>
              </div>
            </div>
            <div className="agenda-error" style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--line)' }}>
              Faça login para ver os jogos vinculados ao seu perfil.{' '}
              <a href="/login?returnTo=/agenda">Entrar agora</a>
            </div>
          </section>
        ) : (
          <AgendaCalendar
            title={title}
            scope={filter.scope}
            scopeId={filter.scopeId}
          />
        )}
      </div>
    </AppShell>
  )
}
