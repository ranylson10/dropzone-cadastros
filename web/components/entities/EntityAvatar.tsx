import type { CSSProperties } from 'react'

export type EntityAvatarSize = 'sm' | 'md' | 'lg' | 'xl'

export type EntityAvatarProps = {
  name: string
  image?: string | null
  alt?: string
  size?: EntityAvatarSize
  className?: string
  imageClassName?: string
  fallbackClassName?: string
  style?: CSSProperties
}

export function entityInitials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'DZ'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}

export function EntityAvatar({
  name,
  image,
  alt,
  size = 'md',
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  style,
}: EntityAvatarProps) {
  const classes = ['dz-entity-avatar', `dz-entity-avatar--${size}`, className].filter(Boolean).join(' ')

  return (
    <span className={classes} style={style} data-entity-avatar={size}>
      {image ? (
        <img
          src={image}
          alt={alt ?? name}
          decoding="async"
          loading="lazy"
          className={imageClassName || undefined}
        />
      ) : (
        <b className={fallbackClassName || undefined} aria-label={name}>{entityInitials(name)}</b>
      )}
    </span>
  )
}
