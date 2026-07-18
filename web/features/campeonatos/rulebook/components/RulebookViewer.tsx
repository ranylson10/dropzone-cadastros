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

/** CSS embutido só do regulamento — evita imprimir painel da produtora/app. */
const PRINT_DOCUMENT_CSS = `
  @page { margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: Georgia, "Times New Roman", Times, serif;
    font-size: 10.5pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .rulebook-doc-cover {
    display: block;
    margin: 0 0 8mm;
    padding: 0 0 5mm;
    border-bottom: 2px solid #c9a227;
  }
  .rulebook-doc-cover-brand {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .rulebook-doc-logo {
    width: 22mm;
    height: 22mm;
    border-radius: 3mm;
    object-fit: cover;
    border: 1px solid #ddd;
    background: #fff;
    flex-shrink: 0;
  }
  .rulebook-doc-logo-fallback {
    width: 22mm;
    height: 22mm;
    border-radius: 3mm;
    border: 1px dashed #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b8860b;
    font-size: 9pt;
    font-weight: 700;
    flex-shrink: 0;
  }
  .rulebook-doc-kicker {
    margin: 0;
    font-family: system-ui, sans-serif;
    font-size: 8pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #b8860b;
  }
  .rulebook-doc-title {
    margin: 2px 0 0;
    font-family: system-ui, sans-serif;
    font-size: 18pt;
    font-weight: 800;
    line-height: 1.15;
    color: #111;
  }
  .rulebook-doc-subtitle {
    margin: 3px 0 0;
    font-family: system-ui, sans-serif;
    font-size: 10pt;
    font-weight: 600;
    color: #333;
  }
  .rulebook-doc-meta {
    margin: 4px 0 0;
    font-family: system-ui, sans-serif;
    font-size: 8.5pt;
    color: #555;
  }
  .rulebook-doc-toc-print {
    display: block;
    margin: 5mm 0 0;
    padding: 0 0 0 4mm;
    columns: 2;
    column-gap: 8mm;
    font-family: system-ui, sans-serif;
    font-size: 8.5pt;
    line-height: 1.4;
    color: #222;
  }
  .rulebook-doc-toc-print li { margin: 0 0 2px; break-inside: avoid; }
  .rulebook-doc-toc-print span { font-weight: 800; color: #b8860b; margin-right: 3px; }
  .rulebook-chapter {
    margin: 0;
    padding: 3mm 0 1mm;
    border-top: 1.5px solid #c9a227;
    break-inside: auto;
    page-break-before: auto;
    page-break-after: auto;
  }
  .rulebook-chapter:first-of-type { border-top: 0; padding-top: 0; }
  .rulebook-chapter-title {
    margin: 0 0 2mm;
    font-family: system-ui, sans-serif;
    font-size: 12pt;
    font-weight: 800;
    color: #111;
    page-break-after: avoid;
  }
  .rulebook-chapter-num { color: #b8860b; margin-right: 4px; }
  .rulebook-article {
    margin: 0;
    padding: 2.2mm 0;
    border-top: 1px solid #e5e5e5;
    break-inside: auto;
    page-break-inside: auto;
  }
  .rulebook-article h5 {
    margin: 0 0 1.5mm;
    font-family: system-ui, sans-serif;
    font-size: 10pt;
    font-weight: 700;
    color: #111;
    page-break-after: avoid;
  }
  .rulebook-article .art-num { color: #b8860b; margin-right: 4px; font-weight: 800; }
  .rulebook-article p {
    margin: 0 0 1.5mm;
    white-space: pre-wrap;
    color: #222;
  }
  .rulebook-penalty, .rulebook-obs {
    margin-top: 1.5mm;
    padding: 2mm 2.5mm;
    border: 1px solid #ddd;
    border-radius: 2px;
    background: #f7f7f7;
    page-break-inside: avoid;
  }
  .rulebook-penalty { border-left: 3px solid #c2410c; }
  .rulebook-obs { border-left: 3px solid #b8860b; }
  .rulebook-penalty strong, .rulebook-obs strong {
    display: block;
    margin-bottom: 1mm;
    font-family: system-ui, sans-serif;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .rulebook-notes { margin-top: 1mm; color: #666; font-size: 8.5pt; }
  .rulebook-doc-footer {
    margin-top: 5mm;
    padding-top: 3mm;
    border-top: 1px solid #ccc;
    font-family: system-ui, sans-serif;
    font-size: 8pt;
    color: #555;
  }
  .rulebook-doc-footer p { margin: 0; }
  svg { display: none; }
`

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function printIsolatedRulebook(root: HTMLElement, title: string) {
  const printWin = window.open('', '_blank', 'noopener,noreferrer,width=920,height=720')
  if (!printWin) {
    // Popup bloqueado: fallback com classe no body
    document.body.classList.add('rulebook-printing')
    const cleanup = () => {
      document.body.classList.remove('rulebook-printing')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    return
  }

  const safeTitle = escapeHtml(title || 'Regulamento')
  printWin.document.open()
  printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${PRINT_DOCUMENT_CSS}</style>
</head>
<body>
  ${root.innerHTML}
</body>
</html>`)
  printWin.document.close()

  const runPrint = () => {
    try {
      printWin.focus()
      printWin.print()
    } catch {
      // ignore
    }
  }

  const imgs = Array.from(printWin.document.images || [])
  if (!imgs.length) {
    setTimeout(runPrint, 120)
    return
  }
  let pending = imgs.length
  const done = () => {
    pending -= 1
    if (pending <= 0) setTimeout(runPrint, 80)
  }
  imgs.forEach((img) => {
    if (img.complete) done()
    else {
      img.addEventListener('load', done)
      img.addEventListener('error', done)
    }
  })
  // timeout de segurança
  setTimeout(runPrint, 2500)
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

  const handlePrint = () => {
    const root = document.getElementById('rulebook-print-root')
    if (!root) {
      window.print()
      return
    }
    printIsolatedRulebook(root, doc.title || `Regulamento — ${champName}`)
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
            className="button secondary"
            onClick={handlePrint}
            title="Baixar PDF só com o regulamento deste campeonato"
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
                {item.order}. {item.title.replace(/^\d+\.\s*/, '')}
              </a>
            ))}
          </nav>
        </aside>

        <div className="rulebook-content" id="rulebook-print-root">
          {/* Capa: somente logo + nome do campeonato (+ sumário enxuto no PDF) */}
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
              Regulamento exclusivo do campeonato <strong>{champName}</strong>. A inscrição e a
              participação implicam aceitação integral deste documento.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
