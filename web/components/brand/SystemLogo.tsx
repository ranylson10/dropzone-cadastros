/**
 * Logo oficial do DropZone — fundo transparente, tamanho controlado por prop.
 * Use em header, login e qualquer chrome do sistema.
 * Nunca use <img src="/branding/dropzone-platform.png"> solto sem tamanho.
 */
type SystemLogoProps = {
  size?: number
  alt?: string
  className?: string
  /** contain preserva o símbolo (padrão); cover só quando o box é a própria marca */
  fit?: 'contain' | 'cover'
  variant?: 'default' | 'accent' | 'light'
}

export function SystemLogo({
  size = 44,
  alt = 'DropZone',
  className = '',
  fit = 'contain',
  variant = 'default',
}: SystemLogoProps) {
  // Login/abertura até 96px; header e chrome menores
  const px = Math.max(16, Math.min(120, Number(size) || 44))
  const style = {
    width: px,
    height: px,
    maxWidth: px,
    maxHeight: px,
    minWidth: px,
    minHeight: px,
    objectFit: fit,
    display: 'block' as const,
    flex: `0 0 ${px}px`,
    background: 'transparent',
    // CSS hard-locks leem esta variável
    ['--system-logo-size' as string]: `${px}px`,
  }

  const source = variant === 'accent' ? '/branding/dropzone-platform-accent.png' : variant === 'light' ? '/branding/dropzone-platform-light.png' : '/branding/dropzone-platform.png'

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`system-logo ${className}`.trim()}
      src={source}
      alt={alt}
      width={px}
      height={px}
      decoding="async"
      style={style}
    />
  )
}
