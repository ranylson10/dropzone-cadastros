'use client'

import { useEffect, useId, useState, type MouseEvent } from 'react'
import { Building2, Check, ChevronRight, LayoutDashboard, Loader2, LogIn, Search, Shield, UserRound } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { EntityAvatar } from '@/components/entities/EntityAvatar'
import { Input } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { workspaceHref } from '@/features/dropzone/WorkspaceContextSwitcher'

const GROUPS = [
  { type: 'equipe', label: 'Equipes', singular: 'Equipe', icon: Shield },
  { type: 'produtora', label: 'Produtoras', singular: 'Produtora', icon: Building2 },
  { type: 'jogador', label: 'Jogadores', singular: 'Jogador', icon: UserRound },
] as const

type PanelState = { status: 'loading' | 'guest' | 'ready' | 'error'; contexts: DropZoneRow[] }
type Props = {
  activeAccountId?: string
  active?: boolean
  className?: string
  label?: string
  onBeforeOpen?: () => void
  onSelect?: (context: DropZoneRow) => void | Promise<void>
}

/** The server's context list is authoritative; browser snapshots never grant access. */
export function WorkspacePanelSwitcher({ activeAccountId, active = false, className = '', label, onBeforeOpen, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PanelState>({ status: 'loading', contexts: [] })
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [currentId, setCurrentId] = useState('')
  const [pending, setPending] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const searchId = useId()

  useEffect(() => {
    if (!open) return
    let alive = true, expired = false, signedOut = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      expired = true
      controller.abort()
      if (alive && !signedOut) setState({ status: 'error', contexts: [] })
    }, 12_000)
    async function load() {
      setState({ status: 'loading', contexts: [] })
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!alive || expired || signedOut) return
        if (error) throw error
        if (!data.session) { setState({ status: 'guest', contexts: [] }); return }
        const response = await fetch('/api/me/contexts', {
          cache: 'no-store', signal: controller.signal,
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        const payload = await response.json()
        if (!response.ok) throw new Error('Não foi possível carregar seus painéis.')
        if (!alive || expired || signedOut) return
        const contexts: DropZoneRow[] = Array.isArray(payload.contexts)
          ? payload.contexts.filter((item: DropZoneRow) => item && item.id && GROUPS.some(group => group.type === item.profile_type)) : []
        let preferred = activeAccountId || ''
        try { preferred ||= localStorage.getItem('dropzone_active_profile_id') || '' } catch { /* optional preference */ }
        setCurrentId(preferred)
        setState({ status: 'ready', contexts })
      } catch {
        if (alive && !expired && !signedOut) setState({ status: 'error', contexts: [] })
      } finally { window.clearTimeout(timeout) }
    }
    void load()
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event !== 'SIGNED_OUT') return
      signedOut = true
      controller.abort()
      window.clearTimeout(timeout)
      if (alive) setState({ status: 'guest', contexts: [] })
    })
    return () => { alive = false; controller.abort(); window.clearTimeout(timeout); listener.subscription.unsubscribe() }
  }, [open, revision, activeAccountId])

  function show(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.focus({ preventScroll: true })
    onBeforeOpen?.()
    setQuery('')
    setSelectionError('')
    setPending('')
    setState({ status: 'loading', contexts: [] })
    setOpen(true)
  }

  async function select(event: MouseEvent<HTMLAnchorElement>, context: DropZoneRow) {
    if (pending) { event.preventDefault(); return }
    // A native link remounts the root page, whose initialisation consumes perfil_id.
    // Within an already mounted workspace, use its existing context transition.
    if (!onSelect) { setOpen(false); return }
    event.preventDefault()
    setPending(`${context.profile_type}:${context.id}`)
    setSelectionError('')
    try { await onSelect(context); setOpen(false) }
    catch { setSelectionError('Não foi possível abrir este painel. Tente novamente.') }
    finally { setPending('') }
  }

  const filtered = state.contexts.filter(item => `${item.name || ''} ${item.username || ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))
  return <>
    <button type="button" className={`${className} ${open || active ? 'active' : ''}`.trim()}
      aria-label={label ? `Abrir meus painéis: ${label}` : 'Abrir meus painéis'} aria-haspopup="dialog" aria-expanded={open} onClick={show}>
      <LayoutDashboard size={20} aria-hidden="true" /><span>{label || 'Painéis'}</span>
    </button>
    <Dialog open={open} title="Seus painéis" description="Escolha o perfil que você quer operar."
      onClose={() => setOpen(false)} closeLabel="Fechar seletor de painéis" size="medium" className="dz-panel-switcher">
      {state.status === 'loading' ? <div className="dz-panel-switcher-state" role="status"><Loader2 size={22} className="spin" aria-hidden="true" />Carregando seus painéis…</div> : null}
      {state.status === 'guest' ? <div className="dz-panel-switcher-state">
        <LogIn size={28} aria-hidden="true" /><strong>Seus perfis, no mesmo lugar.</strong>
        <p>Entre na sua conta para acessar suas equipes, produtoras e jogadores.</p>
        <a className="button" href="/login?returnTo=%2F%3Fpainel%3D1">Entrar na minha conta</a>
      </div> : null}
      {state.status === 'error' ? <div className="dz-panel-switcher-state" role="alert">
        <p>Não foi possível carregar seus painéis.</p>
        <button type="button" className="button secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
      </div> : null}
      {state.status === 'ready' ? <>
        {state.contexts.length > 6 ? <label className="dz-panel-switcher-search" htmlFor={searchId}>
          <Search size={18} aria-hidden="true" /><Input id={searchId} aria-label="Buscar painel" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome" />
        </label> : null}
        {GROUPS.map(group => {
          const items = filtered.filter(item => item.profile_type === group.type)
          if (!items.length) return null
          const Icon = group.icon
          return <section className="dz-panel-switcher-group" key={group.type} aria-label={group.label}>
            <h3><Icon size={16} aria-hidden="true" />{group.label}<span>{items.length}</span></h3>
            <div data-dz-list="true">{items.map(item => {
              const key = `${item.profile_type}:${item.id}`
              const selected = item.id === currentId
              return <a key={key} data-dz-list-item="true" className="dz-panel-switcher-row" href={workspaceHref(item)}
                aria-current={selected ? 'true' : undefined} aria-disabled={Boolean(pending)} onClick={event => void select(event, item)}>
                <EntityAvatar name={item.name || item.username || group.singular} image={item.data?.logo_url || item.data?.foto_url || item.data?.avatar_url} size="sm" />
                <span><strong>{item.name || item.username || group.singular}</strong><small>{group.singular}{item.data?.delegated_access === true ? ' · Vice-líder' : ''}</small></span>
                {pending === key ? <Loader2 size={18} className="spin" aria-label="Abrindo painel" /> : selected ? <Check size={18} aria-label="Painel em uso" /> : <ChevronRight size={18} aria-hidden="true" />}
              </a>
            })}</div>
          </section>
        })}
        {!state.contexts.length ? <div className="dz-panel-switcher-state"><LayoutDashboard size={28} aria-hidden="true" /><strong>Nenhum painel vinculado.</strong><p>Seus perfis e os acessos liberados para você aparecem aqui.</p><a className="button secondary" href="/?cadastro=equipe">Criar equipe</a></div> : null}
        {state.contexts.length > 0 && !filtered.length ? <p className="dz-panel-switcher-state" role="status">Nenhum painel encontrado.</p> : null}
        {selectionError ? <p role="alert">{selectionError}</p> : null}
      </> : null}
    </Dialog>
  </>
}
