'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'
import { RulebookViewer } from '@/features/campeonatos/rulebook'
import type { GeneratedDocument } from '@/features/campeonatos/rulebook'
import '@/features/campeonatos/rulebook/rulebook.css'

export default function RegulamentoPublicoPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [documento, setDocumento] = useState<GeneratedDocument | null>(null)
  const [meta, setMeta] = useState<{ versao?: number; publicado_em?: string | null }>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/campeonatos/${id}/rulebook?public=1`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Regulamento indisponível')
        if (cancelled) return
        setDocumento(json.documento || null)
        setMeta({ versao: json.versao, publicado_em: json.publicado_em })
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar regulamento')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const logoUrl = documento?.logoUrl || null
  const champName = documento?.campeonatoNome || 'Regulamento do campeonato'

  return (
    <main className="rulebook-public-page">
      <div className="rulebook-public-shell">
        <header className="rulebook-public-hero no-print">
          {logoUrl ? (
            <img className="rulebook-public-hero-logo" src={logoUrl} alt={`Logo ${champName}`} />
          ) : (
            <BookOpen size={28} />
          )}
          <div>
            <p className="eyebrow">DropZone · Regulamento oficial</p>
            <h1>{champName}</h1>
            {meta.publicado_em ? (
              <small>
                Publicado em {new Date(meta.publicado_em).toLocaleString('pt-BR')}
                {meta.versao ? ` · v${meta.versao}` : ''}
              </small>
            ) : null}
          </div>
        </header>

        {loading ? (
          <div className="rulebook-loading">
            <Loader2 className="spin" size={22} />
            Carregando regulamento…
          </div>
        ) : null}

        {error ? (
          <div className="rulebook-error">
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && !error ? <RulebookViewer documento={documento} /> : null}
      </div>
    </main>
  )
}
