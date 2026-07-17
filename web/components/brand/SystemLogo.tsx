/**
 * Logo oficial do DropZone — tamanho SEMPRE travado.
 * Use em header, login e qualquer chrome do sistema.
 * Nunca use <img src="/dropzone-icon.png"> solto sem tamanho.
 */
type SystemLogoProps = {
  size?: number
  alt?: string
  className?: string
  /** cover preenche o box (header); contain preserva o símbolo (login) */
  fit?: 'contain' | 'cover'
}

export function SystemLogo({
  size = 42,
  alt = 'DropZone',
  className = '',
  fit = 'contain',
}: SystemLogoProps) {
  const px = Math.max(16, Math.min(96, Number(size) || 42))
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`system-logo ${className}`.trim()}
      src="/dropzone-icon.png"
      alt={alt}
      width={px}
      height={px}
      decoding="async"
      style={{
        width: px,
        height: px,
        maxWidth: px,
        maxHeight: px,
        minWidth: px,
        minHeight: px,
        objectFit: fit,
        display: 'block',
        flex: `0 0 ${px}px`,
      }}
    />
  )
}
