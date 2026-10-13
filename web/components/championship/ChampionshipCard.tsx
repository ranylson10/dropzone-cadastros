'use client'

import Link from 'next/link'

import { Heart, Info, ShoppingCart, Trophy } from 'lucide-react'
import { IconButton } from '@/components/ui'

export type ChampionshipCardModel = {
  id: string
  name: string
  href: string
  bannerUrl?: string | null
  producerLabel?: string | null
  formatLabel?: string | null
  priceLabel?: string | null
  freeSlots?: number | null
  totalSlots?: number | null
  statusLabel?: string | null
  secondaryBadge?: string | null
  participationLabel?: string | null
}

export type ChampionshipCardProps = {
  championship: ChampionshipCardModel
  favorite?: boolean
  inCart?: boolean
  favoritePending?: boolean
  cartPending?: boolean
  cartDisabled?: boolean
  onFavorite?: () => void
  onCart?: () => void
  onInfo?: () => void
  className?: string
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function ChampionshipCard({
  championship,
  favorite = false,
  inCart = false,
  favoritePending = false,
  cartPending = false,
  cartDisabled = false,
  onFavorite,
  onCart,
  onInfo,
  className,
}: ChampionshipCardProps) {
  const freeSlots = Math.max(0, Number(championship.freeSlots || 0))
  const statusLabel = championship.statusLabel || (freeSlots > 0 ? `${freeSlots} vaga${freeSlots === 1 ? '' : 's'}` : 'Sem vagas')
  const producerLabel = championship.producerLabel || championship.formatLabel || 'Campeonato Free Fire'
  const priceLabel = championship.priceLabel || 'Sob consulta'

  return (
    <article className={classes('dz-champ-card', className)} data-championship-id={championship.id}>
      <div className="dz-champ-card-media">
        <Link className="dz-champ-card-art" href={championship.href} aria-label={`Abrir ${championship.name}`}>
          {championship.bannerUrl
            ? <img src={championship.bannerUrl} alt="" loading="lazy" decoding="async" />
            : <span className="dz-champ-card-fallback" aria-hidden="true"><Trophy size={42} /></span>}
        </Link>

        <div className="dz-champ-card-badges" aria-label="Situação do campeonato">
          <span className={freeSlots <= 0 ? 'is-closed' : freeSlots <= 3 ? 'is-urgent' : !championship.statusLabel || statusLabel === 'Vagas abertas' ? 'is-open' : ''}>{statusLabel}</span>
          {championship.secondaryBadge ? <span>{championship.secondaryBadge}</span> : null}
          {championship.participationLabel ? <span className="is-participating">{championship.participationLabel}</span> : null}
        </div>

        <div className="dz-champ-card-actions" aria-label={`Ações de ${championship.name}`}>
          <IconButton
            icon={<Heart size={17} />}
            label={favorite ? `Remover ${championship.name} dos favoritos` : `Favoritar ${championship.name}`}
            className={favorite ? 'is-active' : ''}
            aria-pressed={favorite}
            disabled={!onFavorite || favoritePending}
            onClick={onFavorite}
          />
          <IconButton
            icon={<ShoppingCart size={17} />}
            label={inCart ? `Remover ${championship.name} do carrinho` : `Adicionar ${championship.name} ao carrinho`}
            className={inCart ? 'is-active' : ''}
            aria-pressed={inCart}
            disabled={!onCart || cartPending || cartDisabled}
            onClick={onCart}
          />
          {onInfo ? (
            <IconButton icon={<Info size={17} />} label={`Informações de ${championship.name}`} onClick={onInfo} />
          ) : (
            <Link className="dz-champ-card-info" href={championship.href} aria-label={`Informações de ${championship.name}`} title="Informações"><Info size={17} /></Link>
          )}
        </div>

        <Link className="dz-champ-card-caption" href={championship.href}>
          <span className="dz-champ-card-copy">
            <small>{producerLabel}{championship.formatLabel && championship.formatLabel !== producerLabel ? <span className="dz-champ-card-mobile-format"> · {championship.formatLabel}</span> : null}</small>
            <strong>{championship.name}</strong>
            {championship.formatLabel && championship.formatLabel !== producerLabel ? <em>{championship.formatLabel}</em> : null}
          </span>
          <span className="dz-champ-card-commerce">
            <b>{priceLabel}</b>
            <small>{freeSlots} vaga{freeSlots === 1 ? '' : 's'}</small>
          </span>
        </Link>
      </div>
    </article>
  )
}
