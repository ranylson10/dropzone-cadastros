'use client'

import { useEffect, useState } from 'react'
import { Copy, CreditCard, ExternalLink, MessageCircle, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type SellerItem = {
  id: string
  campeonato_id: string
  status: string
  limite_vagas?: number
  comissao_bps?: number | null
  vagas_usadas?: number
  vagas_restantes?: number | null
  vagas_disponiveis_venda?: number
  vagas_estruturais_livres?: number
  proxima_data?: string | null
  proximo_horario?: string | null
  anunciando?: boolean
  permissoes?: Record<string, boolean>
  pagamentos?: { pix?: boolean; cartao?: boolean; paypal?: boolean; cartao_max_parcelas?: number | null }
  campeonatos?: { nome?: string; logo_url?: string | null } | null
  produtoras?: { nome?: string } | null
}

type AssistedSale = {
  id: string
  token: string
  status: string
  valor_centavos: number
  payment_url?: string
  claim_url?: string
  quantidade_vagas?: number
  vagas_usadas?: number
  vagas_restantes?: number
  comprador_nome?: string | null
  comprador_whatsapp?: string | null
  created_at?: string
  pago_em?: string | null
  consumido_em?: string | null
  campeonato?: { id: string; nome?: string; logo_url?: string | null } | null
  grupo?: { id: string; nome?: string } | null
  payment?: { status?: string; metodo?: string | null; provider?: string | null; invoice_url?: string | null; paypal_approval_url?: string | null; asaas_status?: string | null } | null
}

type SaleMethod = 'pix' | 'cartao' | 'paypal'

function formatUsage(item: SellerItem) {
  const used = Number(item.vagas_usadas || 0)
  const limit = Number(item.limite_vagas || 0)
  if (limit > 0) return `${used}/${limit} vaga(s)`
  return used > 0 ? `${used} preenchida(s)` : 'Sem preenchimento'
}

function formatCommission(item: SellerItem) {
  if (item.comissao_bps === null || item.comissao_bps === undefined) return 'Comissão padrão do sistema'
  const bps = Number(item.comissao_bps || 0)
  return bps > 0
    ? `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% de comissão`
    : 'Sem comissão'
}

function formatNextDate(item: SellerItem) {
  if (!item.proxima_data) return 'Próxima data a confirmar'
  const date = new Date(`${item.proxima_data}T${item.proximo_horario || '12:00'}`)
  return `Próxima: ${date.toLocaleDateString('pt-BR')}${item.proximo_horario ? ` · ${item.proximo_horario.slice(0, 5)}` : ''}`
}

function saleStatusLabel(sale: AssistedSale) {
  if (sale.consumido_em || sale.status === 'consumido') return 'Inscrito no campeonato'
  if (sale.pago_em || ['pago', 'liberado'].includes(sale.status)) return 'Pago, aguardando inscriÃ§Ã£o'
  if (sale.status === 'expirado') return 'Pagamento expirado'
  return 'Aguardando pagamento'
}

export function ManagerVendasView(props: {
  accountId: string
  sellerItems: SellerItem[]
  sellerLoading: boolean
  sellerError: string
  feedback: string
  whatsapp: string
  setWhatsapp: (value: string) => void
  nomePublico: string
  setNomePublico: (value: string) => void
  savingProfile: boolean
  publishing: Record<string, boolean>
  onSaveProfile: () => void
  onToggleAnuncio: (campeonatoId: string, anunciar: boolean) => void
  onCopyPublicLink: () => void
  onOpenChampionship: (campeonatoId: string) => void
}) {
  const ativos = props.sellerItems.filter((item) => item.status === 'ativo' && Number(item.vagas_disponiveis_venda || 0) > 0)
  const anunciando = props.sellerItems.filter((item) => item.anunciando)
  const hasWhatsapp = Boolean(props.whatsapp.trim())
  const [sales, setSales] = useState<AssistedSale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState('')
  const [saleFeedback, setSaleFeedback] = useState('')
  const [saleChamp, setSaleChamp] = useState<SellerItem | null>(null)
  const [buyerName, setBuyerName] = useState('')
  const [saleQuantity, setSaleQuantity] = useState('1')
  const [saleMethod, setSaleMethod] = useState<SaleMethod>('pix')
  const [creatingSale, setCreatingSale] = useState(false)

  async function authHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('SessÃ£o ausente. Entre novamente.')
    return { Authorization: `Bearer ${token}` }
  }

  async function loadSales() {
    if (!props.accountId) return
    setSalesLoading(true)
    setSalesError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/vendedores/${props.accountId}/vendas`, {
        headers,
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar vendas.')
      setSales(json.sales || [])
    } catch (error: any) {
      setSalesError(error?.message || 'Erro ao carregar vendas.')
    } finally {
      setSalesLoading(false)
    }
  }

  useEffect(() => {
    void loadSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.accountId])

  useEffect(() => {
    if (!saleChamp) return
    if (saleChamp.pagamentos?.pix !== false) setSaleMethod('pix')
    else if (saleChamp.pagamentos?.cartao !== false) setSaleMethod('cartao')
    else if (saleChamp.pagamentos?.paypal) setSaleMethod('paypal')
  }, [saleChamp])

  async function copyText(text: string, message = 'Copiado.') {
    try {
      await navigator.clipboard.writeText(text)
      setSaleFeedback(message)
    } catch {
      setSaleFeedback('NÃ£o foi possÃ­vel copiar.')
    }
  }

  function saleMessage(sale: AssistedSale) {
    const champName = sale.campeonato?.nome || 'campeonato'
    return [
      `${sale.quantidade_vagas || 1} vaga(s) ${champName}`,
      sale.payment_url ? `Pagamento: ${sale.payment_url}` : '',
      sale.claim_url ? `Depois do pagamento, inscriÃ§Ã£o: ${sale.claim_url}` : '',
      `Token: ${sale.token}`,
    ].filter(Boolean).join('\n')
  }

  async function createAssistedSale() {
    if (!saleChamp) return
    setCreatingSale(true)
    setSalesError('')
    setSaleFeedback('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/vendedores/${props.accountId}/vendas`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campeonato_id: saleChamp.campeonato_id,
          referencia: buyerName,
          quantidade_vagas: Math.max(1, Math.min(20, Math.floor(Number(saleQuantity || 1)))),
          method: saleMethod,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar venda.')
      setSaleFeedback('Venda gerada. Copie a mensagem e mande para o comprador.')
      setBuyerName('')
      setSaleQuantity('1')
      setSaleMethod('pix')
      setSaleChamp(null)
      await loadSales()
      if (json.mensagem) await copyText(json.mensagem, 'Mensagem da venda copiada.')
    } catch (error: any) {
      setSalesError(error?.message || 'Erro ao gerar venda.')
    } finally {
      setCreatingSale(false)
    }
  }

  return (
    <>
      <section className="panel span-3">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Vendas</p>
            <h2>Portfólio</h2>
          </div>
          <ShieldCheck />
        </div>

        <div className="player-summary-grid">
          <div>
            <Users size={18} />
            <strong>{props.sellerItems.length}</strong>
            <span>Liberados</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <strong>{ativos.length}</strong>
            <span>Ativos</span>
          </div>
          <div>
            <MessageCircle size={18} />
            <strong>{anunciando.length}</strong>
            <span>No portfólio</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Contato</p>
            <h2>WhatsApp de vendas</h2>
          </div>
        </div>

        {!hasWhatsapp ? (
          <div className="message error" style={{ marginBottom: 12 }}>
            Cadastre o WhatsApp antes de anunciar.
          </div>
        ) : null}

        <div className="mini-grid two">
          <label className="field">
            <span>Nome público</span>
            <input
              value={props.nomePublico}
              onChange={(e) => props.setNomePublico(e.target.value)}
              placeholder="Ex.: Paulo Vagas"
            />
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <input
              value={props.whatsapp}
              onChange={(e) => props.setWhatsapp(e.target.value)}
              placeholder="5599999999999 ou https://wa.me/..."
            />
          </label>
        </div>

        <div className="manager-detail-actions" style={{ marginTop: 12 }}>
          <button
            className="button"
            type="button"
            disabled={props.savingProfile}
            onClick={() => props.onSaveProfile()}
          >
            {props.savingProfile ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={props.onCopyPublicLink}
            disabled={!hasWhatsapp}
            title={hasWhatsapp ? 'Copiar link do portfólio' : 'Salve o WhatsApp primeiro'}
          >
            <Copy size={14} /> Copiar link
          </button>
          <a
            className="button secondary"
            href={`/vagas?vendedor=${props.accountId}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} /> Abrir
          </a>
        </div>
      </section>

      <section className="panel span-2">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Portfólio</p>
            <h2>Campeonatos</h2>
          </div>
        </div>

        {props.sellerLoading ? <p className="empty">Carregando...</p> : null}
        {props.sellerError ? <div className="message error">{props.sellerError}</div> : null}
        {props.feedback ? <div className="message success">{props.feedback}</div> : null}
        {!props.sellerLoading && props.sellerItems.length === 0 ? (
          <p className="empty">Nenhum campeonato liberado ainda.</p>
        ) : null}

        <div className="manager-vendas-list">
          {ativos.map((item) => {
            const championship = item.campeonatos || {}
            const producer = item.produtoras || {}
            const active = item.status === 'ativo'
            const canSell =
              active &&
              item.permissoes?.vender_vagas !== false &&
              item.permissoes?.gerar_pagamentos !== false
            return (
              <article key={item.id} className={`manager-vendas-row ${active ? '' : 'is-inactive'}`}>
                <div className="manager-vendas-row-logo">
                  {championship.logo_url ? <img src={championship.logo_url} alt="" /> : <Trophy size={18} />}
                </div>
                <div className="manager-vendas-row-copy">
                  <strong>{championship.nome || 'Campeonato'}</strong>
                  <span>{producer.nome || 'Evento'}</span>
                  <small>
                    {item.vagas_disponiveis_venda || 0} vaga(s) para vender · {formatCommission(item)}
                    {item.anunciando ? ' · portfólio' : ''}
                  </small>
                  <small>{formatNextDate(item)}</small>
                </div>
                <div className="compact-row-actions manager-vendas-row-actions">
                  <button
                    className={`button small ${item.anunciando ? '' : 'secondary'}`}
                    type="button"
                    disabled={!active || Boolean(props.publishing[item.campeonato_id]) || !hasWhatsapp}
                    onClick={() => props.onToggleAnuncio(item.campeonato_id, !item.anunciando)}
                  >
                    {item.anunciando ? 'No portfólio' : 'Anunciar'}
                  </button>
                  <button
                    className="button small secondary"
                    type="button"
                    disabled={!canSell}
                    onClick={() => setSaleChamp(item)}
                  >
                    Gerar venda
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel span-3">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Venda assistida</p>
            <h2>CobranÃ§as geradas pelo vendedor</h2>
          </div>
          <button className="button secondary small" type="button" onClick={() => void loadSales()} disabled={salesLoading}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>

        {salesError ? <div className="message error">{salesError}</div> : null}
        {saleFeedback ? <div className="message success">{saleFeedback}</div> : null}
        {salesLoading ? <p className="empty">Carregando vendas...</p> : null}
        {!salesLoading && sales.length === 0 ? (
          <p className="empty">Nenhuma venda assistida gerada ainda.</p>
        ) : null}

        <div className="manager-vendas-list">
          {sales.map((sale) => (
            <article key={sale.id} className="manager-vendas-row">
              <div className="manager-vendas-row-logo">
                {sale.campeonato?.logo_url ? <img src={sale.campeonato.logo_url} alt="" /> : <CreditCard size={18} />}
              </div>
              <div className="manager-vendas-row-copy">
                <strong>{sale.campeonato?.nome || 'Venda de vaga'}</strong>
                <span>
                  {sale.comprador_nome || 'Referência não informada'} {sale.grupo?.nome ? ` · ${sale.grupo.nome}` : ''}
                </span>
                <small>
                  {saleStatusLabel(sale)} · {sale.vagas_usadas || 0}/{sale.quantidade_vagas || 1} inscrição(ões) usadas · token {sale.token}
                  {sale.payment?.status ? ` · pagamento ${sale.payment.status}` : ''}
                </small>
              </div>
              <div className="compact-row-actions manager-vendas-row-actions">
                <button
                  className="button small secondary"
                  type="button"
                  onClick={() => void copyText(saleMessage(sale), 'Mensagem da venda copiada.')}
                >
                  <Copy size={14} /> Mensagem
                </button>
                {sale.payment_url ? (
                  <a className="button small secondary" href={sale.payment_url} target="_blank" rel="noreferrer">
                    Pagar
                  </a>
                ) : null}
                {sale.claim_url ? (
                  <a className="button small" href={sale.claim_url} target="_blank" rel="noreferrer">
                    Inscrever
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {saleChamp ? (
        <div className="report-modal-backdrop" role="presentation" onClick={() => setSaleChamp(null)}>
          <section className="report-modal" onClick={(event) => event.stopPropagation()}>
            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">Gerar venda</p>
                <h2>{saleChamp.campeonatos?.nome || 'Campeonato'}</h2>
              </div>
              <button className="button secondary small" type="button" onClick={() => setSaleChamp(null)}>
                Fechar
              </button>
            </div>

            <p className="empty" style={{ marginTop: 0 }}>
              O sistema gera o pagamento, registra a venda para este vendedor e libera o link de inscriÃ§Ã£o quando confirmar.
              {' '}Comissão desta vaga: {formatCommission(saleChamp)}.
            </p>

            <div className="manager-detail-actions" style={{ marginBottom: 12 }}>
              {saleChamp.pagamentos?.pix !== false ? (
                <button
                  className={saleMethod === 'pix' ? 'button small' : 'button small secondary'}
                  type="button"
                  onClick={() => setSaleMethod('pix')}
                >
                  PIX
                </button>
              ) : null}
              {saleChamp.pagamentos?.cartao !== false ? (
                <button
                  className={saleMethod === 'cartao' ? 'button small' : 'button small secondary'}
                  type="button"
                  onClick={() => setSaleMethod('cartao')}
                >
                  Cartão{Number(saleChamp.pagamentos?.cartao_max_parcelas || 1) > 1 ? ' até ' + saleChamp.pagamentos?.cartao_max_parcelas + 'x' : ''}
                </button>
              ) : null}
              {saleChamp.pagamentos?.paypal ? (
                <button
                  className={saleMethod === 'paypal' ? 'button small' : 'button small secondary'}
                  type="button"
                  onClick={() => setSaleMethod('paypal')}
                >
                  PayPal
                </button>
              ) : null}
            </div>

            <div className="mini-grid two">
              <label className="field">
                <span>Referência da venda</span>
                <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Ex.: ALOE, cliente João, vaga 01" />
              </label>
              <label className="field">
                <span>Quantidade de vagas</span>
                <input type="number" min={1} max={20} value={saleQuantity} onChange={(e) => setSaleQuantity(e.target.value)} />
              </label>
            </div>

            <div className="manager-detail-actions" style={{ marginTop: 12 }}>
              <button className="button" type="button" disabled={creatingSale} onClick={() => void createAssistedSale()}>
                {creatingSale ? 'Gerando...' : saleMethod === 'paypal' ? 'Gerar PayPal' : saleMethod === 'cartao' ? 'Gerar cartão' : 'Gerar PIX'}
              </button>
              <button className="button secondary" type="button" onClick={() => setSaleChamp(null)}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
