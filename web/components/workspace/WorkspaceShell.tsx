'use client'

import type { ReactNode } from 'react'

export type WorkspaceNavItem = {
  id: string
  label: string
  icon?: ReactNode
  badge?: ReactNode
  href?: string
  disabled?: boolean
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function WorkspaceShell(props: {
  kind: 'produtora' | 'equipe' | 'jogador' | 'manager' | string
  className?: string
  children: ReactNode
}) {
  return <div className={cx('dz-workspace', 'dz-workspace--unified', props.className)} data-workspace-kind={props.kind}>{props.children}</div>
}

export function WorkspaceHeader(props: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cx('dz-workspace-header', props.className)}>
      <div className="dz-workspace-header__copy">
        {props.eyebrow ? <p className="dz-workspace-header__eyebrow">{props.eyebrow}</p> : null}
        <div className="dz-workspace-header__title-row">
          {props.icon ? <span className="dz-workspace-header__icon" aria-hidden>{props.icon}</span> : null}
          <h2>{props.title}</h2>
        </div>
        {props.description ? <p className="dz-workspace-header__description">{props.description}</p> : null}
      </div>
      {props.actions ? <div className="dz-workspace-header__actions">{props.actions}</div> : null}
    </header>
  )
}

function WorkspaceNavBase(props: {
  items: WorkspaceNavItem[]
  activeId?: string
  onChange?: (id: string) => void
  ariaLabel: string
  className?: string
  variant: 'primary' | 'secondary'
}) {
  return (
    <nav
      className={cx(props.variant === 'primary' ? 'dz-workspace-nav' : 'dz-workspace-subnav', props.className)}
      aria-label={props.ariaLabel}
      data-workspace-nav={props.variant}
    >
      {props.items.map((item) => {
        const active = item.id === props.activeId
        const content = <>
          {item.icon ? <span className="dz-workspace-nav__icon" aria-hidden>{item.icon}</span> : null}
          <span className="dz-workspace-nav__label">{item.label}</span>
          {item.badge !== undefined && item.badge !== null ? <span className="dz-workspace-nav__badge">{item.badge}</span> : null}
        </>

        if (item.href) {
          return (
            <a
              key={item.id}
              href={item.href}
              className={cx('dz-workspace-nav__item', active && 'is-active')}
              aria-current={active ? 'page' : undefined}
              aria-disabled={item.disabled || undefined}
              onClick={(event) => { if (item.disabled) event.preventDefault() }}
            >
              {content}
            </a>
          )
        }

        return (
          <button
            key={item.id}
            type="button"
            className={cx('dz-workspace-nav__item', active && 'is-active')}
            aria-current={active ? 'page' : undefined}
            disabled={item.disabled}
            onClick={() => props.onChange?.(item.id)}
          >
            {content}
          </button>
        )
      })}
    </nav>
  )
}

export function WorkspaceNav(props: {
  items: WorkspaceNavItem[]
  activeId?: string
  onChange?: (id: string) => void
  ariaLabel: string
  className?: string
}) {
  return <WorkspaceNavBase {...props} variant="primary" />
}

export function WorkspaceSubnav(props: {
  items: WorkspaceNavItem[]
  activeId?: string
  onChange?: (id: string) => void
  ariaLabel: string
  className?: string
}) {
  return <WorkspaceNavBase {...props} variant="secondary" />
}

export function WorkspaceContent(props: { children: ReactNode; className?: string }) {
  return <div className={cx('dz-workspace-content', props.className)}>{props.children}</div>
}
