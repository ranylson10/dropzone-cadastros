import type { ReactNode } from 'react'
import { PublicDirectoryHeader } from '@/features/directory/components/PublicDirectoryHeader'

type LegalSection = {
  title: string
  content: ReactNode
}

type LegalPageProps = {
  eyebrow: string
  title: string
  description: string
  updatedAt: string
  sections: LegalSection[]
}

export function LegalPage({ eyebrow, title, description, updatedAt, sections }: LegalPageProps) {
  return (
    <div className="legal-page-shell">
      <PublicDirectoryHeader />

      <main className="legal-page">
        <header className="legal-hero">
          <span className="legal-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <small>Última atualização: {updatedAt}</small>
        </header>

        <article className="legal-document">
          {sections.map((section) => (
            <section key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              <div>{section.content}</div>
            </section>
          ))}
        </article>
      </main>

      <footer className="legal-footer">
        <div>
          <span>© 2026 DropZone Competitive System</span>
          <nav aria-label="Documentos legais">
            <a href="/politica-de-privacidade">Política de Privacidade</a>
            <a href="/termos-de-servico">Termos de Serviço</a>
            <a href="/exclusao-de-dados">Exclusão de Dados</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
