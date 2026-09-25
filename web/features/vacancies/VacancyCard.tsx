'use client'

import { CalendarDays, Heart, ShoppingCart, Ticket, Trophy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getWishlistItems, toggleWishlist } from '@/features/commerce/local-commerce'
import './vacancy-card.css'

export type VacancyCatalogItem = {
  id: string
  nome: string
  tipo?: string | null
  logo_url?: string | null
  banner_url?: string | null
  valor_inscricao?: number | string | null
  premiacao?: number | string | null
  descricao_premiacao?: string | null
  tem_live?: boolean
  vagas_livres?: number
  total_vagas?: number
  proxima_data?: string | null
  proximo_horario?: string | null
  proximo_grupo?: string | null
  servidor?: string | null
  produtora_id?: string | null
  produtora_nome?: string | null
  produtora_logo_url?: string | null
  data_limite_inscricao?: string | null
  aceita_novas_inscricoes_equipes?: boolean
  ja_tem_vaga?: boolean
  grupos?: Array<{ id: string; nome: string; vagas_livres?: number }>
  [key: string]: unknown
}

export function vacancyDateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function vacancyMoney(value: unknown) {
  const number = Number(value)
  return number > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : 'Grátis'
}

export function hasVacancyPrize(item: VacancyCatalogItem) {
  return Boolean(item.premiacao || item.descricao_premiacao)
}

function deadlineLabel(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function VacancyCard({
  item,
  onPreview,
  onBuy,
  buyLabel = 'Garantir vaga',
}: {
  item: VacancyCatalogItem
  onPreview: (item: VacancyCatalogItem) => void
  onBuy: (item: VacancyCatalogItem) => void
  buyLabel?: string
}) {
  const detailsHref = `/campeonatos/${item.id}`
  const prize = item.premiacao ? vacancyMoney(item.premiacao) : item.descricao_premiacao ? 'Premiação' : null
  const free = Number(item.vagas_livres || 0)
  const total = Math.max(free, Number(item.total_vagas || 0))
  const occupied = Math.max(0, total - free)
  const occupancy = total > 0 ? Math.min(100, Math.round((occupied / total) * 100)) : 0
  const deadline = deadlineLabel(item.data_limite_inscricao)
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    const refresh = () => setFavorite(getWishlistItems().some((saved) => saved.id === item.id))
    refresh()
    window.addEventListener('dropzone:commerce-updated', refresh)
    return () => window.removeEventListener('dropzone:commerce-updated', refresh)
  }, [item.id])

  const toggleFavorite = () => {
    const next = toggleWishlist({
      id: item.id,
      name: item.nome,
      href: detailsHref,
      image: item.logo_url,
      banner: item.banner_url,
      price: Number(item.valor_inscricao || 0),
      freeSlots: free,
    })
    setFavorite(next.some((saved) => saved.id === item.id))
  }

  return (
    <article className="vacancy-catalog-card">
      <div className="vacancy-catalog-media-wrap">
        <a className="vacancy-catalog-cover" href={detailsHref} aria-label={`Abrir campeonato ${item.nome}`}>
          {item.banner_url
            ? <img src={item.banner_url} alt="" loading="lazy" decoding="async" />
            : <span className="vacancy-catalog-cover-fallback"><Trophy size={38} /></span>}
        </a>
        <span className="vacancy-catalog-badges">
          {free > 0 ? <b className={free <= 3 ? 'urgent' : ''}>{free <= 3 ? 'Últimas vagas' : 'Vagas abertas'}</b> : <b className="closed">Sem vagas</b>}
          {Number(item.valor_inscricao || 0) <= 0 ? <b className="free">Grátis</b> : null}
        </span>
        <div className="vacancy-catalog-actions">
          <button className={favorite ? 'active' : ''} type="button" onClick={toggleFavorite} aria-label={favorite ? `Remover ${item.nome} dos favoritos` : `Adicionar ${item.nome} aos favoritos`} aria-pressed={favorite}><Heart size={16} /></button>
          <button type="button" onClick={() => onPreview(item)} aria-label={`Ampliar banner de ${item.nome}`} title="Ver banner"><Ticket size={16} /></button>
        </div>
      </div>

      <div className="vacancy-catalog-content">
        <div className="vacancy-catalog-producer">
          {item.produtora_logo_url ? <img src={item.produtora_logo_url} alt="" /> : null}
          <span>{item.produtora_nome || item.tipo || 'Produtora DropZone'}</span>
        </div>
        <a className="vacancy-catalog-title" href={detailsHref}><h2>{item.nome}</h2></a>

        <div className="vacancy-catalog-facts">
          <span><CalendarDays size={13} /><b>{vacancyDateLabel(item.proxima_data)}</b><small>{item.proximo_horario ? `${String(item.proximo_horario).slice(0, 5)}h` : 'próximo jogo'}</small></span>
          <span><Trophy size={13} /><b>{prize || 'A confirmar'}</b><small>premiação</small></span>
        </div>

        <div className="vacancy-catalog-sale-row">
          <div><small>VAGA A PARTIR DE</small><strong>{vacancyMoney(item.valor_inscricao)}</strong>{deadline ? <em>Inscrições até {deadline}</em> : null}</div>
          <span><b>{free}</b><small>livres</small></span>
        </div>

        {total > 0 ? <div className="vacancy-catalog-capacity" aria-label={`${free} vagas livres de ${total}`}><span><i style={{ width: `${occupancy}%` }} /></span><small>{occupied} ocupadas · {free} livres</small></div> : null}
        {item.ja_tem_vaga ? <p className="vacancy-catalog-owned">Sua equipe já participa deste campeonato.</p> : null}

        <div className="vacancy-catalog-cta-row">
          <a href={detailsHref}>Ver detalhes</a>
          <button type="button" onClick={() => onBuy(item)} disabled={free <= 0}><ShoppingCart size={15} /> {free > 0 ? buyLabel : 'Sem vagas'}</button>
        </div>
      </div>
    </article>
  )
}

export function VacancyPreview({ item, onClose }: { item: VacancyCatalogItem | null; onClose: () => void }) {
  if (!item) return null
  return <div className="vacancy-preview-overlay" onClick={onClose}><button onClick={onClose} aria-label="Fechar banner"><X size={21} /></button><figure onClick={(event) => event.stopPropagation()}>{item.banner_url ? <img src={item.banner_url} alt={`Banner completo de ${item.nome}`} /> : null}<figcaption>{item.nome}</figcaption></figure></div>
}
