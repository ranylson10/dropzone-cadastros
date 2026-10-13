/**
 * Logo oficial fornecida pelo usuário, com cor da interface aplicada pela máscara.
 * Use em header, login e qualquer chrome do sistema.
 * O PNG original permanece intacto; sua transparência preserva o desenho.
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
    display: 'block' as const,
    flex: `0 0 ${px}px`,
    backgroundColor: variant === 'light' ? '#fff' : 'var(--dz-yellow, #f2c900)',
    maskImage: 'url("/dropzone-icon.png")',
    WebkitMaskImage: 'url("/dropzone-icon.png")',
    maskSize: fit,
    WebkitMaskSize: fit,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    // CSS hard-locks leem esta variável
    ['--system-logo-size' as string]: `${px}px`,
  }

  return (
    <span
      className={`system-logo ${className}`.trim()}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={style}
    />
  )
}
