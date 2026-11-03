'use client'

import { ArrowUpRight, Plus } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { workspaceHref } from '@/features/dropzone/WorkspaceContextSwitcher'
import type { DirectoryKind } from '../types'
import './directory-account-action.css'

const ACTIONS = {
  equipes: { profile: 'equipe', create: 'Criar equipe', own: 'Minha equipe' },
  jogadores: { profile: 'jogador', create: 'Criar jogador', own: 'Meus jogadores' },
  produtoras: { profile: 'produtora', create: '', own: 'Minha produtora' },
} as const

/** Only server-confirmed owned and delegated contexts can open a private panel. */
export function DirectoryAccountAction({ kind }: { kind: DirectoryKind }) {
  const [state, setState] = useState<{ status: 'loading' | 'guest' | 'ready' | 'error'; contexts: DropZoneRow[] }>({ status: 'loading', contexts: [] })
  const [selectedId, setSelectedId] = useState('')
  const id = useId()
  useEffect(() => {
    let alive = true
    let version = 0
    async function refresh(token?: string | null) {
      const current = ++version
      try {
        const accessToken = token || (await supabase.auth.getSession()).data.session?.access_token
        if (!alive || current !== version) return
        if (!accessToken) { setState({ status: 'guest', contexts: [] }); return }
        const response = await fetch('/api/me/contexts', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error)
        if (alive && current === version) setState({ status: 'ready', contexts: Array.isArray(payload.contexts) ? payload.contexts : [] })
      } catch {
        if (alive && current === version) setState({ status: 'error', contexts: [] })
      }
    }
    void refresh()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { if (alive) void refresh(session?.access_token) }, 0)
    })
    return () => { alive = false; version++; data.subscription.unsubscribe() }
  }, [])

  if (state.status === 'loading') return null
  if (state.status === 'error') return <p className="dz-context-role" role="status">Não foi possível verificar suas áreas. <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></p>
  if (kind === 'managers') return null
  const action = kind === 'campeonatos' ? null : ACTIONS[kind as keyof typeof ACTIONS]
  const choices = state.contexts.filter(item => kind === 'campeonatos'
    ? ['produtora', 'equipe', 'jogador'].includes(item.profile_type || '')
    : item.profile_type === action?.profile)
  const selected = choices.find(item => item.id === selectedId) || choices[0]
  const section = kind === 'campeonatos' ? selected?.profile_type === 'jogador' ? 'competicoes' : 'campeonatos' : undefined

  if (selected) return <nav className="dz-directory-account-actions" aria-label={`Minha área em ${kind}`}>
    {choices.length > 1 ? <div className="dz-directory-context-picker">
      <label htmlFor={id}>{kind === 'campeonatos' ? 'Gerenciar como' : kind === 'equipes' ? 'Trocar equipe' : kind === 'jogadores' ? 'Trocar jogador' : 'Trocar produtora'}</label>
      <select id={id} value={selected.id} onChange={event => setSelectedId(event.target.value)}>
        {choices.map(item => <option key={`${item.profile_type}:${item.id}`} value={item.id}>{item.name || item.username}{item.data?.delegated_access ? ' · Vice-líder' : ''}</option>)}
      </select>
    </div> : null}
    <a className="dz-directory-account-action primary" href={workspaceHref(selected, section)}>{kind === 'campeonatos' ? 'Meus campeonatos' : action?.own}<ArrowUpRight size={17} aria-hidden="true" /></a>
    {kind === 'campeonatos' && selected.profile_type === 'produtora' && !selected.data?.delegated_access ? <a className="dz-directory-account-action secondary" href={`${workspaceHref(selected, 'campeonatos')}&acao=criar-campeonato`}><Plus size={17} /> Criar campeonato</a> : null}
  </nav>
  if (!action || !action.create) return null
  const href = state.status === 'guest'
    ? `/login?mode=criar&profileType=${action.profile}&returnTo=${encodeURIComponent(`/?cadastro=${action.profile}`)}`
    : `/?cadastro=${action.profile}`
  return <nav className="dz-directory-account-actions" aria-label={`Minha área em ${kind}`}>
    <a className="dz-directory-account-action primary" href={href}><Plus size={17} aria-hidden="true" />{action.create}</a>
  </nav>
}
