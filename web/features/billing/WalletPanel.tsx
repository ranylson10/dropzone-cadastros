'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

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

      <div className="player-summary-grid" style={{ marginBottom: 14 }}>
        <div>
          <Wallet size={18} />
          <strong>{money(saldo)}</strong>
          <span>Disponível</span>
        </div>
        <div>
          <strong>{(data?.saques || []).filter((s: any) => s.status === 'solicitado').length}</strong>
          <span>Saques abertos</span>
        </div>
        <div>
          <strong>{(data?.lancamentos || []).length}</strong>
          <span>Lançamentos</span>
        </div>
      </div>

      <div className="form-section-card" style={{ marginBottom: 14 }}>
        <p className="eyebrow">Solicitar saque (PIX)</p>
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
        <div className="button-row compact-actions" style={{ marginTop: 10 }}>
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
        <small className="empty" style={{ display: 'block', marginTop: 8 }}>
          Mínimo R$ 10. O admin processa o PIX e marca como pago. Comissão de vendas cai aqui
          automaticamente.
        </small>
      </div>

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
    </section>
  )
}
