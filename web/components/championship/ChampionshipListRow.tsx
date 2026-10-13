'use client'

import Link from 'next/link'

import { ChevronRight, Heart, ShoppingCart, Trophy } from 'lucide-react'
import { IconButton } from '@/components/ui'

export type ChampionshipListRowModel = {
  id: string
  name: string
  href: string
  imageUrl?: string | null
  isBannerImage?: boolean
  producerLabel?: string | null
  formatLabel?: string | null
  statusLabel?: string | null
  participationLabel?: string | null
  freeSlots?: number | null
  totalSlots?: number | null
  priceLabel?: string | null
  prizeLabel?: string | null
  nextDateLabel?: string | null
}

export type ChampionshipListRowProps = {
  championship: ChampionshipListRowModel
  favorite?: boolean
  inCart?: boolean
  favoritePending?: boolean
  cartPending?: boolean
  cartDisabled?: boolean
  onFavorite?: () => void
  onCart?: () => void
  className?: string
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function ChampionshipListRow({
  championship,
  favorite = false,
  inCart = false,
  favoritePending = false,
  cartPending = false,
  cartDisabled = false,
  onFavorite,
  onCart,
  className,
}: ChampionshipListRowProps) {
  const hasFreeSlots = championship.freeSlots != null && Number.isFinite(Number(championship.freeSlots))
  const hasTotalSlots = championship.totalSlots != null && Number.isFinite(Number(championship.totalSlots))
  const freeSlots = hasFreeSlots ? Math.max(0, Number(championship.freeSlots)) : null
  const totalSlots = hasTotalSlots ? Math.max(0, Number(championship.totalSlots)) : null
  const statusLabel = championship.statusLabel || (freeSlots == null ? 'Vagas a confirmar' : freeSlots > 0 ? 'Vagas abertas' : 'Sem vagas')

  return (
    <article
      className={classes('dz-champ-list-row', className)}
      data-championship-list-row
      data-championship-id={championship.id}
    >
      <Link className={classes('dz-champ-list-row__media', championship.isBannerImage && 'is-banner')} href={championship.href} aria-label={`Ver campeonato ${championship.name}`}>
        {championship.imageUrl
          ? <img src={championship.imageUrl} alt="" loading="lazy" decoding="async" />
          : <Trophy size={36} aria-hidden="true" />}
        <span className="dz-champ-list-row__badges">
          <small className={freeSlots != null && freeSlots > 0 ? 'is-open' : 'is-closed'}>{statusLabel}</small>
          {championship.participationLabel ? <small className="is-participating">{championship.participationLabel}</small> : null}
        </span>
      </Link>

      <div className="dz-champ-list-row__body">
        <Link className="dz-champ-list-row__identity" href={championship.href}>
          <strong>{championship.name}</strong>
          <span>{[championship.producerLabel, championship.formatLabel].filter(Boolean).join(' · ') || 'Campeonato Free Fire'}</span>
        </Link>
        <dl className="dz-champ-list-row__metrics">
          <div><dt>Vagas</dt><dd>{freeSlots == null ? 'A confirmar' : totalSlots != null && totalSlots > 0 ? `${freeSlots}/${totalSlots}` : String(freeSlots)}</dd></div>
          <div><dt>Inscrição</dt><dd>{championship.priceLabel || 'Sob consulta'}</dd></div>
          <div><dt>Premiação</dt><dd>{championship.prizeLabel || '—'}</dd></div>
          <div><dt>Próxima data</dt><dd>{championship.nextDateLabel || 'A confirmar'}</dd></div>
        </dl>
      </div>

      <div className="dz-champ-list-row__actions" aria-label={`Ações de ${championship.name}`}>
        <IconButton
          icon={<Heart size={16} />}
          label={favorite ? `Remover ${championship.name} dos favoritos` : `Favoritar ${championship.name}`}
          className={favorite ? 'is-active' : ''}
          aria-pressed={favorite}
          disabled={!onFavorite || favoritePending}
          onClick={onFavorite}
        />
        <IconButton
          icon={<ShoppingCart size={16} />}
          label={inCart ? `Remover ${championship.name} do carrinho` : `Adicionar ${championship.name} ao carrinho`}
          className={inCart ? 'is-active' : ''}
          aria-pressed={inCart}
          disabled={!onCart || cartPending || cartDisabled}
          onClick={onCart}
        />
        <Link className="dz-champ-list-row__open" href={championship.href} aria-label={`Ver detalhes de ${championship.name}`}>
          <ChevronRight size={18} />
        </Link>
      </div>
    </article>
  )
}
