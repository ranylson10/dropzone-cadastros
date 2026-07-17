'use client'

import { useMemo, useState } from 'react'
import { Search, BookOpen, Printer } from 'lucide-react'
import type { GeneratedDocument } from '../types/rulebook.types'
import '../rulebook.css'

type Props = {
  documento: GeneratedDocument | Record<string, unknown> | null | undefined
  compact?: boolean
}

export function RulebookViewer({ documento, compact }: Props) {
  const doc = documento as GeneratedDocument | null | undefined
  const [query, setQuery] = useState('')
  const [activeChapter, setActiveChapter] = useState<string | null>(null)

  const chapters = doc?.chapters || []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chapters
    return chapters
      .map((ch) => ({
        ...ch,
        articles: ch.articles.filter((a) => {
          const hay = `${a.number} ${a.title} ${a.body} ${a.penalty || ''} ${a.observations || ''}`.toLowerCase()
          return hay.includes(q)
        }),
      }))
      .filter((ch) => ch.articles.length > 0 || ch.title.toLowerCase().includes(q))
  }, [chapters, query])

  if (!doc || !chapters.length) {
    return (
      <div className="rulebook-empty">
        <BookOpen size={22} />
        <p>Nenhum regulamento gerado ainda. Conclua o assistente para visualizar o documento.</p>
      </div>
    )
  }

  return (
    <div className={`rulebook-viewer ${compact ? 'compact' : ''}`}>
      <header className="rulebook-viewer-header">
        <div>
          <p className="eyebrow">Regulamento</p>
          <h3>{doc.title}</h3>
          <small>{doc.subtitle} · {doc.articleCount} artigos</small>
        </div>
        <div className="rulebook-viewer-actions">
          <label className="rulebook-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no regulamento…"
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() => window.print()}
            title="Imprimir ou salvar como PDF"
          >
            <Printer size={16} /> PDF / Imprimir
          </button>
        </div>
      </header>

      <div className="rulebook-viewer-body">
        <aside className="rulebook-toc no-print">
          <p className="eyebrow">Sumário</p>
          <nav>
            {(doc.summary || []).map((item) => (
              <a
                key={item.chapterId}
                href={`#rb-ch-${item.chapterId}`}
                className={activeChapter === item.chapterId ? 'active' : ''}
                onClick={() => setActiveChapter(item.chapterId)}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="rulebook-content" id="rulebook-print-root">
          {filtered.map((ch) => (
            <section key={ch.id} id={`rb-ch-${ch.id}`} className="rulebook-chapter">
              <h4>
                <span>{ch.order}.</span> {ch.title}
              </h4>
              {ch.articles.map((art) => (
                <article key={art.id} className="rulebook-article" id={`rb-art-${art.id}`}>
                  <h5>
                    <span className="art-num">{art.number}</span> {art.title}
                  </h5>
                  {art.body.split('\n').filter(Boolean).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  {art.penalty ? (
                    <div className="rulebook-penalty">
                      <strong>Penalidade</strong>
                      {art.penalty.split('\n').map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  ) : null}
                  {art.observations ? (
                    <div className="rulebook-obs">
                      <strong>Observações</strong>
                      <p>{art.observations}</p>
                    </div>
                  ) : null}
                  {art.notes ? (
                    <div className="rulebook-notes">
                      <small>{art.notes}</small>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          ))}
          {!filtered.length ? (
            <p className="empty">Nenhum resultado para “{query}”.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
