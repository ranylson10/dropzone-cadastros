'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download,
  FolderArchive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Table2,
} from 'lucide-react'
import { campeonatoExportService } from '../services/campeonato-export.service'
import type {
  CampeonatoExportPayload,
  ExportLine,
  ExportPacoteModo,
} from '../types/campeonato-export.types'
import {
  buildExportZip,
  buildEquipesRows,
  buildJogadoresRows,
  downloadBlob,
  slugify,
  toCsv,
} from '../utils/build-export-zip'

type EscopoUi = 'campeonato' | 'fase' | 'grupo' | 'line'

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  downloadBlob(blob, filename)
}

export function CampeonatoExportTab({ campeonatoId }: { campeonatoId: string }) {
  const [base, setBase] = useState<CampeonatoExportPayload | null>(null)
  const [data, setData] = useState<CampeonatoExportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')

  const [escopo, setEscopo] = useState<EscopoUi>('campeonato')
  const [faseId, setFaseId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [lineId, setLineId] = useState('')

  const loadBase = useCallback(async () => {
    if (!campeonatoId) return
    setLoading(true)
    setError('')
    try {
      const payload = await campeonatoExportService.carregar(campeonatoId)
      setBase(payload)
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar exportação.')
      setBase(null)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [campeonatoId])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  const filtro = useMemo(() => {
    if (escopo === 'fase' && faseId) return { fase_id: faseId }
    if (escopo === 'grupo' && grupoId) return { grupo_id: grupoId }
    if (escopo === 'line' && lineId) return { line_id: lineId }
    return {}
  }, [escopo, faseId, grupoId, lineId])

  const reloadFiltered = useCallback(async () => {
    if (!campeonatoId) return
    setBusy('filtro')
    setError('')
    try {
      const payload = await campeonatoExportService.carregar(campeonatoId, filtro)
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao filtrar exportação.')
    } finally {
      setBusy('')
    }
  }, [campeonatoId, filtro])

  useEffect(() => {
    if (!base) return
    if (escopo === 'campeonato') {
      setData(base)
      return
    }
    // só recarrega se o id necessário estiver escolhido
    if (escopo === 'fase' && !faseId) return
    if (escopo === 'grupo' && !grupoId) return
    if (escopo === 'line' && !lineId) return
    void reloadFiltered()
  }, [escopo, faseId, grupoId, lineId, base, reloadFiltered])

  const fases = base?.estrutura?.fases || []
  const grupos = useMemo(() => {
    const list = base?.estrutura?.grupos || []
    if (escopo === 'fase' && faseId) return list.filter((g) => g.fase_id === faseId)
    return list
  }, [base?.estrutura?.grupos, escopo, faseId])

  const linesOpts = useMemo(() => {
    const source = escopo === 'campeonato' || !data ? base : data
    const rows: Array<{ id: string; label: string }> = []
    for (const eq of source?.equipes || []) {
      for (const line of eq.lines || []) {
        if (!line.id) continue
        if (escopo === 'grupo' && grupoId && line.grupo?.id !== grupoId) continue
        if (escopo === 'fase' && faseId && line.grupo?.fase_id !== faseId) continue
        rows.push({
          id: line.id,
          label: `${eq.nome} · ${line.nome}${line.grupo?.nome ? ` (${line.grupo.nome})` : ''}`,
        })
      }
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [base, data, escopo, grupoId, faseId])

  const baseName = useMemo(
    () => slugify(data?.campeonato?.nome || campeonatoId),
    [data?.campeonato?.nome, campeonatoId],
  )

  const flatLines = useMemo(() => {
    const list: Array<ExportLine & { equipe_nome: string; equipe_id: string }> = []
    for (const eq of data?.equipes || []) {
      for (const line of eq.lines || []) {
        list.push({ ...line, equipe_nome: eq.nome, equipe_id: eq.id })
      }
    }
    return list
  }, [data])

  async function baixarPacote(modo: ExportPacoteModo) {
    if (!data) return
    if (escopo === 'fase' && !faseId) {
      setError('Selecione a fase.')
      return
    }
    if (escopo === 'grupo' && !grupoId) {
      setError('Selecione o grupo.')
      return
    }
    if (escopo === 'line' && !lineId) {
      setError('Selecione a line.')
      return
    }

    setBusy(modo)
    setError('')
    setProgress('')
    try {
      const { blob, filename } = await buildExportZip(data, modo, (p) => {
        if (p.total > 0) setProgress(`${p.label}`)
      })
      downloadBlob(blob, filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o pacote ZIP.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  function baixarTabelaEquipes() {
    if (!data) return
    downloadText(
      `tabela-equipes-${baseName}.csv`,
      toCsv(buildEquipesRows(data)),
      'text/csv;charset=utf-8',
    )
  }

  function baixarTabelaJogadores() {
    if (!data) return
    downloadText(
      `tabela-jogadores-${baseName}.csv`,
      toCsv(buildJogadoresRows(data)),
      'text/csv;charset=utf-8',
    )
  }

  if (loading) {
    return (
      <div className="export-tab-state">
        <Loader2 className="spin" size={18} /> Carregando dados do campeonato...
      </div>
    )
  }

  if (error && !data && !base) {
    return (
      <div className="export-tab-panel">
        <div className="message error">{error}</div>
        <button className="button secondary" type="button" onClick={() => void loadBase()}>
          <RefreshCw size={15} /> Tentar de novo
        </button>
      </div>
    )
  }

  if (!data) {
    return <p className="empty">Nenhum dado para exportar.</p>
  }

  const canDownload =
    escopo === 'campeonato'
    || (escopo === 'fase' && Boolean(faseId))
    || (escopo === 'grupo' && Boolean(grupoId))
    || (escopo === 'line' && Boolean(lineId))

  return (
    <div className="export-tab-panel">
      <header className="export-tab-head">
        <div>
          <p className="eyebrow">Produção / SPEC</p>
          <h3>Exportar dados do campeonato</h3>
          <p className="empty" style={{ margin: '6px 0 0' }}>
            Baixa um pacote com <strong>tabelas</strong> e <strong>pastas de logos/fotos</strong>.
            Não é logo por logo — o ZIP reúne tudo do escopo escolhido.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => void loadBase()} disabled={Boolean(busy)}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </header>

      {error ? <div className="message error">{error}</div> : null}

      <section className="export-section">
        <div className="section-head">
          <h4>1. Escopo do download</h4>
        </div>
        <div className="export-filter-grid">
          <label className="field">
            <span>Nível</span>
            <select
              value={escopo}
              onChange={(e) => {
                const value = e.target.value as EscopoUi
                setEscopo(value)
                if (value === 'campeonato') {
                  setFaseId('')
                  setGrupoId('')
                  setLineId('')
                }
                if (value === 'fase') {
                  setGrupoId('')
                  setLineId('')
                }
                if (value === 'grupo') setLineId('')
              }}
            >
              <option value="campeonato">Campeonato inteiro</option>
              <option value="fase">Fase</option>
              <option value="grupo">Grupo</option>
              <option value="line">Line individual</option>
            </select>
          </label>

          {(escopo === 'fase' || escopo === 'grupo') ? (
            <label className="field">
              <span>Fase</span>
              <select
                value={faseId}
                onChange={(e) => {
                  setFaseId(e.target.value)
                  setGrupoId('')
                  setLineId('')
                }}
              >
                <option value="">Selecione a fase</option>
                {fases.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </label>
          ) : null}

          {escopo === 'grupo' ? (
            <label className="field">
              <span>Grupo</span>
              <select
                value={grupoId}
                onChange={(e) => {
                  setGrupoId(e.target.value)
                  setLineId('')
                }}
                disabled={!faseId && grupos.length === 0}
              >
                <option value="">Selecione o grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}{g.fase_nome ? ` · ${g.fase_nome}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {escopo === 'line' ? (
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Line</span>
              <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
                <option value="">Selecione a line</option>
                {linesOpts.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <div className="detail-stats-ref export-stats">
        <div className="detail-stat">
          <strong>{data.resumo.total_equipes}</strong>
          <span>Equipes</span>
        </div>
        <div className="detail-stat">
          <strong>{data.resumo.total_lines}</strong>
          <span>Lines</span>
        </div>
        <div className="detail-stat">
          <strong>{data.resumo.total_jogadores}</strong>
          <span>Jogadores</span>
        </div>
        <div className="detail-stat">
          <strong>{data.resumo.total_midias}</strong>
          <span>Mídias no pacote</span>
        </div>
      </div>

      <section className="export-section">
        <div className="section-head">
          <h4>2. Baixar pacote</h4>
          <small>ZIP com pastas</small>
        </div>
        <div className="export-actions-grid">
          <button
            className="button"
            type="button"
            disabled={!canDownload || Boolean(busy)}
            onClick={() => void baixarPacote('completo')}
          >
            {busy === 'completo' ? <Loader2 size={16} className="spin" /> : <FolderArchive size={16} />}
            Pacote completo
            <span className="export-btn-hint">tabelas + logos + fotos</span>
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!canDownload || Boolean(busy)}
            onClick={() => void baixarPacote('tabelas')}
          >
            {busy === 'tabelas' ? <Loader2 size={16} className="spin" /> : <Table2 size={16} />}
            Só tabelas / lista
            <span className="export-btn-hint">CSV + lista TXT</span>
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!canDownload || Boolean(busy) || !data.resumo.total_midias}
            onClick={() => void baixarPacote('midias')}
          >
            {busy === 'midias' ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
            Só logos e fotos
            <span className="export-btn-hint">pastas no ZIP</span>
          </button>
        </div>
        {progress ? (
          <p className="export-progress">
            <Loader2 size={14} className="spin" /> {progress}
          </p>
        ) : null}
        <p className="empty" style={{ margin: '8px 0 0' }}>
          Estrutura do ZIP: <code>tabelas/</code> (CSV/lista) · <code>logos/equipes|lines/</code> · <code>fotos/jogadores/</code>
        </p>
      </section>

      <section className="export-section">
        <div className="section-head">
          <h4>Atalhos de tabela</h4>
        </div>
        <div className="export-actions-grid">
          <button className="button secondary" type="button" disabled={!canDownload || Boolean(busy)} onClick={baixarTabelaEquipes}>
            <Table2 size={15} /> CSV equipes/lines
          </button>
          <button className="button secondary" type="button" disabled={!canDownload || Boolean(busy)} onClick={baixarTabelaJogadores}>
            <Table2 size={15} /> CSV jogadores
          </button>
        </div>
      </section>

      <section className="export-section">
        <div className="section-head">
          <h4>Prévia em lista</h4>
          <small>{flatLines.length} lines no escopo</small>
        </div>
        <div className="export-table-wrap">
          <table className="export-table">
            <thead>
              <tr>
                <th>Fase</th>
                <th>Grupo</th>
                <th>Slot</th>
                <th>Equipe</th>
                <th>Line</th>
                <th>Jogadores</th>
              </tr>
            </thead>
            <tbody>
              {flatLines.slice(0, 40).map((line) => (
                <tr key={line.participacao_id}>
                  <td>{line.grupo?.fase_nome || '—'}</td>
                  <td>{line.grupo?.nome || '—'}</td>
                  <td>{line.slot?.numero ?? '—'}</td>
                  <td>
                    <span className="export-cell-with-logo">
                      {/* preview visual only */}
                      {line.logo_url ? <img src={line.logo_url} alt="" /> : null}
                      {line.equipe_nome}
                    </span>
                  </td>
                  <td>{line.nome}</td>
                  <td>{line.quantidade_jogadores}</td>
                </tr>
              ))}
              {!flatLines.length ? (
                <tr>
                  <td colSpan={6}>Nenhuma line no escopo selecionado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {flatLines.length > 40 ? (
            <p className="empty">Mostrando 40 de {flatLines.length}. O ZIP traz tudo.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
