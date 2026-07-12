type DropzoneLoaderProps = {
  label?: string
  compact?: boolean
}

export function DropzoneLoader({ label = 'Carregando', compact = false }: DropzoneLoaderProps) {
  return (
    <div className={`dropzone-loader ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <img src="/dropzone-loading.svg" alt="" />
      <strong>{label}</strong>
      <span>Aguarde um instante</span>
    </div>
  )
}
