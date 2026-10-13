import type { HTMLAttributes, ReactNode } from 'react'

type FormGridColumns = 1 | 2 | 3 | 4

type FormGridProps = HTMLAttributes<HTMLDivElement> & {
  columns?: FormGridColumns
  children: ReactNode
}

export function FormGrid({ columns = 2, className = '', children, ...props }: FormGridProps) {
  return (
    <div
      className={['dz-form-grid', `dz-form-grid--${columns}`, className].filter(Boolean).join(' ')}
      data-dz-form-grid={columns}
      {...props}
    >
      {children}
    </div>
  )
}

export function FormStack({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={['dz-form-stack', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  )
}

export function FormActions({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={['dz-form-actions', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  )
}

type FormMessageTone = 'info' | 'success' | 'error' | 'warning'

type FormMessageProps = HTMLAttributes<HTMLDivElement> & {
  tone?: FormMessageTone
  children: ReactNode
}

export function FormMessage({ tone = 'info', className = '', children, ...props }: FormMessageProps) {
  return (
    <div
      className={['dz-form-message', `dz-form-message--${tone}`, className].filter(Boolean).join(' ')}
      role={tone === 'error' ? 'alert' : 'status'}
      {...props}
    >
      {children}
    </div>
  )
}

type FormSectionProps = HTMLAttributes<HTMLElement> & {
  title?: string
  description?: string
  children: ReactNode
}

export function FormSection({ title, description, className = '', children, ...props }: FormSectionProps) {
  return (
    <section className={['dz-form-section', className].filter(Boolean).join(' ')} {...props}>
      {title || description ? (
        <div className="dz-form-section__head">
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      <div className="dz-form-section__body">{children}</div>
    </section>
  )
}
