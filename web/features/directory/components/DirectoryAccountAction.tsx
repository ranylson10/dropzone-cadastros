'use client'

import { ArrowUpRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import type { DirectoryKind } from '../types'
import './directory-account-action.css'

type ProfileType = 'equipe' | 'jogador' | 'produtora' | 'manager'
type ActionState = { status: 'loading' | 'guest' | 'ready' | 'error'; profiles: Set<ProfileType> }

const ACTIONS: Partial<Record<DirectoryKind, { profile: ProfileType; create: string; own: string }>> = {
  equipes: { profile: 'equipe', create: 'Criar equipe', own: 'Minha equipe' },
  jogadores: { profile: 'jogador', create: 'Criar jogador', own: 'Meu perfil' },
  managers: { profile: 'manager', create: 'Criar manager', own: 'Meu painel' },
  produtoras: { profile: 'produtora', create: '', own: 'Minha produtora' },
}

/** Exibe ações apenas com base nos perfis confirmados por /api/me. */
export function DirectoryAccountAction({ kind }: { kind: DirectoryKind }) {
  const [state, setState] = useState<ActionState>({ status: 'loading', profiles: new Set() })

  useEffect(() => {
    let alive = true
    let request = 0
    async function refresh(token?: string | null) {
      const current = ++request
      setState({ status: 'loading', profiles: new Set() })
      try {
        let accessToken = token
        if (!accessToken) {
          const { data } = await supabase.auth.getSession()
          accessToken = data.session?.access_token
        }
        if (!alive || current !== request) return
        if (!accessToken) {
          setState({ status: 'guest', profiles: new Set() })
          return
        }
        const response = await fetch('/api/me', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) throw new Error('Não foi possível verificar os perfis')
        const payload = await response.json()
        if (!alive || current !== request) return
        const profiles = new Set<ProfileType>()
        for (const account of Array.isArray(payload.accounts) ? payload.accounts : []) {
          const type = account?.profile_type
          if (type === 'equipe' || type === 'jogador' || type === 'produtora' || type === 'manager') {
            profiles.add(type)
          }
        }
        setState({ status: 'ready', profiles })
      } catch {
        if (alive && current === request) setState({ status: 'error', profiles: new Set() })
      }
    }

    void refresh()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Adia fetch para fora do callback de auth (evita bloqueios do cliente Supabase).
      window.setTimeout(() => { if (alive) void refresh(session?.access_token) }, 0)
    })
    return () => { alive = false; request++; data.subscription.unsubscribe() }
  }, [])

  if (state.status === 'loading' || state.status === 'error') return null

  if (kind === 'campeonatos') {
    // Criação de campeonato somente para quem possui produtora verificada.
    if (!state.profiles.has('produtora')) return null
    return (
      <nav className="dz-directory-account-actions" aria-label="Minha produtora e campeonatos">
        <a className="dz-directory-account-action primary" href="/?painel=1&perfil=produtora&acao=criar-campeonato">
          <Plus size={17} aria-hidden="true" /> Criar campeonato
        </a>
        <a className="dz-directory-account-action secondary" href="/?painel=1&perfil=produtora&section=campeonatos">
          Meus campeonatos <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </nav>
    )
  }

  const action = ACTIONS[kind]
  if (!action) return null
  const ownsProfile = state.profiles.has(action.profile)
  // Produtoras são criadas por convite da administração; nunca oferecemos cadastro livre.
  if (kind === 'produtoras' && !ownsProfile) return null
  const href = ownsProfile
    ? `/?painel=1&perfil=${action.profile}`
    : state.status === 'guest'
      ? `/login?mode=criar&profileType=${action.profile}&returnTo=${encodeURIComponent(`/?cadastro=${action.profile}`)}`
      : `/?cadastro=${action.profile}`
  const label = ownsProfile ? action.own : action.create

  return (
    <nav className="dz-directory-account-actions" aria-label={`Acesso ao meu perfil de ${kind}`}>
      <a className="dz-directory-account-action primary" href={href}>
        {ownsProfile ? <ArrowUpRight size={16} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
        {label}
      </a>
    </nav>
  )
}
