'use client'

import { Input as UiInput, Select as UiSelect } from '@/components/ui/Field'
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { useCommerce, type LocalCommerceItem } from '@/features/commerce'
import './carrinho.css'

type PaymentMethod = 'pix' | 'cartao' | 'paypal'
type BillingProfile = { name: string; document_masked: string; updated_at?: string | null }

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, Number(value || 0)))
}

function cpfCnpjDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 14)
}

export default function CarrinhoPage() {
  const { cartItems: items, accessToken, loading, pendingCartIds, setQuantity, removeItem: removeCommerceItem, error: commerceError } = useCommerce()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null)
  const [showBillingForm, setShowBillingForm] = useState(false)
  const [holderName, setHolderName] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [billingError, setBillingError] = useState('')
  const [error, setError] = useState('')
  const [preparedPayments, setPreparedPayments] = useState<Array<{ name: string; href: string }>>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])

  useEffect(() => {
    if (!accessToken || loading) {
      if (!accessToken) {
        setPurchases([])
        setRecommendations([])
        setBillingProfile(null)
      }
      return
    }
    let active = true
    void Promise.all([
      fetch('/api/me/compras/vagas', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null),
      fetch('/api/vagas?diretorio=1', { cache: 'no-store' }).catch(() => null),
      fetch('/api/me/perfil-cobranca', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null),
    ]).then(async ([purchasesResponse, recommendationsResponse, billingResponse]) => {
      const purchasesPayload = purchasesResponse?.ok ? await purchasesResponse.json().catch(() => null) : null
      const recommendationsPayload = recommendationsResponse?.ok ? await recommendationsResponse.json().catch(() => null) : null
      const billingPayload = billingResponse?.ok ? await billingResponse.json().catch(() => null) : null
      if (!active) return
      setPurchases(Array.isArray(purchasesPayload?.items) ? purchasesPayload.items : [])
      setBillingProfile(billingPayload?.profile || null)
      if (billingPayload?.profile?.name) setHolderName(String(billingPayload.profile.name))
      const cartIds = new Set(items.map((item) => item.id))
      setRecommendations((recommendationsPayload?.announcements || []).filter((item: any) => !cartIds.has(String(item.id))).slice(0, 5))
    })
    return () => { active = false }
  }, [accessToken, loading, items])

  const totalVacancies = useMemo(() => items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0), [items])
  const paidItems = useMemo(() => items.filter((item) => Number(item.price || 0) > 0), [items])
  const total = useMemo(() => paidItems.reduce((sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)), 0), [paidItems])
  const digits = cpfCnpjDigits(cpfCnpj)
  const documentReady = method === 'paypal' || Boolean(billingProfile) || digits.length === 11 || digits.length === 14

  async function updateQuantity(item: LocalCommerceItem, nextQuantity: number) {
    setError('')
    await setQuantity(item, nextQuantity)
  }

  async function removeItem(item: LocalCommerceItem) {
    setError('')
    await removeCommerceItem(item)
  }

  async function checkout() {
    if (!accessToken) return
    if (!paidItems.length) {
      setError('Este pedido só tem inscrições gratuitas. Abra cada campeonato para concluir a inscrição.')
      return
    }
    if (!documentReady || (!billingProfile && holderName.trim().length < 3 && method !== 'paypal')) {
      setBillingError('Informe o nome do titular e um CPF com 11 dígitos ou CNPJ com 14 dígitos para ativar pagamentos.')
      setShowBillingForm(true)
      return
    }
    setBillingError('')
    setError('')
    setPreparedPayments([])
    setBusyId('checkout')
    try {
      const response = await fetch('/api/me/commerce/cart/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: paidItems.map((item) => item.itemId),
          method,
          billing_profile: !billingProfile && method !== 'paypal' ? { name: holderName.trim(), document: digits } : undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível iniciar o pagamento.')
      if (payload?.billing_profile) {
        setBillingProfile(payload.billing_profile)
        setShowBillingForm(false)
      }
      const checkouts = payload?.checkouts || [payload]
      const next = checkouts.map((entry: any) => ({ name: String(entry.championship_name || 'Campeonato'), href: String(entry.checkout_url || entry.claim_url || '') })).filter((entry: { href: string }) => Boolean(entry.href))
      if (!next.length) throw new Error('O pagamento foi criado, mas o link seguro não foi retornado.')
      if (next.length === 1) {
        window.location.assign(next[0].href)
        return
      }
      setPreparedPayments(next)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível iniciar o pagamento.')
    } finally { setBusyId(null) }
  }

  return (
    <AppShell activeLabel="Carteira" loadSession headerVariant="storefront" withAuthOffset={false} mainClassName="cart-page page page-authenticated">
      <section className="cart-hero"><div><p>DROPZONE PAY</p><h1>Meu carrinho</h1><span>Revise as vagas antes de pagar.</span></div><ShoppingBag size={34} /></section>
      {!accessToken && !loading ? <section className="cart-login"><strong>Entre para continuar sua compra</strong><span>Seu carrinho será sincronizado com a conta depois do login.</span><SocialLogin profileType="equipe" returnTo="/carrinho" /></section> : null}
      {error || commerceError ? <p className="cart-error" role="alert">{error || commerceError}</p> : null}
      <section className="cart-layout">
        <div className="cart-items"><div className="cart-section-head"><div><p>ITENS DO PEDIDO</p><h2>{loading ? 'Carregando…' : `${items.length} ${items.length === 1 ? 'campeonato' : 'campeonatos'}`}</h2></div><span>{totalVacancies} vagas</span></div>
          {!loading && !items.length ? <div className="cart-empty"><ShoppingBag size={28}/><strong>Seu carrinho está vazio</strong><a href="/campeonatos">Ver campeonatos</a></div> : null}
          {items.map((item) => { const quantity = Math.max(1, Number(item.quantity || 1)); const itemTotal = Number(item.price || 0) * quantity; const busy = pendingCartIds.has(item.id); return <article className="cart-item" key={item.id}><div className="cart-item-image">{item.image ? <img src={item.image} alt="" /> : <ShoppingBag size={19}/>}</div><div className="cart-item-info"><a href={item.href}>{item.name}</a><small>{Number(item.price || 0) > 0 ? `${money(Number(item.price))} por vaga` : 'Inscrição gratuita'}</small><div className="cart-quantity"><button type="button" disabled={busy || quantity <= 1} onClick={() => void updateQuantity(item, quantity - 1)} aria-label={`Diminuir vagas em ${item.name}`}><Minus size={14}/></button><b>{quantity}</b><button type="button" disabled={busy || quantity >= Math.max(1, Number(item.freeSlots || 99))} onClick={() => void updateQuantity(item, quantity + 1)} aria-label={`Aumentar vagas em ${item.name}`}><Plus size={14}/></button></div></div><div className="cart-item-price"><strong>{money(itemTotal)}</strong><small>{Number(item.freeSlots || 0)} vagas livres</small>{Number(item.price || 0) <= 0 ? <a href={item.href}>Inscrever grátis</a> : null}</div><button type="button" className="cart-remove" disabled={busy} onClick={() => void removeItem(item)} aria-label={`Remover ${item.name}`}><Trash2 size={17}/></button></article> })}
        </div>
        <aside className="cart-summary"><p>RESUMO DO PEDIDO</p><h2>{money(total)}</h2><div><span>Vagas</span><b>{totalVacancies}</b></div><div><span>Inscrições pagas</span><b>{paidItems.length}</b></div><div className="cart-summary-total"><span>Total a pagar</span><strong>{money(total)}</strong></div>{accessToken && paidItems.length ? <><label className="cart-field"><span>Forma de pagamento</span><UiSelect value={method} onChange={(event) => { setMethod(event.target.value as PaymentMethod); setBillingError('') }}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="paypal">PayPal</option></UiSelect></label>{method !== 'paypal' ? <section className={`cart-billing-profile ${billingError ? 'has-error' : ''}`}><div><span>Dados de pagamento</span>{billingProfile && !showBillingForm ? <><strong>{billingProfile.name}</strong><small>CPF/CNPJ {billingProfile.document_masked}</small></> : <small>Cadastre uma vez para agilizar seus próximos pagamentos.</small>}</div>{billingProfile && !showBillingForm ? <button type="button" onClick={() => setShowBillingForm(true)}>Alterar</button> : null}{(!billingProfile || showBillingForm) ? <div className="cart-billing-form"><label><span>Nome do titular</span><UiInput value={holderName} autoComplete="name" placeholder="Nome completo" onChange={(event) => { setHolderName(event.target.value); setBillingError('') }}/></label><label><span>CPF ou CNPJ</span><UiInput aria-invalid={Boolean(billingError)} value={cpfCnpj} inputMode="numeric" autoComplete="off" placeholder="Digite somente números" onChange={(event) => { setCpfCnpj(cpfCnpjDigits(event.target.value)); setBillingError('') }}/></label>{billingError ? <small role="alert">{billingError}</small> : <small>Salvo com segurança para as próximas compras. Não guardamos cartão nem CVV.</small>}</div> : null}</section> : null}<button type="button" className="cart-checkout" disabled={busyId === 'checkout'} onClick={() => void checkout()}>{busyId === 'checkout' ? 'Preparando pagamento…' : billingProfile || method === 'paypal' ? `Pagar ${money(total)}` : 'Ativar pagamentos e continuar'}</button></> : null}<div className="cart-secure"><ShieldCheck size={17}/><span>Pagamento protegido. Reembolsos são vinculados ao pagamento original; cartão e CVV nunca ficam salvos na DropZone.</span></div>{preparedPayments.length ? <div className="cart-payments"><strong>Pagamentos preparados</strong><small>Há um pagamento por campeonato para manter cada inscrição vinculada corretamente.</small>{preparedPayments.map((payment) => <a key={payment.href} href={payment.href}>Pagar {payment.name}</a>)}</div> : null}</aside>
      </section>
      {purchases.length ? <section className="cart-purchases" id="compras"><div><p>MINHAS COMPRAS</p><h2>Campeonatos pagos</h2></div><div>{purchases.map((purchase) => <article key={purchase.id}>{purchase.championship?.logo_url ? <img src={purchase.championship.logo_url} alt=""/> : <ShoppingBag size={17}/>}<span><strong>{purchase.championship?.nome || 'Campeonato'}</strong><small>{purchase.status === 'consumido' ? 'Inscrição concluída' : `${purchase.quantity} vaga${purchase.quantity > 1 ? 's' : ''} liberada${purchase.quantity > 1 ? 's' : ''}`}</small></span><a href={purchase.claim_url}>{purchase.status === 'consumido' ? 'Ver campeonato' : 'Fazer inscrição'}</a></article>)}</div></section> : null}
      {recommendations.length ? <section className="cart-recommendations"><div><p>RECOMENDADO PARA VOCÊ</p><h2>Outros campeonatos com vagas</h2></div><div>{recommendations.map((item) => <a href={`/campeonatos/${item.id}`} key={item.id}>{item.logo_url ? <img src={item.logo_url} alt=""/> : <ShoppingBag size={18}/>}<strong>{item.nome}</strong><small>{Number(item.valor_inscricao || 0) > 0 ? money(Number(item.valor_inscricao)) : 'Grátis'} · {item.vagas_livres || 0} vagas</small></a>)}</div></section> : null}
    </AppShell>
  )
}
