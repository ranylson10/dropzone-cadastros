'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import './wallet-panel.css'

function money(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (Number(centavos) || 0) / 100,
  )
}

type Props = {
  /** Título da seção */
  title?: string
  compact?: boolean
}

export function WalletPanel({ title = 'Carteira DropZone', compact = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)
  const [pix, setPix] = useState('')
  const [valor, setValor] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function headers() {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) throw new Error('Faça login novamente.')
    return {
      Authorization: `Bearer ${sess.session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/me/carteira', {
        headers: await headers(),
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar carteira')
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Erro')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function solicitarSaque() {
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const reais = Number(String(valor).replace(',', '.'))
      if (!Number.isFinite(reais) || reais < 10) throw new Error('Mínimo R$ 10,00')
      const centavos = Math.round(reais * 100)
      const res = await fetch('/api/me/carteira/saque', {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          valor_centavos: centavos,
          pix_chave: pix.trim(),
          pix_tipo: 'aleatoria',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha no saque')
      setMsg('Saque solicitado. Aguarde o admin processar o PIX.')
      setValor('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro no saque')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className={`panel ${compact ? '' : 'span-3'}`}>
        <p className="empty">
          <Loader2 className="spin" size={16} /> Carregando carteira…
        </p>
      </section>
    )
  }

  const saldo = Number(data?.carteira?.saldo_disponivel_centavos || 0)

  return (
    <section className={`panel ${compact ? '' : 'span-3'} wallet-panel`}>
      <div className="section-head compact-head">
        <div>
          <p className="eyebrow">Financeiro</p>
          <h2>{title}</h2>
        </div>
        <Wallet size={20} />
      </div>

      {error ? <p className="message error">{error}</p> : null}
      {msg ? <p className="message">{msg}</p> : null}

      <div className="wallet-summary">
        <span><strong>{money(saldo)}</strong><small>disponível</small></span>
        <span><strong>{(data?.saques || []).filter((s: any) => s.status === 'solicitado').length}</strong><small>saques abertos</small></span>
        <span><strong>{(data?.lancamentos || []).length}</strong><small>lançamentos</small></span>
      </div>

      <section className="wallet-withdraw">
        <header>
          <p className="eyebrow">Saque</p>
          <h3>Receber via PIX</h3>
        </header>
        <div className="mini-grid two">
          <label className="field">
            <span>Valor (R$)</span>
            <input
              inputMode="decimal"
              placeholder="10,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Chave PIX</span>
            <input
              placeholder="e-mail, CPF, telefone ou aleatória"
              value={pix}
              onChange={(e) => setPix(e.target.value)}
            />
          </label>
        </div>
        <div className="button-row compact-actions wallet-withdraw-actions">
          <button
            type="button"
            className="button"
            disabled={busy || saldo < 1000}
            onClick={() => void solicitarSaque()}
          >
            {busy ? 'Enviando…' : 'Solicitar saque'}
          </button>
          <button type="button" className="button secondary" onClick={() => void load()}>
            Atualizar
          </button>
        </div>
        <small className="wallet-withdraw-note">
          Mínimo R$ 10. O PIX é processado pelo administrador e as comissões de vendas entram automaticamente na carteira.
        </small>
      </section>

      <div className="wallet-history">
        <div className="wallet-history-head"><span>Histórico</span><small>Movimentações da carteira</small></div>
        <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Saldo após</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lancamentos || []).length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <span className="empty">Nenhum lançamento ainda.</span>
                </td>
              </tr>
            ) : (
              (data?.lancamentos || []).map((l: any) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                  <td>{String(l.tipo || '').replaceAll('_', ' ')}</td>
                  <td>
                    {l.direcao === 'credito' ? '+' : '−'}
                    {money(l.valor_centavos)}
                  </td>
                  <td>{money(l.saldo_apos_centavos)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  )
}
