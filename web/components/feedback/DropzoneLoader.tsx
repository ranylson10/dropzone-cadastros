type DropzoneLoaderProps = {
  label?: string
  compact?: boolean
}

export function DropzoneLoader({ label = 'Carregando', compact = false }: DropzoneLoaderProps) {
  const size = compact ? 48 : 56
  return (
    <div className={`dropzone-loader ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      {/* tamanho inline: nunca herda 100% do container */}
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
        }}
      />
      <strong>{label}</strong>
      <span>Aguarde um instante</span>
    </div>
  )
}
