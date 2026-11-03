'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from 'lucide-react'

export type WorkspaceFocusAction = {
  id: string
  title: string
  detail: string
  icon: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
}

/** R22: ações prioritárias por perfil. Não altera rotas, permissões ou APIs. */
export function WorkspaceFocus({
  role, eyebrow, title, description, status, actions,
}: {
  role: 'produtora' | 'equipe' | 'jogador' | 'manager' | 'vendedor'
  eyebrow: string
  title: string
  description: string
  status?: string
  actions: WorkspaceFocusAction[]
}) {
  return (
    <section className={`dz-focus dz-focus--${role}`} aria-label={`Ações prioritárias: ${eyebrow}`}>
      <div className="dz-focus__intro">
        <span className="dz-focus__eyebrow"><span aria-hidden="true" className="dz-focus__pulse" />{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
        {status ? <span className="dz-focus__status">{status}</span> : null}
      </div>
      <div className="dz-focus__actions" aria-label="O que fazer agora">
        {actions.slice(0, 3).map((action, index) => {
          const body = (<>
            <span className="dz-focus__action-icon" aria-hidden="true">{action.icon}</span>
            <span className="dz-focus__action-copy"><strong>{action.title}</strong><small>{action.detail}</small></span>
            {index === 0 ? <ArrowUpRight size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </>)
          const className = `dz-focus__action ${index === 0 ? 'is-primary' : ''}`
          return action.href && !action.disabled ? (
            <Link key={action.id} href={action.href} className={className}>{body}</Link>
          ) : (
            <button key={action.id} type="button" className={className} disabled={action.disabled || !action.onClick} onClick={action.onClick}>{body}</button>
          )
        })}
      </div>
    </section>
  )
}
