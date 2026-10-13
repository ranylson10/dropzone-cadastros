import type { ReactNode } from 'react'

export type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={['dz-ui-empty-state', className].filter(Boolean).join(' ')} role="status">
      {icon ? <div className="dz-ui-empty-state__icon" aria-hidden="true">{icon}</div> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="dz-ui-empty-state__action">{action}</div> : null}
    </div>
  )
}
