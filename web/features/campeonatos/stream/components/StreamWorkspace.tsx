'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { StreamPackageEditor } from './StreamPackageEditor'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import '../stream.css'

export function StreamWorkspace(props: { campeonatoId: string }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoadingMeta(true)
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        const res = await fetch(`/api/campeonatos/${props.campeonatoId}/equipes`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json().catch(() => ({}))
        if (!active) return
        setNome(json?.campeonato?.nome || 'Campeonato')
      } catch {
        if (active) setNome('Campeonato')
      } finally {
        if (active) setLoadingMeta(false)
      }
    })()
    return () => {
      active = false
    }
  }, [props.campeonatoId])

  return (
    <div className="stream-workspace">
      <header className="stream-workspace-header">
        <div className="stream-workspace-brand">
          <button type="button" className="stream-icon-btn" onClick={() => router.push('/')}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <p className="eyebrow">Transmissão ao vivo</p>
            <h1>
              {loadingMeta ? <Loader2 size={18} className="spin" /> : null}
              {nome || 'Campeonato'}
            </h1>
          </div>
        </div>
        <div className="stream-panel-actions">
          <div id="stream-package-header-slot" className="stream-package-header-slot" />
          <StreamSpreadsheetPanel
            campeonatoId={props.campeonatoId}
            asModal
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            showTrigger
            triggerLabel="Dados"
          />
        </div>
      </header>

      <main className="stream-workspace-main">
        <StreamPackageEditor campeonatoId={props.campeonatoId} />
      </main>
    </div>
  )
}
