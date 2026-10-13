import type { HTMLAttributes, ReactNode } from 'react'

type ListTag = 'div' | 'section' | 'ul' | 'ol'
type ItemTag = 'div' | 'article' | 'li'

export type DataListProps = HTMLAttributes<HTMLElement> & {
  as?: ListTag
  children: ReactNode
}

export function DataList({ as: Component = 'div', className = '', children, ...props }: DataListProps) {
  return (
    <Component
      className={['dz-data-list', className].filter(Boolean).join(' ')}
      data-dz-list="true"
      role={Component === 'ul' || Component === 'ol' ? undefined : 'list'}
      {...props}
    >
      {children}
    </Component>
  )
}

export type DataListItemProps = HTMLAttributes<HTMLElement> & {
  as?: ItemTag
  children: ReactNode
}

export function DataListItem({ as: Component = 'div', className = '', children, ...props }: DataListItemProps) {
  return (
    <Component
      className={['dz-data-list__item', className].filter(Boolean).join(' ')}
      data-dz-list-item="true"
      role={Component === 'li' ? undefined : 'listitem'}
      {...props}
    >
      {children}
    </Component>
  )
}
