'use client'

import { Copy, ShieldCheck, Swords, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DropZoneRow } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'
import { dataText, rowTitle } from '../../utils'

export function ManagerPanel({ championships, teams, players, account }: { championships: DropZoneRow[]; teams: DropZoneRow[]; players: DropZoneRow[]; account: DropZoneRow }) {
  const [sellerItems, setSellerItems] = useState<any[]>([])
  const [sellerLoading, setSellerLoading] = useState(false)
  const [sellerError, setSellerError] = useState('')
  const [publishing, setPublishing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    async function loadSellerChampionships() {
      if (!account?.id) return
      setSellerLoading(true)
      setSellerError('')
      try {
        const response = await fetch(`/api/vendedores/${encodeURIComponent(account.id)}/campeonatos`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Não foi possível carregar campeonatos de venda.')
        if (active) setSellerItems(Array.isArray(json.campeonatos) ? json.campeonatos : [])
      } catch (error: any) {
        if (active) setSellerError(error?.message || 'Não foi possível carregar campeonatos de venda.')
      } finally {
        if (active) setSellerLoading(false)
      }
    }
    void loadSellerChampionships()
    return () => { active = false }
  }, [account?.id])

  async function togglePublication(campeonatoId: string, publish: boolean) {
    if (!account?.id) return
    setPublishing((current) => ({ ...current, [campeonatoId]: true }))
    setSellerError('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sessão expirada. Entre novamente.')

      const response = await fetch(`/api/vendedores/${encodeURIComponent(account.id)}/campeonatos`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campeonatoId, publish }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Não foi possível atualizar o estado de publicação.')
      setSellerItems((current) => current.map((item) => item.campeonato_id === campeonatoId ? { ...item, status: publish ? 'ativo' : 'cancelado' } : item))
    } catch (error: any) {
      setSellerError(error?.message || 'Não foi possível atualizar o estado de publicação.')
    } finally {
      setPublishing((current) => ({ ...current, [campeonatoId]: false }))
    }
  }

  function copyPublicLink() {
    const publicUrl = `${window.location.origin}/vendedores/${account.id}`
    navigator.clipboard.writeText(publicUrl)
  }

  return <div className="dashboard manager-dashboard">
    <section className="panel span-3"><div className="section-head"><div><p className="eyebrow">Manager</p><h2>Contas sob minha administração</h2></div><ShieldCheck /></div><div className="player-summary-grid"><div><Swords size={18}/><strong>{championships.length}</strong><span>Campeonatos</span></div><div><ShieldCheck size={18}/><strong>{teams.length}</strong><span>Equipes</span></div><div><Users size={18}/><strong>{players.length}</strong><span>Jogadores</span></div></div></section>
    <section className="panel">
      <h2>Vendas públicas</h2>
      <div className="compact-row">
        <div>
          <strong>Link público</strong>
          <span>{`/vendedores/${account.id}`}</span>
        </div>
        <button className="button small" type="button" onClick={copyPublicLink}><Copy size={14} /> Copiar link</button>
      </div>
      {sellerLoading ? <p className="empty">Carregando campeonatos de venda...</p> : null}
      {sellerError ? <div className="message error">{sellerError}</div> : null}
      {!sellerLoading && sellerItems.length === 0 ? <p className="empty">Nenhum campeonato de venda encontrado. Aceite convites ou espere um convite do produtor.</p> : null}
      {sellerItems.map((item) => {
        const championship = item.campeonatos || {}
        const producer = item.produtoras || {}
        const published = item.status === 'ativo'
        return (
          <div className="compact-row" key={item.id}>
            <div>
              <strong>{championship.nome || 'Campeonato'}</strong>
              <span>{producer.nome ? `Produtora ${producer.nome}` : dataText(championship, 'tipo') || 'Campeonato'}</span>
              <span>{item.whatsapp_url ? 'WhatsApp configurado' : 'WhatsApp pendente'}</span>
            </div>
            <div className="compact-row-actions">
              <button className="button small" type="button" disabled={Boolean(publishing[item.campeonato_id])} onClick={() => togglePublication(item.campeonato_id, !published)}>
                {published ? 'Ocultar' : 'Publicar'}
              </button>
            </div>
          </div>
        )
      })}
    </section>
    <section className="panel"><h2>Campeonatos</h2>{championships.length === 0 ? <p className="empty">Nenhum campeonato liberado para este manager.</p> : null}{championships.map((row) => <div className="compact-row" key={row.id}><strong>{rowTitle(row)}</strong><span>{dataText(row, 'tipo') || 'Campeonato'}</span></div>)}</section>
    <section className="panel"><h2>Equipes</h2>{teams.length === 0 ? <p className="empty">Nenhuma equipe vinculada.</p> : null}{teams.map((row) => <div className="compact-row" key={row.id}><strong>{rowTitle(row)}</strong><span>{dataText(row, 'tag') || 'Equipe'}</span></div>)}</section>
    <section className="panel"><h2>Jogadores</h2>{players.length === 0 ? <p className="empty">Nenhum jogador vinculado.</p> : null}{players.map((row) => <div className="compact-row" key={row.id}><strong>{dataText(row, 'nick') || rowTitle(row)}</strong><span>ID {dataText(row, 'id_jogo') || '-'}</span></div>)}</section>
  </div>
}
