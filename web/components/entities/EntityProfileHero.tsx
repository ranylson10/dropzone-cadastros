import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { EntityAvatar } from './EntityAvatar'
import type { EntityKind, EntityMetaItem } from './EntityListRow'

export type EntityProfileHeroProps = {
  kind: EntityKind
  backHref: string
  backLabel: string
  name: string
  image?: string | null
  eyebrow?: string | null
  username?: string | null
  description?: string | null
  primaryDetails?: EntityMetaItem[]
  extraDetails?: EntityMetaItem[]
  actions?: ReactNode
  className?: string
}

export function EntityProfileHero({
  kind,
  backHref,
  backLabel,
  name,
  image,
  eyebrow,
  username,
  description,
  primaryDetails = [],
  extraDetails = [],
  actions,
  className = '',
}: EntityProfileHeroProps) {
  return (
    <section
      className={['dz-entity-profile-hero', `dz-entity-profile-hero--${kind}`, 'profile-command-hero', `theme-${kind}`, className].filter(Boolean).join(' ')}
      data-theme={kind}
      data-entity-profile-kind={kind}
    >
      <div className="profile-command-inner dz-entity-profile-hero__inner">
        <a className="directory-back dz-entity-profile-hero__back" href={backHref}>
          <ArrowLeft size={15} /> {backLabel}
        </a>
        <div className="profile-command-main dz-entity-profile-hero__main">
          <EntityAvatar
            name={name}
            image={image}
            size="xl"
            className="profile-command-avatar dz-entity-profile-hero__avatar"
            alt=""
          />
          <div className="profile-command-copy dz-entity-profile-hero__copy">
            {eyebrow ? <small>{eyebrow}</small> : null}
            <h1>{name}</h1>
            {username ? <strong>@{username}</strong> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {primaryDetails.length ? (
            <dl className="profile-command-facts dz-entity-profile-hero__facts">
              {primaryDetails.map((item) => (
                <div key={`${item.label}:${item.value}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
              ))}
            </dl>
          ) : null}
          {extraDetails.length ? (
            <details className="profile-command-more-facts dz-entity-profile-hero__more">
              <summary>Ver todos os dados <span>{extraDetails.length}</span></summary>
              <dl>{extraDetails.map((item) => <div key={`${item.label}:${item.value}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
            </details>
          ) : null}
        </div>
        {actions ? <div className="profile-command-actions dz-entity-profile-hero__actions">{actions}</div> : null}
      </div>
    </section>
  )
}
