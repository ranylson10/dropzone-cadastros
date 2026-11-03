import type { HTMLAttributes } from 'react'

/** The content boundary is shared by catalogs and operational profiles. */
export function PlatformPageBody({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`dz-platform-body ${className}`.trim()} {...props} />
}
