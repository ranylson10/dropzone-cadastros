'use client'

import { Copy, ExternalLink, MessageCircle, ShieldCheck, Trophy, Users } from 'lucide-react'

type SellerItem = {
  id: string
  campeonato_id: string
  status: string
  limite_vagas?: number
  vagas_usadas?: number
  vagas_restantes?: number | null
  anunciando?: boolean
  permissoes?: Record<string, boolean>
  campeonatos?: { nome?: string; logo_url?: string | null } | null
  produtoras?: { nome?: string } | null
}

function formatUsage(item: SellerItem) {
  const used = Number(item.vagas_usadas || 0)
  const limit = Number(item.limite_vagas || 0)
  if (limit > 0) return `${used}/${limit} vaga(s)`
  return used > 0 ? `${used} preenchida(s)` : 'Sem preenchimento'
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
  const ativos = props.sellerItems.filter((item) => item.status === 'ativo')
  const anunciando = props.sellerItems.filter((item) => item.anunciando)
  const hasWhatsapp = Boolean(props.whatsapp.trim())

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
            href={`/vendedores/${props.accountId}`}
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
          {props.sellerItems.map((item) => {
            const championship = item.campeonatos || {}
            const producer = item.produtoras || {}
            const active = item.status === 'ativo'
            const canFill =
              active &&
              (item.permissoes?.gerar_convites_equipe !== false || item.permissoes?.adicionar_equipes === true)
            return (
              <article key={item.id} className={`manager-vendas-row ${active ? '' : 'is-inactive'}`}>
                <div className="manager-vendas-row-logo">
                  {championship.logo_url ? <img src={championship.logo_url} alt="" /> : <Trophy size={18} />}
                </div>
                <div className="manager-vendas-row-copy">
                  <strong>{championship.nome || 'Campeonato'}</strong>
                  <span>{producer.nome || 'Evento'}</span>
                  <small>
                    {active ? 'Liberado' : 'Inativo'} · {formatUsage(item)}
                    {item.anunciando ? ' · portfólio' : ''}
                  </small>
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
                    className="button small"
                    type="button"
                    disabled={!canFill}
                    onClick={() => props.onOpenChampionship(item.campeonato_id)}
                  >
                    Preencher
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}
