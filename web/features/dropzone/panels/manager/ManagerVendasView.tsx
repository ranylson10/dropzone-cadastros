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
  if (limit > 0) return `${used}/${limit} vaga(s) preenchidas`
  return used > 0 ? `${used} preenchida(s) · sem limite` : 'Ainda sem preenchimento'
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
  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/vendedores/${props.accountId}`
      : `/vendedores/${props.accountId}`

  return (
    <>
      <section className="panel span-3">
        <div className="section-head">
          <div>
            <p className="eyebrow">Manager / afiliado</p>
            <h2>Central de vendas</h2>
            <p className="empty" style={{ marginTop: 6 }}>
              Configure o contato, anuncie no link e depois preencha as vagas vendidas no campeonato.
            </p>
          </div>
          <ShieldCheck />
        </div>
        <div className="player-summary-grid">
          <div>
            <Users size={18} />
            <strong>{props.sellerItems.length}</strong>
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
        <h2>1. Seu link de vendas (portfólio)</h2>
        <p className="empty" style={{ marginBottom: 12 }}>
          O comprador abre este link, vê os campeonatos que você anunciou e fala no <strong>seu WhatsApp</strong>.
        </p>

        {!hasWhatsapp ? (
          <div className="message error" style={{ marginBottom: 12 }}>
            Cadastre o WhatsApp de compra antes de divulgar o link — sem isso o portfólio não fecha a venda.
          </div>
        ) : null}

        <div className="compact-row">
          <div>
            <strong>Link público</strong>
            <span>{publicUrl}</span>
          </div>
          <div className="compact-row-actions">
            <button className="button small" type="button" onClick={props.onCopyPublicLink}>
              <Copy size={14} /> Copiar
            </button>
            <a className="button small secondary" href={`/vendedores/${props.accountId}`} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
        </div>

        <div className="mini-grid two" style={{ marginTop: 14 }}>
          <label className="field">
            <span>Nome público de vendas</span>
            <input
              value={props.nomePublico}
              onChange={(e) => props.setNomePublico(e.target.value)}
              placeholder="Ex.: Paulo Vagas"
            />
          </label>
          <label className="field">
            <span>WhatsApp de compra (seu contato)</span>
            <input
              value={props.whatsapp}
              onChange={(e) => props.setWhatsapp(e.target.value)}
              placeholder="5599999999999 ou https://wa.me/..."
            />
          </label>
        </div>
        <button
          className="button"
          type="button"
          disabled={props.savingProfile}
          onClick={() => props.onSaveProfile()}
          style={{ marginTop: 10 }}
        >
          {props.savingProfile ? 'Salvando...' : 'Salvar contato de vendas'}
        </button>
      </section>

      <section className="panel span-2">
        <h2>2. Campeonatos liberados — anunciar e preencher</h2>
        <p className="empty" style={{ marginBottom: 12 }}>
          <strong>Anunciar</strong> coloca o evento no seu link. <strong>Preencher vagas</strong> abre a operação para
          cadastrar a line/equipe que comprou com você.
        </p>
        {props.sellerLoading ? <p className="empty">Carregando...</p> : null}
        {props.sellerError ? <div className="message error">{props.sellerError}</div> : null}
        {props.feedback ? <div className="message success">{props.feedback}</div> : null}
        {!props.sellerLoading && props.sellerItems.length === 0 ? (
          <p className="empty">
            Nenhum campeonato ainda. Aceite o convite da produtora; depois o produtor libera os eventos que você pode
            vender.
          </p>
        ) : null}

        <div className="manager-vendas-list">
          {props.sellerItems.map((item) => {
            const championship = item.campeonatos || {}
            const producer = item.produtoras || {}
            const active = item.status === 'ativo'
            const canFill = active && item.permissoes?.adicionar_equipes !== false
            return (
              <article key={item.id} className={`manager-vendas-row ${active ? '' : 'is-inactive'}`}>
                <div className="manager-vendas-row-logo">
                  {championship.logo_url ? <img src={championship.logo_url} alt="" /> : <Trophy size={18} />}
                </div>
                <div className="manager-vendas-row-copy">
                  <strong>{championship.nome || 'Campeonato'}</strong>
                  <span>{producer.nome ? `Produtora ${producer.nome}` : 'Campeonato'}</span>
                  <small>
                    {active ? 'Liberado' : 'Inativo'}
                    {' · '}
                    {formatUsage(item)}
                    {item.anunciando ? ' · no portfólio' : ' · fora do link'}
                  </small>
                </div>
                <div className="compact-row-actions manager-vendas-row-actions">
                  <button
                    className={`button small ${item.anunciando ? '' : 'secondary'}`}
                    type="button"
                    disabled={!active || Boolean(props.publishing[item.campeonato_id]) || !hasWhatsapp}
                    onClick={() => props.onToggleAnuncio(item.campeonato_id, !item.anunciando)}
                    title={
                      !hasWhatsapp
                        ? 'Salve o WhatsApp antes de anunciar'
                        : active
                          ? 'Incluir ou tirar este campeonato do seu link público'
                          : 'Vínculo inativo'
                    }
                  >
                    {item.anunciando ? 'No portfólio' : 'Anunciar'}
                  </button>
                  <button
                    className="button small"
                    type="button"
                    disabled={!canFill}
                    onClick={() => props.onOpenChampionship(item.campeonato_id)}
                    title="Abrir vagas do campeonato para adicionar lines"
                  >
                    Preencher vagas
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
