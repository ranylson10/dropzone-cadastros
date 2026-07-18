type DropzoneLoaderProps = {
  label?: string
  compact?: boolean
}

export function DropzoneLoader({ label = 'Carregando', compact = false }: DropzoneLoaderProps) {
  const size = compact ? 56 : 72
  return (
    <div className={`dropzone-loader ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      {/* tamanho inline: nunca herda 100% do container; SVG sem fundo preto */}
      <img
        src="/dropzone-loading.svg"
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          maxWidth: size,
          maxHeight: size,
          display: 'block',
          objectFit: 'contain',
          background: 'transparent',
        }}
      />
      <strong>{label}</strong>
      <span>Aguarde um instante</span>
    </div>
  )
}
