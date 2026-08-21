type PageSkeletonProps = { title?: string; cards?: number }

/** Mantém a estrutura da página durante a troca de rota, evitando tela vazia. */
export function PageSkeleton({ title = 'Carregando', cards = 4 }: PageSkeletonProps) {
  return <main className="page-skeleton" aria-busy="true" aria-label={title}>
    <header><i /><i /></header>
    <section className="page-skeleton-toolbar"><i /><i /><i /></section>
    <section className="page-skeleton-grid">{Array.from({ length: cards }, (_, index) => <article key={index}><i /><b /><small /><small /></article>)}</section>
    <span>{title}</span>
  </main>
}
