'use client'

import { X } from 'lucide-react'
import { ChampionshipCard } from '@/components/championship'
import { championshipCommerceItem, commerceMoney, useCommerce, type CommerceOrigin } from '@/features/commerce'
import './vacancy-card.css'
import { registrationAmount, registrationPriceLabel } from '@/lib/registration-price'

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

export const vacancyMoney = commerceMoney

export function hasVacancyPrize(item: VacancyCatalogItem) {
  return Boolean(item.premiacao || item.descricao_premiacao)
}

export function VacancyCard({
  item,
  onPreview,
  origin = 'direto',
  sellerManagerId = null,
}: {
  item: VacancyCatalogItem
  onPreview: (item: VacancyCatalogItem) => void
  origin?: CommerceOrigin
  sellerManagerId?: string | null
}) {
  const detailsHref = `/campeonatos/${item.id}`
  const free = Math.max(0, Number(item.vagas_livres || 0))
  const { cartIds, wishlistIds, pendingCartIds, pendingWishlistIds, toggleCart, toggleWishlist } = useCommerce()
  const commerceItem = championshipCommerceItem(item, { origin, sellerManagerId })
  const favorite = wishlistIds.has(item.id)
  const inCart = cartIds.has(item.id)

  return (
    <ChampionshipCard
      championship={{
        id: item.id,
        name: item.nome,
        href: detailsHref,
        bannerUrl: item.banner_url || item.logo_url || null,
        producerLabel: item.produtora_nome || 'Produtora DropZone',
        formatLabel: item.tipo || null,
        priceLabel: registrationPriceLabel(item.valor_inscricao),
        freeSlots: free,
        totalSlots: Number(item.total_vagas || 0),
        statusLabel: free > 0 && free <= 3 ? 'Últimas vagas' : free > 0 ? 'Vagas abertas' : 'Sem vagas',
        secondaryBadge: registrationAmount(item.valor_inscricao) === 0 ? 'Grátis' : null,
        participationLabel: item.ja_tem_vaga ? 'Sua equipe participa' : null,
      }}
      favorite={favorite}
      inCart={inCart}
      favoritePending={pendingWishlistIds.has(item.id)}
      cartPending={pendingCartIds.has(item.id)}
      cartDisabled={(free <= 0 || registrationAmount(item.valor_inscricao) == null) && !inCart}
      onFavorite={() => void toggleWishlist(commerceItem, { origin })}
      onCart={() => void toggleCart(commerceItem, { origin, sellerManagerId })}
      onInfo={() => onPreview(item)}
    />
  )
}

export function VacancyPreview({ item, onClose }: { item: VacancyCatalogItem | null; onClose: () => void }) {
  if (!item) return null
  return <div className="vacancy-preview-overlay" onClick={onClose}><button onClick={onClose} aria-label="Fechar banner"><X size={21} /></button><figure onClick={(event) => event.stopPropagation()}>{item.banner_url ? <img src={item.banner_url} alt={`Banner completo de ${item.nome}`} /> : null}<figcaption><strong>{item.nome}</strong><span>{registrationPriceLabel(item.valor_inscricao)} · {Number(item.vagas_livres || 0)} vagas livres</span><a href={`/campeonatos/${item.id}`}>Abrir informações</a></figcaption></figure></div>
}
