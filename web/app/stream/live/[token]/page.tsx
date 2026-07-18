'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  boxToCssSafe,
  fieldToCss,
  transitionClass,
  transitionStyle,
  type StreamBlock,
} from '@/features/campeonatos/stream'
import '@/features/campeonatos/stream/stream.css'

type LivePayload = {
  overlay: { id: string; name: string; template: string; blocks: StreamBlock[] }
  data: {
    classificacao: Array<{ pos: number; nome: string; logo?: string | null; booyah: number; abates: number; pts: number }>
    mvp: Array<{ pos: number; nome: string; logo?: string | null; abates: number; quedas: number; kd: string }>
  }
  campeonato?: { nome?: string }
}

export default function StreamLivePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [payload, setPayload] = useState<LivePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/stream/live/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar')
        if (!cancelled) {
          setPayload(json)
          setError('')
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro')
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [token])

  if (error) {
    return (
      <main style={{ margin: 0, minHeight: '100vh', background: 'transparent', color: '#fff', fontFamily: 'Rajdhani, sans-serif', padding: 16 }}>
        <p>{error}</p>
      </main>
    )
  }
  if (!payload) {
    return <main style={{ background: 'transparent', minHeight: '100vh' }} />
  }

  const classif = payload.data.classificacao || []
  const mvp = payload.data.mvp || []
  const template = payload.overlay.template || 'custom'

  return (
    <main className="stream-live-root">
      <div className={`stream-preview-stage layout-${template} stream-live-stage`}>
        {(payload.overlay.blocks || []).map((block, index) => {
          if (block.type === 'card') {
            const isMvp = block.data.variant === 'mvp_hero'
            const row = isMvp ? mvp[0] : classif[(block.data.mapSlot || 1) - 1]
            const box = boxToCssSafe(block.box)
            const titleFs = fieldToCss(block.data.fieldStyles?.title)
            const m1 = fieldToCss(block.data.fieldStyles?.metric_primary)
            const m2 = fieldToCss(block.data.fieldStyles?.metric_secondary)
            const title = isMvp
              ? row?.nome || block.data.titleFixed || 'MVP'
              : block.data.titleFixed || row?.nome || block.name
            return (
              <div
                key={block.id}
                className={`stream-prev-card ${transitionClass(block.transition)}`}
                style={{ ...box, ...transitionStyle(block.transition, index) }}
              >
                <div className="stream-prev-card-art">
                  {row?.logo ? <img src={row.logo} alt="" /> : <span className="stream-prev-logo-fallback">DZ</span>}
                </div>
                <div className="stream-prev-card-title" style={{ ...titleFs.wrap, ...titleFs.text }}>{title}</div>
                <div className="stream-prev-card-metrics">
                  <span style={{ ...m1.wrap, ...m1.text }}>
                    {isMvp ? `${row?.abates ?? 0} ABT` : `${(row as any)?.pts ?? 0} PTS`}
                  </span>
                  <span style={{ ...m2.wrap, ...m2.text }}>
                    {isMvp ? `${(row as any)?.kd ?? '0'} K.D` : `${row?.abates ?? 0} ABT.`}
                  </span>
                </div>
              </div>
            )
          }

          const source = block.data.source === 'mvp' || block.data.variant === 'mvp_list' ? mvp : classif
          const start = block.data.startRank || 1
          const rows = source.filter((r) => r.pos >= start).slice(0, block.data.rows)
          const box = boxToCssSafe(block.box)
          const header = fieldToCss(block.data.headerStyle)
          const rowStyle = fieldToCss(block.data.rowStyle)

          return (
            <div
              key={block.id}
              className={`stream-prev-table ${transitionClass(block.transition)}`}
              style={{ ...box, ...transitionStyle(block.transition, index) }}
            >
              <div className="stream-prev-table-head" style={{ ...header.wrap, ...header.text }}>
                {block.data.columns.map((col) => (
                  <span key={col}>{col === 'pos' ? '#' : col === 'nome' ? 'Nome' : col.toUpperCase()}</span>
                ))}
              </div>
              {rows.map((row, i) => (
                <div
                  key={`${row.pos}-${row.nome}`}
                  className="stream-prev-table-row"
                  style={{
                    ...rowStyle.wrap,
                    ...rowStyle.text,
                    backgroundColor:
                      i % 2 === 1 && block.data.altRowFill
                        ? block.data.altRowFill
                        : (rowStyle.wrap.backgroundColor as string | undefined),
                  }}
                >
                  {block.data.columns.map((col) => {
                    if (col === 'pos') return <span key={col}>{String(row.pos).padStart(2, '0')}</span>
                    if (col === 'logo') {
                      return (
                        <span key={col} className="col-logo">
                          {row.logo ? <img src={row.logo} alt="" /> : <i />}
                        </span>
                      )
                    }
                    if (col === 'nome') return <span key={col} className="col-nome">{row.nome}</span>
                    if (col === 'booyah') return <span key={col}>{(row as any).booyah ?? 0}</span>
                    if (col === 'abates') return <span key={col}>{row.abates ?? 0}</span>
                    if (col === 'pts') return <span key={col} className="col-pts">{(row as any).pts ?? 0}</span>
                    if (col === 'quedas') return <span key={col}>{(row as any).quedas ?? 0}</span>
                    if (col === 'kd') return <span key={col}>{(row as any).kd ?? '0'}</span>
                    if (col === 'delta') return <span key={col}>0</span>
                    return <span key={col} />
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </main>
  )
}
