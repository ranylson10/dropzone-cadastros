'use client'

import { Copy, ExternalLink, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DropZoneRow } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'

export function ManagerPanel({ account }: { account: DropZoneRow }) {
  const [sellerItems, setSellerItems] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [sellerLoading, setSellerLoading] = useState(false)
  const [sellerError, setSellerError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [publishing, setPublishing] = useState<Record<string, boolean>>({})
  const [whatsapp, setWhatsapp] = useState('')
  const [nomePublico, setNomePublico] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  async function authHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async function load() {
    if (!account?.id) return
    setSellerLoading(true)
    setSellerError('')
    try {
      const [campRes, perfilRes] = await Promise.all([
        fetch(`/api/vendedores/${encodeURIComponent(account.id)}/campeonatos`, { cache: 'no-store' }),
        fetch(`/api/vendedores/${encodeURIComponent(account.id)}/perfil`, {
          headers: await authHeaders().catch(() => ({} as any)),
          cache: 'no-store',
        }),
      ])
      const campJson = await campRes.json()
      if (!campRes.ok) throw new Error(campJson.error || 'Não foi possível carregar campeonatos de venda.')
      setSellerItems(Array.isArray(campJson.campeonatos) ? campJson.campeonatos : [])
      if (campJson.manager) {
        setProfile(campJson.manager)
        setWhatsapp(campJson.manager.whatsapp_url || '')
        setNomePublico(campJson.manager.nome_publico_vendas || campJson.manager.nome || account.name || '')
      }
      if (perfilRes.ok) {
        const perfilJson = await perfilRes.json()
        if (perfilJson.manager) {
          setProfile(perfilJson.manager)
          setWhatsapp(perfilJson.manager.whatsapp_url || '')
          setNomePublico(perfilJson.manager.nome_publico_vendas || perfilJson.manager.nome || account.name || '')
        }
      }
    } catch (error: any) {
      setSellerError(error?.message || 'Não foi possível carregar campeonatos de venda.')
    } finally {
      setSellerLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [account?.id])

  async function saveProfile() {
    if (!account?.id) return
    setSavingProfile(true)
    setFeedback('')
    setSellerError('')
    try {
      const response = await fetch(`/api/vendedores/${encodeURIComponent(account.id)}/perfil`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({
          whatsapp_url: whatsapp,
          nome_publico_vendas: nomePublico,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar perfil de vendas.')
      setProfile(json.manager)
      setFeedback('Perfil de vendas atualizado.')
      await load()
    } catch (error: any) {
      setSellerError(error?.message || 'Erro ao salvar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function toggleAnuncio(campeonatoId: string, anunciar: boolean) {
    if (!account?.id) return
    setPublishing((current) => ({ ...current, [campeonatoId]: true }))
    setSellerError('')
    try {
      const response = await fetch(`/api/vendedores/${encodeURIComponent(account.id)}/campeonatos`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ campeonatoId, anunciar }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Não foi possível atualizar o anúncio.')
      setSellerItems((current) =>
        current.map((item) =>
          item.campeonato_id === campeonatoId ? { ...item, anunciando: anunciar } : item,
        ),
      )
    } catch (error: any) {
      setSellerError(error?.message || 'Não foi possível atualizar o anúncio.')
    } finally {
      setPublishing((current) => ({ ...current, [campeonatoId]: false }))
    }
  }

  function copyPublicLink() {
    const publicUrl = `${window.location.origin}/vendedores/${account.id}`
    navigator.clipboard.writeText(publicUrl)
    setFeedback('Link de vendas copiado.')
  }

  const ativos = sellerItems.filter((item) => item.status === 'ativo')
  const anunciando = sellerItems.filter((item) => item.anunciando)

  return (
    <div className="dashboard manager-dashboard">
      <section className="panel span-3">
        <div className="section-head">
          <div>
            <p className="eyebrow">Manager / afiliado</p>
            <h2>Central de vendas</h2>
          </div>
          <ShieldCheck />
        </div>
        <div className="player-summary-grid">
          <div>
            <Users size={18} />
            <strong>{sellerItems.length}</strong>
            <span>Campeonatos liberados</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <strong>{ativos.length}</strong>
            <span>Ativos</span>
          </div>
          <div>
            <MessageCircle size={18} />
            <strong>{anunciando.length}</strong>
            <span>No seu link</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Seu link de vendas (portfólio)</h2>
        <p className="empty" style={{ marginBottom: 12 }}>
          Igual às vagas abertas, mas com o <strong>seu WhatsApp</strong>. Escolha quais campeonatos da lista anunciar.
        </p>
        <div className="compact-row">
          <div>
            <strong>Link público</strong>
            <span>{`${typeof window !== 'undefined' ? window.location.origin : ''}/vendedores/${account.id}`}</span>
          </div>
          <div className="compact-row-actions">
            <button className="button small" type="button" onClick={copyPublicLink}>
              <Copy size={14} /> Copiar
            </button>
            <a className="button small secondary" href={`/vendedores/${account.id}`} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
        </div>

        <div className="mini-grid two" style={{ marginTop: 14 }}>
          <label className="field">
            <span>Nome público de vendas</span>
            <input value={nomePublico} onChange={(e) => setNomePublico(e.target.value)} placeholder="Ex.: Paulo Vagas" />
          </label>
          <label className="field">
            <span>WhatsApp de compra (seu contato)</span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5599999999999 ou https://wa.me/..."
            />
          </label>
        </div>
        <button className="button" type="button" disabled={savingProfile} onClick={() => void saveProfile()} style={{ marginTop: 10 }}>
          {savingProfile ? 'Salvando...' : 'Salvar contato de vendas'}
        </button>
      </section>

      <section className="panel">
        <h2>Campeonatos liberados pelo produtor</h2>
        {sellerLoading ? <p className="empty">Carregando...</p> : null}
        {sellerError ? <div className="message error">{sellerError}</div> : null}
        {feedback ? <div className="message success">{feedback}</div> : null}
        {!sellerLoading && sellerItems.length === 0 ? (
          <p className="empty">
            Nenhum campeonato ainda. Aceite o convite da produtora; depois o produtor libera os eventos que você pode
            vender.
          </p>
        ) : null}
        {sellerItems.map((item) => {
          const championship = item.campeonatos || {}
          const producer = item.produtoras || {}
          const active = item.status === 'ativo'
          const limite = Number(item.limite_vagas || 0)
          return (
            <div className="compact-row" key={item.id}>
              <div>
                <strong>{championship.nome || 'Campeonato'}</strong>
                <span>{producer.nome ? `Produtora ${producer.nome}` : 'Campeonato'}</span>
                <span>
                  {active ? 'Liberado para vender' : 'Removido/oculto pelo produtor'}
                  {limite > 0 ? ` · até ${limite} vaga(s)` : ' · sem limite de vagas'}
                  {item.anunciando ? ' · no seu link' : ' · fora do link'}
                </span>
              </div>
              <div className="compact-row-actions">
                <button
                  className={`button small ${item.anunciando ? '' : 'secondary'}`}
                  type="button"
                  disabled={!active || Boolean(publishing[item.campeonato_id])}
                  onClick={() => void toggleAnuncio(item.campeonato_id, !item.anunciando)}
                  title={
                    active
                      ? 'Incluir ou tirar este campeonato do seu link público (portfólio)'
                      : 'Vínculo inativo'
                  }
                >
                  {item.anunciando ? 'No portfólio' : 'Anunciar'}
                </button>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
