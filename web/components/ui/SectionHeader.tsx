import type { ReactNode } from 'react'

export type SectionHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  compact?: boolean
  className?: string
}

export function SectionHeader({ eyebrow, title, description, actions, compact = false, className = '' }: SectionHeaderProps) {
  const classes = ['dz-ui-section-header', compact ? 'dz-ui-section-header--compact' : '', className].filter(Boolean).join(' ')
  return (
    <header className={classes}>
      <div className="dz-ui-section-header__copy">
        {eyebrow ? <p className="dz-ui-section-header__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="dz-ui-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="dz-ui-section-header__actions">{actions}</div> : null}
    </header>
  )
}
