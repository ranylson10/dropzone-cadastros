'use client'

import { ShieldCheck, Ticket, UserRound } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { supabase } from '@/lib/supabase-browser'
import './venda-checkout.css'

type Sale = { token: string; status: string; quantity: number; expires_at: string; championship?: { name: string; logo_url?: string | null }; seller?: { name: string; avatar_url?: string | null } }

function digits(value: string) { return value.replace(/\D/g, '').slice(0, 14) }

export default function VendaCheckoutPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '').toUpperCase()
  const [sale, setSale] = useState<Sale | null>(null)
  const [access, setAccess] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [method, setMethod] = useState<'pix' | 'cartao' | 'paypal'>('pix')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const [saleResponse, sessionResult] = await Promise.all([
        fetch(`/api/vendas/${encodeURIComponent(token)}`, { cache: 'no-store' }),
        supabase.auth.getSession(),
      ])
      const payload = await saleResponse.json().catch(() => null)
      if (!saleResponse.ok) { if (active) { setError(payload?.error || 'Venda indisponível.'); setLoading(false) }; return }
      if (!active) return
      setSale(payload.sale)
      const bearer = sessionResult.data.session?.access_token || null
      setAccess(bearer)
      if (bearer) {
        const profileResponse = await fetch('/api/me/perfil-cobranca', { headers: { Authorization: `Bearer ${bearer}` }, cache: 'no-store' }).catch(() => null)
        const profilePayload = profileResponse?.ok ? await profileResponse.json().catch(() => null) : null
        if (active) { setProfile(profilePayload?.profile || null); setName(String(profilePayload?.profile?.name || '')) }
      }
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [token])

  async function checkout() {
    if (!access) return
    const ready = method === 'paypal' || profile || (name.trim().length >= 3 && [11, 14].includes(digits(document).length))
    if (!ready) { setError('Ative seus dados de pagamento: nome e CPF/CNPJ são solicitados uma única vez.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/vendas/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, billing_profile: !profile && method !== 'paypal' ? { name: name.trim(), document: digits(document) } : undefined }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível preparar o pagamento.')
      window.location.assign(payload.checkout_url || payload.claim_url)
    } catch (cause: any) { setError(cause?.message || 'Não foi possível preparar o pagamento.') } finally { setBusy(false) }
  }

  if (loading) return <main className="sale-checkout-page"><p>Preparando compra segura…</p></main>
  if (!sale) return <main className="sale-checkout-page"><section className="sale-checkout-card"><p className="sale-error">{error || 'Venda indisponível.'}</p><a className="sale-exit" href="/campeonatos">Ver campeonatos disponíveis</a></section></main>
  const returnTo = `/vendas/${encodeURIComponent(token)}`
  return <AppShell activeLabel="Compra segura" loadSession mainClassName="sale-checkout-page page page-authenticated">
    <section className="sale-checkout-card"><p>COMPRA COM AFILIADO</p><div className="sale-title"><Ticket/><div><h1>{sale.championship?.name || 'Campeonato'}</h1><span>{sale.quantity} vaga{sale.quantity > 1 ? 's' : ''} reservada{sale.quantity > 1 ? 's' : ''} nesta venda</span></div></div><div className="sale-seller"><UserRound size={16}/><span>Atendimento de <b>{sale.seller?.name || 'Afiliado DropZone'}</b></span></div>{!access ? <div className="sale-login"><strong>Entre para concluir a compra</strong><small>Depois do login você volta exatamente para este pagamento.</small><SocialLogin profileType="equipe" returnTo={returnTo}/></div> : <><label>Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="paypal">PayPal</option></select></label>{method !== 'paypal' ? profile ? <div className="sale-profile"><ShieldCheck size={17}/><span>Dados de pagamento salvos: <b>{profile.document_masked}</b></span></div> : <div className="sale-profile-form"><label>Nome do titular<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo"/></label><label>CPF ou CNPJ<input value={document} inputMode="numeric" onChange={(event) => setDocument(digits(event.target.value))} placeholder="Digite somente números"/></label><small>Usado apenas para a cobrança e salvo para suas próximas compras. Cartão e CVV não são armazenados.</small></div> : null}{error ? <p className="sale-error" role="alert">{error}</p> : null}<button type="button" onClick={() => void checkout()} disabled={busy}>{busy ? 'Preparando pagamento…' : 'Ir para pagamento seguro'}</button></>}</section>
  </AppShell>
}
