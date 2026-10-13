import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

export type StatusMessageProps = {
  tone?: 'info' | 'success' | 'error'
  title?: string
  children: ReactNode
  className?: string
}

export function StatusMessage({ tone = 'info', title, children, className = '' }: StatusMessageProps) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info
  return (
    <div className={`dz-status-message dz-status-message--${tone} ${className}`.trim()} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      <Icon size={18} aria-hidden="true" />
      <div>{title ? <strong>{title}</strong> : null}<span>{children}</span></div>
    </div>
  )
}
