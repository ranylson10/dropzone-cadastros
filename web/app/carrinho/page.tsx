'use client'

import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { getCartItems, removeFromCart, setCartQuantity, type LocalCommerceItem } from '@/features/commerce/local-commerce'
import { supabase } from '@/lib/supabase-browser'
import './carrinho.css'

type PaymentMethod = 'pix' | 'cartao' | 'paypal'

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, Number(value || 0)))
}

function itemFromApi(row: any): LocalCommerceItem {
  const championship = Array.isArray(row?.campeonato) ? row.campeonato[0] : row?.campeonato
  return {
    id: String(row?.campeonato_id || championship?.id || ''),
    itemId: String(row?.id || ''),
    name: String(championship?.nome || 'Campeonato'),
    href: `/campeonatos/${row?.campeonato_id || championship?.id || ''}`,
    image: championship?.logo_url || null,
    price: Number(row?.preco_unitario_centavos || 0) / 100,
    freeSlots: Number(championship?.vagas_livres || 0),
    quantity: Math.max(1, Number(row?.quantidade || 1)),
  }
}

function cpfCnpjDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 14)
}

export default function CarrinhoPage() {
  const [items, setItems] = useState<LocalCommerceItem[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [error, setError] = useState('')
  const [preparedPayments, setPreparedPayments] = useState<Array<{ name: string; href: string }>>([])

  const loadRemoteCart = useCallback(async (token: string): Promise<LocalCommerceItem[]> => {
    const response = await fetch('/api/me/commerce/cart', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    const payload = response?.ok ? await response.json().catch(() => null) : null
    const next = Array.isArray(payload?.items) ? payload.items.map(itemFromApi).filter((item: LocalCommerceItem) => item.id) : []
    setItems(next)
    return next
  }, [])

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) {
        if (active) {
          setItems(getCartItems())
          setLoading(false)
        }
        return
      }
      setAccessToken(token)
      const local = getCartItems()
      const current = await loadRemoteCart(token)
      const known = new Set(current.map((item) => item.id))
      const missing = local.filter((item) => !known.has(item.id))
      if (missing.length) {
        await Promise.all(missing.map((item) => fetch('/api/me/commerce/cart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ campeonato_id: item.id, quantidade: item.quantity || 1, origem: 'direto' }),
        }).catch(() => null)))
        await loadRemoteCart(token)
      }
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [loadRemoteCart])

  const totalVacancies = useMemo(() => items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0), [items])
  const paidItems = useMemo(() => items.filter((item) => Number(item.price || 0) > 0), [items])
  const total = useMemo(() => paidItems.reduce((sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)), 0), [paidItems])
  const digits = cpfCnpjDigits(cpfCnpj)
  const documentReady = method === 'paypal' || digits.length === 11 || digits.length === 14

  async function updateQuantity(item: LocalCommerceItem, nextQuantity: number) {
    const quantity = Math.max(1, Math.min(Math.max(1, Number(item.freeSlots || 99)), nextQuantity))
    setError('')
    if (!accessToken || !item.itemId) {
      setItems(setCartQuantity(item.id, quantity))
      return
    }
    setBusyId(item.id)
    try {
      const response = await fetch('/api/me/commerce/cart', { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.itemId, quantidade: quantity }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar a quantidade.')
      await loadRemoteCart(accessToken)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível atualizar a quantidade.')
    } finally { setBusyId(null) }
  }

  async function removeItem(item: LocalCommerceItem) {
    setError('')
    if (!accessToken || !item.itemId) {
      setItems(removeFromCart(item.id))
      return
    }
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/me/commerce/cart?item_id=${encodeURIComponent(item.itemId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível remover o item.')
      await loadRemoteCart(accessToken)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível remover o item.')
    } finally { setBusyId(null) }
  }

  async function checkout() {
    if (!accessToken) return
    if (!paidItems.length) {
      setError('Este pedido só tem inscrições gratuitas. Abra cada campeonato para concluir a inscrição.')
      return
    }
    if (!documentReady) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o pagamento.')
      return
    }
    setError('')
    setPreparedPayments([])
    setBusyId('checkout')
    try {
      const response = await fetch('/api/me/commerce/cart/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: paidItems.map((item) => item.itemId), method, cpf_cnpj: digits || undefined }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível iniciar o pagamento.')
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
    <AppShell activeLabel="Carrinho" loadSession mainClassName="cart-page page page-authenticated">
      <section className="cart-hero"><div><p>DROPZONE PAY</p><h1>Meu carrinho</h1><span>Revise as vagas antes de pagar.</span></div><ShoppingBag size={34} /></section>
      {!accessToken && !loading ? <section className="cart-login"><strong>Entre para continuar sua compra</strong><span>Seu carrinho será sincronizado com a conta depois do login.</span><SocialLogin profileType="equipe" returnTo="/carrinho" /></section> : null}
      {error ? <p className="cart-error" role="alert">{error}</p> : null}
      <section className="cart-layout">
        <div className="cart-items"><div className="cart-section-head"><div><p>ITENS DO PEDIDO</p><h2>{loading ? 'Carregando…' : `${items.length} ${items.length === 1 ? 'campeonato' : 'campeonatos'}`}</h2></div><span>{totalVacancies} vagas</span></div>
          {!loading && !items.length ? <div className="cart-empty"><ShoppingBag size={28}/><strong>Seu carrinho está vazio</strong><a href="/campeonatos">Ver campeonatos</a></div> : null}
          {items.map((item) => { const quantity = Math.max(1, Number(item.quantity || 1)); const itemTotal = Number(item.price || 0) * quantity; const busy = busyId === item.id; return <article className="cart-item" key={item.id}><div className="cart-item-image">{item.image ? <img src={item.image} alt="" /> : <ShoppingBag size={19}/>}</div><div className="cart-item-info"><a href={item.href}>{item.name}</a><small>{Number(item.price || 0) > 0 ? `${money(Number(item.price))} por vaga` : 'Inscrição gratuita'}</small><div className="cart-quantity"><button type="button" disabled={busy || quantity <= 1} onClick={() => void updateQuantity(item, quantity - 1)} aria-label={`Diminuir vagas em ${item.name}`}><Minus size={14}/></button><b>{quantity}</b><button type="button" disabled={busy || quantity >= Math.max(1, Number(item.freeSlots || 99))} onClick={() => void updateQuantity(item, quantity + 1)} aria-label={`Aumentar vagas em ${item.name}`}><Plus size={14}/></button></div></div><div className="cart-item-price"><strong>{money(itemTotal)}</strong><small>{Number(item.freeSlots || 0)} vagas livres</small>{Number(item.price || 0) <= 0 ? <a href={item.href}>Inscrever grátis</a> : null}</div><button type="button" className="cart-remove" disabled={busy} onClick={() => void removeItem(item)} aria-label={`Remover ${item.name}`}><Trash2 size={17}/></button></article> })}
        </div>
        <aside className="cart-summary"><p>RESUMO DO PEDIDO</p><h2>{money(total)}</h2><div><span>Vagas</span><b>{totalVacancies}</b></div><div><span>Inscrições pagas</span><b>{paidItems.length}</b></div><div className="cart-summary-total"><span>Total a pagar</span><strong>{money(total)}</strong></div>{accessToken && paidItems.length ? <><label className="cart-field"><span>Forma de pagamento</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="paypal">PayPal</option></select></label>{method !== 'paypal' ? <label className="cart-field"><span>CPF ou CNPJ do pagador</span><input value={cpfCnpj} inputMode="numeric" placeholder="Somente números" onChange={(event) => setCpfCnpj(cpfCnpjDigits(event.target.value))}/></label> : null}<button type="button" className="cart-checkout" disabled={busyId === 'checkout'} onClick={() => void checkout()}>{busyId === 'checkout' ? 'Preparando pagamento…' : `Pagar ${money(total)}`}</button></> : null}<div className="cart-secure"><ShieldCheck size={17}/><span>Pagamento protegido. Após a confirmação, você escolhe a equipe e a vaga de cada campeonato.</span></div>{preparedPayments.length ? <div className="cart-payments"><strong>Pagamentos preparados</strong><small>Há um pagamento por campeonato para manter cada inscrição vinculada corretamente.</small>{preparedPayments.map((payment) => <a key={payment.href} href={payment.href}>Pagar {payment.name}</a>)}</div> : null}</aside>
      </section>
    </AppShell>
  )
}
