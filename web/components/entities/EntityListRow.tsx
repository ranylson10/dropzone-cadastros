import { ChevronRight } from 'lucide-react'
import { EntityAvatar } from './EntityAvatar'

export type EntityKind = 'equipes' | 'jogadores' | 'produtoras' | 'managers'

export type EntityMetaItem = {
  label: string
  value: string
}

export type EntityListRowProps = {
  kind: EntityKind
  href: string
  name: string
  image?: string | null
  eyebrow?: string | null
  username?: string | null
  description?: string | null
  meta?: EntityMetaItem[]
  className?: string
}

export function EntityListRow({
  kind,
  href,
  name,
  image,
  eyebrow,
  username,
  description,
  meta = [],
  className = '',
}: EntityListRowProps) {
  const classes = [
    'dz-entity-row',
    `dz-entity-row--${kind}`,
    'directory-list-row',
    `directory-list-row-${kind}`,
    className,
  ].filter(Boolean).join(' ')

  const isTableView = className.includes('dz-entity-row--table')

  if (isTableView) {
    const metaItems = meta.slice(0, 3)
    while (metaItems.length < 3) metaItems.push({ label: '—', value: '—' })
    const detailsText = [
      username ? `@${username}` : '',
      description || '',
    ].filter(Boolean).join(' · ') || 'Perfil competitivo cadastrado no DropZone.'

    return (
      <a
        className={classes}
        href={href}
        data-entity-kind={kind}
      >
        <span className="dz-entity-table-identity">
          <EntityAvatar
            name={name}
            image={image}
            size="md"
            className="directory-list-media dz-entity-row__avatar"
            alt=""
          />
          <span className="dz-entity-table-main">
            {eyebrow ? <small>{eyebrow}</small> : null}
            <strong>{name}</strong>
          </span>
        </span>

        <span className="dz-entity-table-details">{detailsText}</span>

        {metaItems.map((item, index) => (
          <span key={`${item.label}:${item.value}:${index}`} className={`dz-entity-table-stat dz-entity-table-stat--${index + 1}`}>
            <small>{item.label}</small>
            <b>{item.value || '—'}</b>
          </span>
        ))}

        <ChevronRight size={18} className="directory-list-arrow dz-entity-row__arrow dz-entity-table-open" aria-hidden="true" />
      </a>
    )
  }

  return (
    <a
      className={classes}
      href={href}
      data-entity-kind={kind}
    >
      <EntityAvatar
        name={name}
        image={image}
        size="md"
        className="directory-list-media dz-entity-row__avatar"
        alt=""
      />
      <span className="directory-list-main dz-entity-row__main">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{name}</strong>
        {username || description ? (
          <span>{username ? `@${username}${description ? ' · ' : ''}` : ''}{description || ''}</span>
        ) : null}
      </span>
      {meta.length ? (
        <span className="directory-list-meta dz-entity-row__meta">
          {meta.map((item) => (
            <em key={`${item.label}:${item.value}`} data-label={item.label}>
              <b>{item.value || '—'}</b>
            </em>
          ))}
        </span>
      ) : null}
      <ChevronRight size={18} className="directory-list-arrow dz-entity-row__arrow" aria-hidden="true" />
    </a>
  )
}
