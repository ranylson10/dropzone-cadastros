'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Filter, MapPin, MessageCircle, Search, ShieldCheck, Ticket, Users, X, ZoomIn } from 'lucide-react'
import { useParams } from 'next/navigation'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { AppShell } from '@/components/layout'
import { WhatsappContactSelector } from '@/components/forms/campeonato'
import '../../vagas/vagas.css'

function dateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

function money(value: unknown) {
  const number = Number(value)
  return number > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
    : 'Consultar'
}

export default function VendedorCampeonatosPage() {
  const params = useParams<{ managerId: string }>()
  const managerId = String(params?.managerId || '')
  const [manager, setManager] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState<any | null>(null)
  const [preview, setPreview] = useState<any | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/vendedores/${encodeURIComponent(managerId)}/vagas`, {
          cache: 'no-store',
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar vendedor.')
        setManager(json.manager || null)
        setItems(json.announcements || [])
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar vendedor.')
      } finally {
        setLoading(false)
      }
    }
    if (managerId) void load()
  }, [managerId])

  const visible = useMemo(
    () =>
      items.filter((item) =>
        `${item.nome} ${item.tipo} ${item.proximo_grupo} ${item.servidor}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  )

  const totalVagas = items.reduce((sum, item) => sum + Number(item.vagas_livres || 0), 0)
  const sellerContact = items.find((i) => i.contatos_whatsapp?.length)?.contatos_whatsapp?.[0] || null

  if (loading) return <DropzoneLoader label="Carregando vagas" />
  if (error && !manager) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <ShieldCheck size={38} />
          <h1>Vendedor indisponível</h1>
          <p>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <AppShell activeLabel="Vagas abertas" loadSession mainClassName="vacancies-page page">
        <section className="vacancies-hero">
          <div>
            <p className="eyebrow">Portfólio do afiliado</p>
            <h1>{manager?.nome || manager?.username || 'Campeonatos com vagas abertas'}</h1>
            <p>
              Mesma ideia das vagas abertas — aqui o contato de compra é deste vendedor.
              {manager?.whatsapp_url ? ' Fale direto no WhatsApp para reservar.' : ''}
            </p>
            {manager?.whatsapp_url || sellerContact?.url ? (
              <a
                className="button"
                href={manager?.whatsapp_url || sellerContact?.url}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: 12, display: 'inline-flex', gap: 8, alignItems: 'center' }}
              >
                <MessageCircle size={16} /> WhatsApp do vendedor
              </a>
            ) : null}
          </div>
          <div className="vacancies-hero-count">
            <Ticket />
            <strong>{totalVagas}</strong>
            <span>vagas disponíveis</span>
          </div>
        </section>

        <section className="vacancies-toolbar">
          <div className="vacancies-filter">
            <Filter size={15} />
            <button className="active" type="button">
              Campeonatos no portfólio ({items.length})
            </button>
          </div>
          <label>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar campeonato"
            />
          </label>
        </section>

        {error ? <div className="admin-feedback error">{error}</div> : null}
        <section className="vacancies-grid">
          {visible.map((item) => (
            <article className="vacancy-card" key={item.id}>
              <button
                className="vacancy-banner"
                type="button"
                onClick={() => setPreview(item)}
                aria-label={`Ampliar banner de ${item.nome}`}
              >
                <img src={item.banner_url} alt={`Banner ${item.nome}`} />
                <span className="vacancy-zoom-label">
                  <ZoomIn size={14} /> Ver banner
                </span>
              </button>
              <div className="vacancy-card-body">
                <header>
                  {item.logo_url ? <img src={item.logo_url} alt="" /> : null}
                  <div>
                    <p>{item.tipo}</p>
                    <h2>{item.nome}</h2>
                  </div>
                </header>
                <div className="vacancy-next-date">
                  <CalendarDays />
                  <div>
                    <small>Próxima vaga</small>
                    <strong>
                      {dateLabel(item.proxima_data)}{' '}
                      {item.proximo_horario ? `- ${String(item.proximo_horario).slice(0, 5)}h` : ''}
                    </strong>
                    <span>{item.proximo_grupo}</span>
                  </div>
                </div>
                <div className="vacancy-meta">
                  <span>
                    <Users size={14} />
                    <b>{item.vagas_livres}</b> vagas
                  </span>
                  <span>
                    <Ticket size={14} />
                    <b>{money(item.valor_inscricao)}</b>
                  </span>
                  {item.servidor ? (
                    <span>
                      <MapPin size={14} />
                      {item.servidor}
                    </span>
                  ) : null}
                </div>
                <div className="vacancy-groups">
                  {item.grupos.slice(0, 3).map((group: any) => (
                    <span key={group.id}>
                      {group.nome}
                      <b>{group.vagas_livres} livres</b>
                    </span>
                  ))}
                </div>
                <div className="vacancy-persuasion">
                  <strong>Garanta sua vaga</strong>
                  <span>Fale com este vendedor — não é a lista geral de admins do campeonato.</span>
                </div>
                {item.contatos_whatsapp?.length ? (
                  <button className="button vacancy-register" type="button" onClick={() => setContacts(item)}>
                    <MessageCircle size={16} /> Comprar vaga
                  </button>
                ) : (
                  <button className="button vacancy-register" type="button" disabled>
                    WhatsApp pendente
                  </button>
                )}
              </div>
            </article>
          ))}
          {visible.length === 0 ? (
            <div className="vacancies-empty">
              <Ticket size={32} />
              <strong>Nenhuma vaga encontrada</strong>
              <span>Este vendedor ainda não anunciou campeonatos com vagas abertas.</span>
            </div>
          ) : null}
        </section>

      {preview ? (
        <div className="vacancy-preview-overlay" onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} aria-label="Fechar banner">
            <X size={21} />
          </button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={preview.banner_url} alt={`Banner completo de ${preview.nome}`} />
            <figcaption>{preview.nome}</figcaption>
          </figure>
        </div>
      ) : null}
      {contacts ? (
        <div className="report-modal-backdrop" onClick={() => setContacts(null)}>
          <section className="report-modal vacancy-contact-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Compra com o afiliado</p>
                <h2>Comprar vaga</h2>
                <span>{contacts.nome}</span>
              </div>
              <button onClick={() => setContacts(null)}>
                <X size={18} />
              </button>
            </header>
            {contacts.contatos_whatsapp?.length ? (
              <WhatsappContactSelector contacts={contacts.contatos_whatsapp} championshipName={contacts.nome} />
            ) : (
              <p className="empty">Este vendedor ainda não cadastrou contato para venda.</p>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  )
}
