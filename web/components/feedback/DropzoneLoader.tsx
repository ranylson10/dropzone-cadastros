type DropzoneLoaderProps = {
  label?: string
  compact?: boolean
}

/**
 * Loader com a marca DropZone (3 faces do cubo).
 * SVG inline + CSS — anima no PC e no mobile (img externo costuma ficar estático no desktop).
 */
export function DropzoneLoader({ label = 'Carregando', compact = false }: DropzoneLoaderProps) {
  const size = compact ? 64 : 96

  return (
    <div className={`dropzone-loader ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <div
        className="dropzone-loader-mark"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span className="dropzone-loader-ring" />
        <span className="dropzone-loader-ring dropzone-loader-ring-delay" />
        <svg
          className="dropzone-loader-svg"
          viewBox="0 0 180 180"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* face esquerda */}
          <path
            className="dz-face dz-face-left"
            d="M45 64 82 42c4-2 7 0 7 4v48c0 3-2 5-4 7l-36 21c-4 2-7 0-7-4V70c0-3 1-5 3-6Z"
            fill="#dfbf4a"
          />
          {/* face direita */}
          <path
            className="dz-face dz-face-right"
            d="m135 64-37-22c-4-2-7 0-7 4v48c0 3 2 5 4 7l36 21c4 2 7 0 7-4V70c0-3-1-5-3-6Z"
            fill="#c9a227"
          />
          {/* base */}
          <path
            className="dz-face dz-face-bottom"
            d="m86 105-31 18c-4 2-4 6 0 8l31 18c3 2 6 2 9 0l31-18c4-2 4-6 0-8l-31-18c-3-2-6-2-9 0Z"
            fill="#8f7420"
          />
        </svg>
      </div>

      <strong>{label}</strong>
      <span className="dropzone-loader-wait">
        Aguarde um instante
        <i className="dropzone-loader-dots" aria-hidden="true">
          <b /><b /><b />
        </i>
      </span>
    </div>
  )
}
