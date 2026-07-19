'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

function bytes(value: number) {
  if (!value) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index > 1 ? 2 : 0)} ${units[index]}`
}

function money(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100)
}

type Tab = 'overview' | 'aprovacoes' | 'precos' | 'saques' | 'accounts' | 'reports' | 'audit'

export default function AdminPage() {
  const [data, setData] = useState<any>(null)
  const [aprovacoes, setAprovacoes] = useState<any>(null)
  const [precos, setPrecos] = useState<any>(null)
  const [saques, setSaques] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')
  const [aprovFilter, setAprovFilter] = useState('pendente')
  const [busyId, setBusyId] = useState('')

  async function headers() {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) throw new Error('Entre com a conta administradora.')
    return {
      Authorization: `Bearer ${sess.session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  const loadOverview = useCallback(async () => {
    const res = await fetch('/api/admin/overview', { headers: await headers() })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setData(json)
  }, [])

  const loadAprovacoes = useCallback(async (status = aprovFilter) => {
    const res = await fetch(`/api/admin/aprovacoes?status=${encodeURIComponent(status)}`, {
      headers: await headers(),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setAprovacoes(json)
  }, [aprovFilter])

  const loadPrecos = useCallback(async () => {
    const res = await fetch('/api/admin/precos', { headers: await headers() })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setPrecos(json)
  }, [])

  const loadSaques = useCallback(async () => {
    const res = await fetch('/api/admin/saques?status=solicitado', { headers: await headers() })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setSaques(json.saques || [])
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      await loadOverview()
      if (tab === 'aprovacoes') await loadAprovacoes()
      if (tab === 'precos') await loadPrecos()
      if (tab === 'saques') await loadSaques()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'aprovacoes') void loadAprovacoes(aprovFilter).catch((e) => setError(e.message))
    if (tab === 'precos') void loadPrecos().catch((e) => setError(e.message))
    if (tab === 'saques') void loadSaques().catch((e) => setError(e.message))
  }, [tab, aprovFilter, loadAprovacoes, loadPrecos, loadSaques])

  const accounts = useMemo(
    () =>
      (data?.accounts || []).filter((item: any) =>
        `${item.nome} ${item.username} ${item.tipo} ${item.status}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  )

  async function moderate(item: any, action: 'suspender' | 'banir' | 'restaurar') {
    const reason =
      action === 'restaurar'
        ? 'Restrição removida pelo administrador.'
        : window.prompt(`Motivo para ${action} ${item.nome}:`)
    if (!reason) return
    const days = action === 'suspender' ? Number(window.prompt('Quantidade de dias da suspensão:', '7') || 7) : null
    const res = await fetch('/api/admin/moderation', {
      method: 'PATCH',
      headers: await headers(),
      body: JSON.stringify({
        action,
        target_type: item.tipo || 'campeonato',
        target_id: item.id,
        reason,
        days,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      return
    }
    await loadOverview()
  }

  async function resolveReport(item: any, status: string) {
    const resolution = window.prompt('Informe a análise/resolução:', item.resolucao || '')
    if (resolution === null) return
    const res = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: await headers(),
      body: JSON.stringify({ id: item.id, status, resolucao: resolution }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      return
    }
    await loadOverview()
  }

  async function setAprovacao(
    alvo: 'produtora' | 'campeonato',
    id: string,
    status: 'aprovado' | 'rejeitado' | 'pendente',
  ) {
    const motivo =
      status === 'rejeitado'
        ? window.prompt('Motivo da rejeição:')
        : status === 'aprovado'
          ? window.prompt('Observação (opcional):', '')
          : ''
    if (status === 'rejeitado' && motivo === null) return
    setBusyId(id)
    setError('')
    try {
      let cobranca_status: string | undefined
      if (alvo === 'campeonato' && status === 'aprovado') {
        const cob = window.prompt(
          'Status da cobrança: pago | cortesia | isento | pendente',
          'cortesia',
        )
        if (cob && ['pago', 'cortesia', 'isento', 'pendente'].includes(cob.trim())) {
          cobranca_status = cob.trim()
        }
      }
      const res = await fetch('/api/admin/aprovacoes', {
        method: 'PATCH',
        headers: await headers(),
        body: JSON.stringify({ alvo, id, status, motivo, cobranca_status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await loadAprovacoes(aprovFilter)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function savePreco(chave: string, valorReais: string) {
    const reais = Number(String(valorReais).replace(',', '.'))
    if (!Number.isFinite(reais) || reais < 0) {
      setError('Valor inválido')
      return
    }
    setBusyId(chave)
    try {
      const res = await fetch('/api/admin/precos', {
        method: 'PUT',
        headers: await headers(),
        body: JSON.stringify({ chave, valor_centavos: Math.round(reais * 100) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await loadPrecos()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  if (loading && !data) return <DropzoneLoader label="Carregando administração" />

  const metrics = data?.metrics || {}
  const infra = metrics.infra || {}

  return (
    <main className="system-admin-page">
      <header className="system-admin-header">
        <div>
          <img src="/dropzone-icon.png" alt="" />
          <span>
            <p>DropZone</p>
            <h1>Administração do sistema</h1>
          </span>
        </div>
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>

      <nav className="system-admin-tabs">
        {(
          [
            ['overview', 'Visão geral'],
            ['aprovacoes', 'Aprovações'],
            ['precos', 'Preços'],
            ['saques', 'Saques'],
            ['accounts', 'Contas'],
            ['reports', `Denúncias`],
            ['audit', 'Auditoria'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'reports' ? <b>{metrics.reportsPending || 0}</b> : null}
          </button>
        ))}
      </nav>

      {error ? <div className="admin-feedback error">{error}</div> : null}

      {tab === 'overview' ? (
        <>
          <section className="admin-metric-grid">
            <article>
              <Users />
              <span>
                <strong>{metrics.authUsers || 0}</strong>Usuários autenticados
              </span>
            </article>
            <article>
              <ShieldCheck />
              <span>
                <strong>{metrics.profiles?.produtora || 0}</strong>Produtoras
              </span>
            </article>
            <article>
              <ShieldCheck />
              <span>
                <strong>{metrics.profiles?.equipe || 0}</strong>Equipes
              </span>
            </article>
            <article>
              <UserRoundCheck />
              <span>
                <strong>{metrics.profiles?.jogador || 0}</strong>Jogadores
              </span>
            </article>
            <article>
              <UserRoundCheck />
              <span>
                <strong>{metrics.profiles?.manager || 0}</strong>Managers
              </span>
            </article>
            <article>
              <BarChart3 />
              <span>
                <strong>{metrics.championships || 0}</strong>Campeonatos
              </span>
            </article>
            <article>
              <AlertTriangle />
              <span>
                <strong>{metrics.reportsPending || 0}</strong>Denúncias abertas
              </span>
            </article>
            <article>
              <Ban />
              <span>
                <strong>{metrics.restrictions || 0}</strong>Restrições ativas
              </span>
            </article>
          </section>
          <section className="admin-infra-grid">
            <article>
              <Database />
              <div>
                <small>Banco de dados</small>
                <strong>{bytes(Number(infra.database_bytes || 0))}</strong>
              </div>
            </article>
            <article>
              <HardDrive />
              <div>
                <small>Storage</small>
                <strong>{bytes(Number(infra.storage_bytes || 0))}</strong>
                <span>{infra.storage_objects || 0} arquivos</span>
              </div>
            </article>
          </section>
        </>
      ) : null}

      {tab === 'aprovacoes' ? (
        <section className="admin-section">
          <header>
            <div>
              <p>Gate de publicação</p>
              <h2>Aprovar produtoras e campeonatos</h2>
            </div>
            <select value={aprovFilter} onChange={(e) => setAprovFilter(e.target.value)}>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados</option>
              <option value="rejeitado">Rejeitados</option>
            </select>
          </header>
          {aprovacoes?.needs_migration ? (
            <div className="admin-feedback error">
              Rode o SQL: <code>database/migrations/20260719_sistema_aprovacao_precos.sql</code>
            </div>
          ) : null}

          <h3>Produtoras ({(aprovacoes?.produtoras || []).length})</h3>
          <div className="admin-publication-grid">
            {(aprovacoes?.produtoras || []).map((p: any) => (
              <article key={p.id}>
                <div>
                  <strong>{p.nome}</strong>
                  <span className={`admin-status ${p.aprovacao_status}`}>{p.aprovacao_status}</span>
                </div>
                <small>
                  @{p.username} · {p.email_contato || '—'}
                </small>
                <div className="admin-row-actions">
                  {p.aprovacao_status !== 'aprovado' ? (
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void setAprovacao('produtora', p.id, 'aprovado')}
                    >
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                  ) : null}
                  {p.aprovacao_status !== 'rejeitado' ? (
                    <button
                      type="button"
                      className="danger"
                      disabled={busyId === p.id}
                      onClick={() => void setAprovacao('produtora', p.id, 'rejeitado')}
                    >
                      <XCircle size={14} /> Rejeitar
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <h3>Campeonatos ({(aprovacoes?.campeonatos || []).length})</h3>
          <div className="admin-publication-grid">
            {(aprovacoes?.campeonatos || []).map((c: any) => (
              <article key={c.id}>
                <div>
                  <strong>{c.nome}</strong>
                  <span className={`admin-status ${c.aprovacao_status}`}>{c.aprovacao_status}</span>
                </div>
                <small>
                  {c.tipo} · cobrança:{' '}
                  {c.cobranca
                    ? `${money(c.cobranca.valor_total_centavos)} (${c.cobranca.status})`
                    : '—'}
                </small>
                <div className="admin-row-actions">
                  {c.aprovacao_status !== 'aprovado' ? (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void setAprovacao('campeonato', c.id, 'aprovado')}
                    >
                      <CheckCircle2 size={14} /> Aprovar p/ ir ao ar
                    </button>
                  ) : null}
                  {c.aprovacao_status !== 'rejeitado' ? (
                    <button
                      type="button"
                      className="danger"
                      disabled={busyId === c.id}
                      onClick={() => void setAprovacao('campeonato', c.id, 'rejeitado')}
                    >
                      <XCircle size={14} /> Rejeitar
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'precos' ? (
        <section className="admin-section">
          <header>
            <div>
              <p>Comercial</p>
              <h2>Tabela de preços (BRL)</h2>
            </div>
          </header>
          {precos?.exemplo ? (
            <p className="admin-feedback" style={{ borderColor: 'var(--line)' }}>
              Exemplo copa 16 vagas + export + stream + rulebook + stats:{' '}
              <strong>{precos.exemplo.valor_total_brl}</strong>
            </p>
          ) : null}
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Valor (R$)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(precos?.precos || []).map((row: any) => (
                  <tr key={row.chave}>
                    <td>
                      <strong>{row.rotulo}</strong>
                      <small>{row.descricao}</small>
                    </td>
                    <td>{row.categoria}</td>
                    <td>
                      <input
                        key={`${row.chave}-${row.valor_centavos}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(Number(row.valor_centavos) / 100).toFixed(2)}
                        id={`preco-${row.chave}`}
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={busyId === row.chave}
                        onClick={() => {
                          const el = document.getElementById(`preco-${row.chave}`) as HTMLInputElement | null
                          void savePreco(row.chave, el?.value || '0')
                        }}
                      >
                        Salvar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'saques' ? (
        <section className="admin-section">
          <header>
            <div>
              <p>Carteira</p>
              <h2>Saques solicitados</h2>
            </div>
            <button type="button" onClick={() => void loadSaques()}>
              Atualizar
            </button>
          </header>
          <div className="admin-publication-grid">
            {saques.length === 0 ? <p className="empty">Nenhum saque pendente.</p> : null}
            {saques.map((s: any) => (
              <article key={s.id}>
                <div>
                  <strong>{money(s.valor_centavos)}</strong>
                  <span className={`admin-status ${s.status}`}>{s.status}</span>
                </div>
                <small>
                  PIX: {s.pix_chave} · {s.titular_nome || '—'}
                </small>
                <small>{new Date(s.created_at).toLocaleString('pt-BR')}</small>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={async () => {
                      setBusyId(s.id)
                      try {
                        const res = await fetch('/api/admin/saques', {
                          method: 'PATCH',
                          headers: await headers(),
                          body: JSON.stringify({ id: s.id, status: 'pago' }),
                        })
                        const json = await res.json()
                        if (!res.ok) throw new Error(json.error)
                        await loadSaques()
                      } catch (e: any) {
                        setError(e.message)
                      } finally {
                        setBusyId('')
                      }
                    }}
                  >
                    Marcar pago
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={busyId === s.id}
                    onClick={async () => {
                      const motivo = window.prompt('Motivo da rejeição:')
                      if (motivo === null) return
                      setBusyId(s.id)
                      try {
                        const res = await fetch('/api/admin/saques', {
                          method: 'PATCH',
                          headers: await headers(),
                          body: JSON.stringify({ id: s.id, status: 'rejeitado', motivo }),
                        })
                        const json = await res.json()
                        if (!res.ok) throw new Error(json.error)
                        await loadSaques()
                      } catch (e: any) {
                        setError(e.message)
                      } finally {
                        setBusyId('')
                      }
                    }}
                  >
                    Rejeitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'accounts' ? (
        <section className="admin-section">
          <header>
            <div>
              <p>Moderação</p>
              <h2>Contas e publicações</h2>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar nome, usuário ou tipo"
            />
          </header>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cadastro</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((item: any) => (
                  <tr key={`${item.tipo}-${item.id}`}>
                    <td>
                      <strong>{item.nome}</strong>
                      <small>@{item.username || '-'}</small>
                    </td>
                    <td>{item.tipo}</td>
                    <td>
                      <span className={`admin-status ${item.status}`}>{item.status}</span>
                    </td>
                    <td>{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className="admin-row-actions">
                        {item.status !== 'ativo' ? (
                          <button type="button" onClick={() => void moderate(item, 'restaurar')}>
                            Restaurar
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => void moderate(item, 'suspender')}>
                              Suspender
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => void moderate(item, 'banir')}
                            >
                              Banir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Campeonatos/publicações</h3>
          <div className="admin-publication-grid">
            {(data?.championships || []).map((item: any) => (
              <article key={item.id}>
                <div>
                  <strong>{item.nome}</strong>
                  <span className={`admin-status ${item.status}`}>{item.status}</span>
                </div>
                <div className="admin-row-actions">
                  {item.status !== 'ativo' ? (
                    <button
                      type="button"
                      onClick={() => void moderate({ ...item, tipo: 'campeonato' }, 'restaurar')}
                    >
                      Restaurar
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void moderate({ ...item, tipo: 'campeonato' }, 'suspender')}
                      >
                        Suspender
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void moderate({ ...item, tipo: 'campeonato' }, 'banir')}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'reports' ? (
        <section className="admin-section">
          <header>
            <div>
              <p>Fila de análise</p>
              <h2>Denúncias recebidas</h2>
            </div>
          </header>
          <div className="admin-report-list">
            {(data?.reports || []).map((item: any) => (
              <article key={item.id}>
                <header>
                  <span className={`admin-status ${item.status}`}>{item.status.replace('_', ' ')}</span>
                  <time>{new Date(item.created_at).toLocaleString('pt-BR')}</time>
                </header>
                <strong>{item.categoria}</strong>
                <p>{item.descricao}</p>
                <small>
                  {item.alvo_tipo} · {item.alvo_id}
                </small>
                {item.resolucao ? <blockquote>{item.resolucao}</blockquote> : null}
                <div className="admin-row-actions">
                  <button type="button" onClick={() => void resolveReport(item, 'em_analise')}>
                    Analisar
                  </button>
                  <button type="button" onClick={() => void resolveReport(item, 'resolvida')}>
                    Resolver
                  </button>
                  <button type="button" onClick={() => void resolveReport(item, 'arquivada')}>
                    Arquivar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section className="admin-section">
          <header>
            <div>
              <p>Segurança</p>
              <h2>Histórico administrativo</h2>
            </div>
          </header>
          <div className="admin-audit-list">
            {(data?.audits || []).map((item: any) => (
              <div key={item.id}>
                <strong>{String(item.acao || '').replaceAll('_', ' ')}</strong>
                <span>
                  {item.alvo_tipo} · {item.alvo_id}
                </span>
                <time>{new Date(item.created_at).toLocaleString('pt-BR')}</time>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
