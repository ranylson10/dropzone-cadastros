import type { HTMLAttributes, ReactNode } from 'react'

type SurfaceTone = 'default' | 'soft' | 'muted' | 'dark'
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg'

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'
  tone?: SurfaceTone
  padding?: SurfacePadding
  interactive?: boolean
  children: ReactNode
}

export function Surface({
  as: Component = 'section',
  tone = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}: SurfaceProps) {
  const classes = [
    'dz-ui-surface',
    `dz-ui-surface--${tone}`,
    `dz-ui-surface--pad-${padding}`,
    interactive ? 'dz-ui-surface--interactive' : '',
    className,
  ].filter(Boolean).join(' ')

  return <Component className={classes} {...props}>{children}</Component>
}
