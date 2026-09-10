'use client'

import { Gift, Heart, ShoppingCart, Ticket, X } from 'lucide-react'
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
      freeSlots: Number(item.vagas_livres || 0),
    })
    setFavorite(next.some((saved) => saved.id === item.id))
  }

  return (
    <article className="vacancy-catalog-card">
      <a className="vacancy-catalog-cover" href={detailsHref} aria-label={`Abrir campeonato ${item.nome}`}>
        {item.banner_url
          ? <img src={item.banner_url} alt="" loading="lazy" decoding="async" />
          : <span className="vacancy-catalog-cover-fallback"><Ticket size={34} /></span>}
      </a>
      <div className="vacancy-catalog-actions">
        <button className={favorite ? 'active' : ''} type="button" onClick={toggleFavorite} aria-label={favorite ? `Remover ${item.nome} dos favoritos` : `Adicionar ${item.nome} aos favoritos`} aria-pressed={favorite}><Heart size={16} /></button>
        <button type="button" onClick={() => onBuy(item)} aria-label={`${buyLabel}: ${item.nome}`} title={buyLabel}><ShoppingCart size={16} /></button>
      </div>
      <a className="vacancy-catalog-content" href={detailsHref}>
        <small>{item.tipo || 'Campeonato'}</small>
        <h2>{item.nome}</h2>
        <div className="vacancy-catalog-facts">
          <span><strong>{Number(item.vagas_livres || 0)}</strong><b>livres</b></span>
          {prize ? <span><strong>{prize}</strong><b>prêmio</b></span> : <span><strong>{vacancyMoney(item.valor_inscricao)}</strong><b>por vaga</b></span>}
        </div>
        <p>Próximo jogo: <strong>{vacancyDateLabel(item.proxima_data)}</strong>{item.proximo_horario ? ` · ${String(item.proximo_horario).slice(0, 5)}h` : ''}</p>
        {item.ja_tem_vaga ? <em><Gift size={12} /> Sua equipe já participa</em> : null}
      </a>
      <button className="vacancy-catalog-preview" type="button" onClick={() => onPreview(item)} aria-label={`Ampliar banner de ${item.nome}`}>Ver banner</button>
    </article>
  )
}

export function VacancyPreview({ item, onClose }: { item: VacancyCatalogItem | null; onClose: () => void }) {
  if (!item) return null
  return <div className="vacancy-preview-overlay" onClick={onClose}><button onClick={onClose} aria-label="Fechar banner"><X size={21} /></button><figure onClick={(event) => event.stopPropagation()}>{item.banner_url ? <img src={item.banner_url} alt={`Banner completo de ${item.nome}`} /> : null}<figcaption>{item.nome}</figcaption></figure></div>
}
