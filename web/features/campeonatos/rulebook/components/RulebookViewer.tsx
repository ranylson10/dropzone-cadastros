'use client'

import { useMemo, useState } from 'react'
import { Search, BookOpen, Printer } from 'lucide-react'
import type { GeneratedDocument } from '../types/rulebook.types'
import '../rulebook.css'

type Props = {
  documento: GeneratedDocument | Record<string, unknown> | null | undefined
  compact?: boolean
}

function formatDatePt(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
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

  const logoUrl = doc.logoUrl || null
  const champName = doc.campeonatoNome || 'Campeonato'

  return (
    <div className={`rulebook-viewer ${compact ? 'compact' : ''}`}>
      <header className="rulebook-viewer-header no-print">
        <div className="rulebook-viewer-title-row">
          {logoUrl ? (
            <img className="rulebook-logo-thumb" src={logoUrl} alt={`Logo ${champName}`} />
          ) : null}
          <div>
            <p className="eyebrow">Regulamento</p>
            <h3>{doc.title}</h3>
            <small>
              {doc.subtitle} · {doc.articleCount} artigos
            </small>
          </div>
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
          {/* Capa / cabeçalho oficial — visível na tela e no PDF */}
          <header className="rulebook-doc-cover">
            <div className="rulebook-doc-cover-brand">
              {logoUrl ? (
                <img className="rulebook-doc-logo" src={logoUrl} alt={`Logo ${champName}`} />
              ) : (
                <div className="rulebook-doc-logo-fallback" aria-hidden>
                  <BookOpen size={36} />
                </div>
              )}
              <div className="rulebook-doc-cover-text">
                <p className="rulebook-doc-kicker">Regulamento oficial</p>
                <h2 className="rulebook-doc-title">{champName}</h2>
                <p className="rulebook-doc-subtitle">{doc.title}</p>
                <p className="rulebook-doc-meta">
                  {doc.subtitle}
                  {doc.generatedAt ? ` · Atualizado em ${formatDatePt(doc.generatedAt)}` : ''}
                  {doc.articleCount ? ` · ${doc.articleCount} artigos` : ''}
                </p>
              </div>
            </div>
            <ol className="rulebook-doc-toc-print">
              {(doc.summary || []).map((item) => (
                <li key={item.chapterId}>
                  <span>{item.order}.</span> {item.title.replace(/^\d+\.\s*/, '')}
                </li>
              ))}
            </ol>
          </header>

          {filtered.map((ch) => (
            <section key={ch.id} id={`rb-ch-${ch.id}`} className="rulebook-chapter">
              <h4 className="rulebook-chapter-title">
                <span className="rulebook-chapter-num">{ch.order}.</span>
                <span className="rulebook-chapter-name">{ch.title}</span>
              </h4>
              <div className="rulebook-chapter-body">
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
              </div>
            </section>
          ))}
          {!filtered.length ? (
            <p className="empty">Nenhum resultado para “{query}”.</p>
          ) : null}

          <footer className="rulebook-doc-footer">
            <p>
              Documento gerado pela plataforma DropZone para o campeonato <strong>{champName}</strong>.
              A inscrição e a participação implicam aceitação integral deste regulamento.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
