'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  KeyRound,
  Loader2,
  Printer,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { supabase } from '@/lib/supabase-browser'
import '@/app/globals.css'

function money(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (Number(centavos) || 0) / 100,
  )
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

type Tab = 'extrato' | 'saques' | 'pagamentos' | 'pix'

export default function CarteiraPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('extrato')
  const [busy, setBusy] = useState(false)

  const [saqueValor, setSaqueValor] = useState('')
  const [pixChave, setPixChave] = useState('')
  const [pixTipo, setPixTipo] = useState('aleatoria')
  const [pixTitular, setPixTitular] = useState('')
  const [comprovante, setComprovante] = useState<any>(null)

  async function headers() {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) throw new Error('Faça login para acessar a carteira.')
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
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar')
      setData(json)
      if (json.carteira?.pix_chave) setPixChave(json.carteira.pix_chave)
      if (json.carteira?.pix_tipo) setPixTipo(json.carteira.pix_tipo)
      if (json.carteira?.pix_titular) setPixTitular(json.carteira.pix_titular)
    } catch (e: any) {
      setError(e?.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saldo = Number(data?.carteira?.saldo_disponivel_centavos || 0)
  const bloqueado = Number(data?.carteira?.saldo_bloqueado_centavos || 0)

  const extrato = useMemo(() => data?.lancamentos || [], [data])

  async function salvarPix() {
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const res = await fetch('/api/me/carteira', {
        method: 'PATCH',
        headers: await headers(),
        body: JSON.stringify({
          pix_chave: pixChave,
          pix_tipo: pixTipo,
          pix_titular: pixTitular,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg('Chave PIX salva.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar PIX')
    } finally {
      setBusy(false)
    }
  }

  async function solicitarSaque() {
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const reais = Number(String(saqueValor).replace(',', '.'))
      if (!Number.isFinite(reais) || reais < 10) throw new Error('Mínimo R$ 10,00')
      const res = await fetch('/api/me/carteira/saque', {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          valor_centavos: Math.round(reais * 100),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg('Saque solicitado. Acompanhe em Saques.')
      setSaqueValor('')
      setTab('saques')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro no saque')
    } finally {
      setBusy(false)
    }
  }

  async function abrirComprovante(id: string, tipo: 'pagamento' | 'saque' | 'lancamento') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/me/carteira/comprovante/${id}?tipo=${tipo}`, {
        headers: await headers(),
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setComprovante(json.comprovante)
    } catch (e: any) {
      setError(e?.message || 'Erro no comprovante')
    } finally {
      setBusy(false)
    }
  }

  function copiarAuth() {
    if (!comprovante?.autenticacao) return
    void navigator.clipboard.writeText(comprovante.autenticacao)
    setMsg('Código de autenticação copiado.')
  }

  if (loading) {
    return (
      <AppShell loadSession mainClassName="page page-authenticated" activeLabel="Carteira" header="always">
        <div className="bank-wallet-loading">
          <Loader2 className="spin" size={28} /> Carregando carteira…
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell loadSession mainClassName="page page-authenticated bank-wallet-page" activeLabel="Carteira" header="always">
      <div className="bank-wallet-shell">
        <header className="bank-wallet-hero">
          <div>
            <p className="bank-wallet-eyebrow">Conta digital DropZone</p>
            <h1>{data?.perfil?.nome || 'Carteira'}</h1>
            <small>
              {data?.perfil?.tipo ? String(data.perfil.tipo).toUpperCase() : 'CONTA'}
              {data?.perfil?.username ? ` · @${data.perfil.username}` : ''}
            </small>
          </div>
          <button type="button" className="bank-wallet-refresh" onClick={() => void load()} aria-label="Atualizar">
            <RefreshCw size={18} />
          </button>
        </header>

        <section className="bank-balance-card">
          <span>Saldo disponível</span>
          <strong>{money(saldo)}</strong>
          {bloqueado > 0 ? <small>Bloqueado: {money(bloqueado)}</small> : null}
          <div className="bank-balance-actions">
            <button type="button" className="bank-chip-btn primary" onClick={() => setTab('saques')}>
              <ArrowUpRight size={16} /> Sacar
            </button>
            <button type="button" className="bank-chip-btn" onClick={() => setTab('pix')}>
              <KeyRound size={16} /> Chave PIX
            </button>
            <button type="button" className="bank-chip-btn" onClick={() => setTab('pagamentos')}>
              <CreditCard size={16} /> Pagamentos
            </button>
          </div>
        </section>

        {error ? <p className="message error">{error}</p> : null}
        {msg ? <p className="message">{msg}</p> : null}

        <nav className="bank-wallet-tabs" aria-label="Áreas da carteira">
          {(
            [
              ['extrato', 'Extrato'],
              ['saques', 'Saques'],
              ['pagamentos', 'Pagamentos'],
              ['pix', 'PIX'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'extrato' ? (
          <section className="bank-section">
            <h2>Extrato</h2>
            <ul className="bank-tx-list">
              {extrato.length === 0 ? (
                <li className="bank-tx-empty">Nenhum lançamento ainda.</li>
              ) : (
                extrato.map((l: any) => (
                  <li key={l.id}>
                    <div className={`bank-tx-icon ${l.direcao}`}>
                      {l.direcao === 'credito' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div className="bank-tx-body">
                      <strong>{l.descricao || String(l.tipo || '').replaceAll('_', ' ')}</strong>
                      <small>{fmtDate(l.created_at)}</small>
                    </div>
                    <div className="bank-tx-right">
                      <b className={l.direcao === 'credito' ? 'in' : 'out'}>
                        {l.direcao === 'credito' ? '+' : '−'}
                        {money(l.valor_centavos)}
                      </b>
                      <button
                        type="button"
                        className="bank-link-btn"
                        onClick={() => void abrirComprovante(l.id, 'lancamento')}
                      >
                        <Eye size={14} /> Ver
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {tab === 'saques' ? (
          <section className="bank-section">
            <h2>Sacar via PIX</h2>
            <div className="bank-form-card">
              <label>
                <span>Valor (R$)</span>
                <input
                  inputMode="decimal"
                  placeholder="10,00"
                  value={saqueValor}
                  onChange={(e) => setSaqueValor(e.target.value)}
                />
              </label>
              <p className="bank-hint">
                Chave PIX cadastrada:{' '}
                <strong>{data?.carteira?.pix_chave || 'nenhuma — cadastre na aba PIX'}</strong>
              </p>
              <button
                type="button"
                className="button"
                disabled={busy || saldo < 1000 || !data?.carteira?.pix_chave}
                onClick={() => void solicitarSaque()}
              >
                {busy ? 'Enviando…' : 'Solicitar saque'}
              </button>
            </div>

            <h3>Histórico de saques</h3>
            <ul className="bank-tx-list">
              {(data?.saques || []).length === 0 ? (
                <li className="bank-tx-empty">Nenhum saque.</li>
              ) : (
                (data?.saques || []).map((s: any) => (
                  <li key={s.id}>
                    <div className="bank-tx-icon out">
                      <ArrowUpRight size={18} />
                    </div>
                    <div className="bank-tx-body">
                      <strong>Saque PIX · {s.status}</strong>
                      <small>
                        {fmtDate(s.created_at)} · {s.pix_chave}
                      </small>
                    </div>
                    <div className="bank-tx-right">
                      <b className="out">−{money(s.valor_centavos)}</b>
                      <button
                        type="button"
                        className="bank-link-btn"
                        onClick={() => void abrirComprovante(s.id, 'saque')}
                      >
                        Comprovante
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {tab === 'pagamentos' ? (
          <section className="bank-section">
            <h2>Pagamentos</h2>
            <ul className="bank-tx-list">
              {(data?.pagamentos || []).length === 0 ? (
                <li className="bank-tx-empty">Nenhum pagamento registrado.</li>
              ) : (
                (data?.pagamentos || []).map((p: any) => (
                  <li key={p.id}>
                    <div className={`bank-tx-icon ${p.status === 'pago' || p.status === 'confirmado' ? 'in' : 'out'}`}>
                      <CreditCard size={18} />
                    </div>
                    <div className="bank-tx-body">
                      <strong>{p.descricao || String(p.finalidade || '').replaceAll('_', ' ')}</strong>
                      <small>
                        {fmtDate(p.pago_em || p.created_at)} · {p.status}
                      </small>
                    </div>
                    <div className="bank-tx-right">
                      <b>{money(p.valor_centavos)}</b>
                      <button
                        type="button"
                        className="bank-link-btn"
                        onClick={() => void abrirComprovante(p.id, 'pagamento')}
                      >
                        Comprovante
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {tab === 'pix' ? (
          <section className="bank-section">
            <h2>Chave PIX para saques</h2>
            <div className="bank-form-card">
              <label>
                <span>Tipo da chave</span>
                <select value={pixTipo} onChange={(e) => setPixTipo(e.target.value)}>
                  <option value="aleatoria">Aleatória</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                </select>
              </label>
              <label>
                <span>Chave PIX</span>
                <input
                  value={pixChave}
                  onChange={(e) => setPixChave(e.target.value)}
                  placeholder="sua chave"
                />
              </label>
              <label>
                <span>Nome do titular</span>
                <input
                  value={pixTitular}
                  onChange={(e) => setPixTitular(e.target.value)}
                  placeholder="Como no banco"
                />
              </label>
              <button type="button" className="button" disabled={busy} onClick={() => void salvarPix()}>
                {busy ? 'Salvando…' : 'Salvar chave PIX'}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {comprovante ? (
        <div className="pix-receipt-backdrop" role="dialog" aria-modal="true">
          <div className="pix-receipt-sheet">
            <button
              type="button"
              className="pix-receipt-close no-print"
              onClick={() => setComprovante(null)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <div className="pix-receipt" id="pix-receipt-print">
              <header className="pix-receipt-head">
                <CheckCircle2 size={28} className="pix-ok" />
                <p>Comprovante de transferência</p>
                <strong>{money(comprovante.valor_centavos)}</strong>
                <span>{fmtDate(comprovante.data_movimento)}</span>
              </header>

              <div className="pix-receipt-block">
                <h4>Sobre a transferência</h4>
                <dl>
                  <div>
                    <dt>Tipo</dt>
                    <dd>{String(comprovante.tipo || 'PIX').toUpperCase()}</dd>
                  </div>
                  <div>
                    <dt>Descrição</dt>
                    <dd>{comprovante.descricao}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{String(comprovante.status || '').replaceAll('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt>ID da transação</dt>
                    <dd className="mono">{comprovante.id}</dd>
                  </div>
                </dl>
              </div>

              <div className="pix-receipt-block">
                <h4>Quem enviou</h4>
                <dl>
                  <div>
                    <dt>Nome</dt>
                    <dd>{comprovante.origem?.nome || '—'}</dd>
                  </div>
                  <div>
                    <dt>Instituição</dt>
                    <dd>{comprovante.origem?.instituicao || 'DropZone'}</dd>
                  </div>
                </dl>
              </div>

              <div className="pix-receipt-block">
                <h4>Quem recebeu</h4>
                <dl>
                  <div>
                    <dt>Nome</dt>
                    <dd>{comprovante.destino?.nome || '—'}</dd>
                  </div>
                  {comprovante.destino?.chave_pix ? (
                    <div>
                      <dt>Chave PIX</dt>
                      <dd className="mono">{comprovante.destino.chave_pix}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Instituição</dt>
                    <dd>{comprovante.destino?.instituicao || '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="pix-receipt-block">
                <h4>Autenticação</h4>
                <p className="pix-auth mono">{comprovante.autenticacao}</p>
                <p className="pix-fine">
                  Este comprovante não tem valor fiscal. Gerado por {comprovante.instituicao} em{' '}
                  {fmtDate(comprovante.gerado_em)}.
                </p>
              </div>
            </div>

            <div className="pix-receipt-actions no-print">
              <button type="button" className="button secondary" onClick={copiarAuth}>
                <Copy size={15} /> Copiar autenticação
              </button>
              <button
                type="button"
                className="button"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Imprimir / PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
