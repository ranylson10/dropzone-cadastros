import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonVariant = 'surface' | 'ghost' | 'accent' | 'danger'
type IconButtonSize = 'sm' | 'md' | 'lg'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
}

export function IconButton({
  label,
  icon,
  variant = 'surface',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) {
  const classes = [
    'dz-ui-icon-button',
    `dz-ui-icon-button--${variant}`,
    `dz-ui-icon-button--${size}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} aria-label={label} title={props.title ?? label} {...props}>
      {icon}
    </button>
  )
}
