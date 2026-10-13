import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'dz-ui-button',
    `dz-ui-button--${variant}`,
    `dz-ui-button--${size}`,
    fullWidth ? 'dz-ui-button--full' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} {...props}>
      {leadingIcon ? <span className="dz-ui-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
      <span className="dz-ui-button__label">{children}</span>
      {trailingIcon ? <span className="dz-ui-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  )
}
