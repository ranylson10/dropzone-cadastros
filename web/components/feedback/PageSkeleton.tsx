import { AppShell } from '@/components/layout/AppShell'

type PageSkeletonProps = { title?: string; cards?: number }

/** A moldura e a navegação continuam disponíveis enquanto a página chega. */
export function PageSkeleton({ title = 'Carregando', cards = 4 }: PageSkeletonProps) {
  const name = title.replace(/^(Carregando|Buscando)\s+/i, '')
  const heading = name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <AppShell headerVariant="storefront" withAuthOffset={false} mainClassName="dz-loading-page">
      <div className="dz-page-loading" aria-busy="true">
        <div className="dz-page-loading-heading">
          <h1>{heading}</h1>
          <span className="dz-page-loading-status" role="status"><span className="dz-loading-spinner" aria-hidden="true" />{title}…</span>
        </div>
        <div className="dz-page-loading-filters" aria-hidden="true"><span /><span /><span /></div>
        <div className="dz-page-loading-list" aria-hidden="true">
          {Array.from({ length: cards }, (_, index) => (
            <div className="dz-page-loading-row" key={index}>
              <span className="dz-page-loading-avatar" />
              <div className="dz-page-loading-copy"><span /><span /></div>
              <span className="dz-page-loading-meta" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
