'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BadgePercent, BarChart3, Link2, Megaphone, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { ManagerPanel } from '@/features/dropzone/panels/manager/ManagerPanel'

type PageState = {
  ready: boolean
  logged: boolean
  identity: { name?: string; username?: string; email?: string; avatar_url?: string } | null
  accounts: DropZoneRow[]
  affiliate: DropZoneRow | null
}

const initialState: PageState = { ready: false, logged: false, identity: null, accounts: [], affiliate: null }

export function AffiliatePage() {
  const [state, setState] = useState<PageState>(initialState)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        if (active) setState({ ...initialState, ready: true })
        return
      }

      const response = await fetch('/api/me', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        if (active) setState({ ...initialState, ready: true, logged: true })
        return
      }

      const payload = await response.json()
      const accounts = Array.isArray(payload.accounts) ? payload.accounts : []
      // O perfil manager continua sendo a identidade operacional legada usada
      // pelas tabelas de vendas. Nesta rota ele é apresentado apenas no papel
      // comercial; a área pública de managers permanece separada.
      const affiliate = accounts.find((item: DropZoneRow) => item.profile_type === 'manager') || null
      if (active) {
        setState({
          ready: true,
          logged: true,
          identity: payload.user || null,
          accounts,
          affiliate,
        })
      }
    }

    void load()
    const { data: listener } = supabase.auth.onAuthStateChange(() => window.setTimeout(load, 0))
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!state.ready) {
    return <AppShell activeLabel="Afiliados" loadSession><DropzoneLoader label="Carregando central de afiliados" /></AppShell>
  }

  if (state.affiliate) {
    return (
      <AppShell
        activeLabel="Afiliados"
        loadSession
        account={state.affiliate}
        identity={state.identity}
        accounts={state.accounts}
        mainClassName="affiliate-dashboard-page page-authenticated"
      >
        <div className="affiliate-dashboard-shell">
          <ManagerPanel account={state.affiliate} accounts={state.accounts} initialMode="vendas" />
        </div>
      </AppShell>
    )
  }

  const returnTo = encodeURIComponent('/afiliados')
  const actionHref = state.logged
    ? `/?login=manager&returnTo=${returnTo}`
    : `/login?returnTo=${returnTo}`

  return (
    <AppShell activeLabel="Afiliados" loadSession mainClassName="affiliate-page page-authenticated">
      <div className="affiliate-landing">
        <section className="affiliate-hero">
          <div className="affiliate-hero-copy">
            <p className="eyebrow">PROGRAMA DE AFILIADOS DROPZONE</p>
            <h1>Divulgue campeonatos.<br /><span>Ganhe por cada venda.</span></h1>
            <p className="affiliate-lead">
              Escolha campeonatos com vagas, compartilhe seu link e acompanhe suas vendas em uma central feita para afiliados.
            </p>
            <div className="affiliate-hero-actions">
              <a className="button primary" href={actionHref}>
                {state.logged ? 'Quero ser afiliado' : 'Começar agora'} <ArrowRight size={17} />
              </a>
              <a className="button secondary" href="#como-funciona">Como funciona</a>
            </div>
            <small className="affiliate-trust"><ShieldCheck size={14} /> Cadastro gratuito. A comissão é confirmada após a validação da venda.</small>
          </div>
          <div className="affiliate-hero-card" aria-label="Resumo do programa">
            <div className="affiliate-card-icon"><ShoppingBag size={28} /></div>
            <p>Transforme sua audiência em vendas</p>
            <strong>Campeonatos reais,<br />links rastreáveis.</strong>
            <div className="affiliate-mini-metrics">
              <span><BadgePercent size={16} /> Comissão definida por oferta</span>
              <span><BarChart3 size={16} /> Vendas acompanhadas no painel</span>
              <span><Wallet size={16} /> Valores validados na carteira</span>
            </div>
          </div>
        </section>

        <section className="affiliate-benefits" id="como-funciona">
          <div className="affiliate-section-title">
            <p className="eyebrow">SIMPLES E TRANSPARENTE</p>
            <h2>Você vende. A DropZone acompanha.</h2>
          </div>
          <div className="affiliate-benefit-grid">
            <article><Megaphone size={24} /><b>1</b><h3>Escolha uma oferta</h3><p>Veja os campeonatos liberados, vagas disponíveis e a comissão antes de divulgar.</p></article>
            <article><Link2 size={24} /><b>2</b><h3>Compartilhe seu link</h3><p>Crie uma venda rastreável e envie pelo WhatsApp, Instagram, TikTok ou onde preferir.</p></article>
            <article><Wallet size={24} /><b>3</b><h3>Receba sua comissão</h3><p>A venda paga e validada entra no acompanhamento financeiro, sem contar cancelamentos.</p></article>
          </div>
        </section>

        <section className="affiliate-cta">
          <div><p className="eyebrow">PRONTO PARA COMEÇAR?</p><h2>Abra sua central de afiliado.</h2></div>
          <a className="button primary" href={actionHref}>{state.logged ? 'Criar perfil de afiliado' : 'Entrar e participar'} <ArrowRight size={17} /></a>
        </section>
      </div>
    </AppShell>
  )
}
