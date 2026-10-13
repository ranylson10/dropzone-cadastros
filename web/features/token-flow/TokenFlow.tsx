'use client'

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Dialog } from '@/components/ui'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { buildLoginHref } from '@/features/auth/auth-return'
import type { ProfileType } from '@/lib/types'

type PageProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  themeStyle?: CSSProperties
  framed?: boolean
}

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  framed?: boolean
}

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ')
}

export function TokenFlowPage({ children, className, themeStyle, framed = true, ...props }: PageProps) {
  return (
    <main
      {...props}
      data-dz-token-flow="page"
      className={classes(framed && 'invite-page', 'dz-token-flow-page', 'dz-mobile-utility', className)}
      style={themeStyle || props.style}
    >
      {children}
    </main>
  )
}

export function TokenFlowCard({ children, className, framed = true, ...props }: CardProps) {
  return (
    <section
      {...props}
      data-dz-token-flow="card"
      className={classes(framed && 'invite-card', 'dz-token-flow-card', className)}
    >
      {children}
    </section>
  )
}

export function TokenFlowStatus({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'error' | 'success' | 'warning'
  className?: string
}) {
  return (
    <div
      data-dz-token-status={tone}
      className={classes('dz-token-flow-status', `dz-token-flow-status-${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

type AccessGateProps = {
  open: boolean
  onClose: () => void
  profileType?: ProfileType | null
  returnTo: string
  eyebrow?: string
  title: string
  description: ReactNode
  allowGuest?: boolean
  guestLabel?: string
  onGuest?: () => void
  switchAccount?: boolean
  loginLabel?: string
}

export function TokenFlowAccessGate({
  open,
  onClose,
  profileType = null,
  returnTo,
  eyebrow,
  title,
  description,
  allowGuest = false,
  guestLabel = 'Continuar sem login',
  onGuest,
  switchAccount = false,
  loginLabel = 'Entrar com login e senha',
}: AccessGateProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="medium"
      title={title}
      description={typeof description === 'string' ? description : undefined}
      className="dz-token-flow-gate"
      closeLabel="Fechar acesso"
    >
      <div data-dz-token-flow="access-gate" className="dz-token-flow-gate-content">
        <SystemLogo className="dz-token-flow-gate-logo" size={58} alt="" variant="accent" />
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {typeof description === 'string' ? null : <div className="dz-token-flow-gate-description">{description}</div>}
        <SocialLogin profileType={profileType} returnTo={returnTo} />
        {allowGuest && onGuest ? (
          <button className="button secondary dz-token-flow-guest" type="button" onClick={onGuest}>
            {guestLabel}
          </button>
        ) : null}
        <a className="button secondary dz-token-flow-password" href={buildLoginHref(profileType, returnTo, switchAccount)}>
          {loginLabel}
        </a>
      </div>
    </Dialog>
  )
}
