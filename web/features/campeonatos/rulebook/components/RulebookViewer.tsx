'use client'

import { useMemo, useState } from 'react'
import { Search, BookOpen, Download, Loader2 } from 'lucide-react'
import type { GeneratedDocument, RulebookHighlight } from '../types/rulebook.types'
import { downloadRulebookPdf } from '../utils/rulebook-pdf'
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

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/^\s*\d+[\.\u00B7\u2022\)]\s*/g, '')
    .replace(/^\s*\d+\.\s*/g, '')
    .trim()
}

function HighlightsGrid({ items }: { items: RulebookHighlight[] }) {
  if (!items.length) return null
  return (
    <div className="rulebook-doc-highlights">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rulebook-doc-highlight">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function RulebookViewer({ documento, compact }: Props) {
  const doc = documento as GeneratedDocument | null | undefined
  const [query, setQuery] = useState('')
  const [activeChapter, setActiveChapter] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const chapters = doc?.chapters || []
  const highlights = (doc?.dadosPrincipais || []) as RulebookHighlight[]

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
  const summary = doc.summary || []

  const handleDownloadPdf = async () => {
    setDownloadError('')
    setDownloading(true)
    try {
      await downloadRulebookPdf(doc)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar o PDF'
      setDownloadError(msg)
    } finally {
      setDownloading(false)
    }
  }

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
            className="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
            title="Baixar o regulamento completo em PDF"
          >
            {downloading ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
            {downloading ? 'Gerando PDF…' : 'Baixar PDF'}
          </button>
        </div>
        {downloadError ? (
          <div className="rulebook-inline-error" style={{ width: '100%' }}>
            {downloadError}
          </div>
        ) : null}
      </header>

      <div className="rulebook-viewer-body">
        <aside className="rulebook-toc no-print">
          <p className="eyebrow">Sumário</p>
          <nav>
            {summary.map((item) => (
              <a
                key={item.chapterId}
                href={`#rb-ch-${item.chapterId}`}
                className={activeChapter === item.chapterId ? 'active' : ''}
                onClick={() => setActiveChapter(item.chapterId)}
              >
                {item.order}. {cleanTitle(item.title)}
              </a>
            ))}
          </nav>
        </aside>

        <div className="rulebook-content" id="rulebook-print-root">
          <header className="rulebook-doc-cover">
            <div className="rulebook-doc-cover-brand">
              {logoUrl ? (
                <img className="rulebook-doc-logo" src={logoUrl} alt={`Logo ${champName}`} />
              ) : (
                <div className="rulebook-doc-logo-fallback" aria-hidden>
                  DZ
                </div>
              )}
              <div className="rulebook-doc-cover-text">
                <p className="rulebook-doc-kicker">Regulamento oficial</p>
                <h2 className="rulebook-doc-title">{champName}</h2>
                <p className="rulebook-doc-subtitle">Regulamento — {champName}</p>
                <p className="rulebook-doc-meta">
                  {doc.articleCount ? `${doc.articleCount} artigos` : ''}
                  {doc.generatedAt ? ` · Atualizado em ${formatDatePt(doc.generatedAt)}` : ''}
                </p>
              </div>
            </div>

            <HighlightsGrid items={highlights} />

            <div className="rulebook-doc-toc-block">
              <p className="rulebook-doc-toc-title">Sumário</p>
              <ol className="rulebook-doc-toc-print">
                {summary.map((item) => (
                  <li key={item.chapterId}>
                    <span>{item.order}.</span> {cleanTitle(item.title)}
                  </li>
                ))}
              </ol>
            </div>
          </header>

          {filtered.map((ch) => (
            <section key={ch.id} id={`rb-ch-${ch.id}`} className="rulebook-chapter">
              <h4 className="rulebook-chapter-title">
                <span className="rulebook-chapter-num">{ch.order}.</span>
                <span className="rulebook-chapter-name">{cleanTitle(ch.title)}</span>
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
              Regulamento exclusivo do campeonato <strong>{champName}</strong>. A inscrição e a
              participação implicam aceitação integral deste documento.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
