import { SystemLogo } from '@/components/brand/SystemLogo'

type DropzoneLoaderProps = {
  label?: string
  compact?: boolean
}

export function DropzoneLoader({ label = 'Carregando', compact = false }: DropzoneLoaderProps) {
  return (
    <div className={`dz-loading-indicator ${compact ? 'dz-loading-indicator--compact' : ''}`} role="status" aria-live="polite">
      <SystemLogo size={compact ? 40 : 64} alt="" variant="accent" />
      <strong>{label}</strong>
      <span className="dz-loading-spinner" aria-hidden="true" />
    </div>
  )
}
