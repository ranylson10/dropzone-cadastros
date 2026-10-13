import type { HTMLAttributes, ReactNode } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
  icon?: ReactNode
}

export function Badge({ tone = 'neutral', icon, className = '', children, ...props }: BadgeProps) {
  const classes = ['dz-ui-badge', `dz-ui-badge--${tone}`, className].filter(Boolean).join(' ')
  return (
    <span className={classes} {...props}>
      {icon ? <span className="dz-ui-badge__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  )
}
