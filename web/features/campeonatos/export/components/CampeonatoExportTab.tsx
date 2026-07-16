'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download,
  FileJson,
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
import {
  buildPlayerNameOverwrite,
  DEFAULT_FF_TEXT_COLORS,
  type FfTextColors,
} from '../utils/player-name-overwrite'

type EscopoUi = 'campeonato' | 'fase' | 'grupo'

function downloadText(filename: string, content: string, mime: string) {
  downloadBlob(new Blob([content], { type: mime }), filename)
}

export function CampeonatoExportTab({ campeonatoId }: { campeonatoId: string }) {
  const [base, setBase] = useState<CampeonatoExportPayload | null>(null)
  const [data, setData] = useState<CampeonatoExportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [specMsg, setSpecMsg] = useState('')

  const [escopo, setEscopo] = useState<EscopoUi>('campeonato')
  const [faseId, setFaseId] = useState('')
  const [grupoIds, setGrupoIds] = useState<string[]>([])

  // SPEC Free Fire — cores
  const [roleColor, setRoleColor] = useState('#000000')
  const [teamColor, setTeamColor] = useState('#000000')
  const [textColors, setTextColors] = useState<FfTextColors>({ ...DEFAULT_FF_TEXT_COLORS })

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
    if (escopo === 'grupo' && grupoIds.length) return { grupo_ids: grupoIds }
    return {}
  }, [escopo, faseId, grupoIds])

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
    if (escopo === 'fase' && !faseId) return
    if (escopo === 'grupo' && !grupoIds.length) return
    void reloadFiltered()
  }, [escopo, faseId, grupoIds, base, reloadFiltered])

  const fases = base?.estrutura?.fases || []
  const grupos = useMemo(() => {
    const list = base?.estrutura?.grupos || []
    if (faseId) return list.filter((g) => g.fase_id === faseId)
    return list
  }, [base?.estrutura?.grupos, faseId])

  const baseName = useMemo(
    () => slugify(data?.campeonato?.nome || campeonatoId),
    [data?.campeonato?.nome, campeonatoId],
  )

  const flatLines = useMemo(() => {
    const list: Array<ExportLine & { equipe_nome: string }> = []
    for (const eq of data?.equipes || []) {
      for (const line of eq.lines || []) {
        list.push({ ...line, equipe_nome: eq.nome })
      }
    }
    return list
  }, [data])

  const canDownload =
    escopo === 'campeonato'
    || (escopo === 'fase' && Boolean(faseId))
    || (escopo === 'grupo' && grupoIds.length > 0)

  function toggleGrupo(id: string) {
    setGrupoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function baixarPacote(modo: ExportPacoteModo) {
    if (!data || !canDownload) return
    setBusy(modo)
    setError('')
    setProgress('')
    try {
      const { blob, filename } = await buildExportZip(data, modo, (p) => {
        if (p.total > 0) setProgress(p.label)
      })
      downloadBlob(blob, filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o ZIP.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  function gerarPlayerNameOverwrite() {
    if (!data || !canDownload) return
    setBusy('spec')
    setSpecMsg('')
    setError('')
    try {
      const { content, stats } = buildPlayerNameOverwrite(data, {
        roleColor,
        teamColor,
        textColor: textColors,
      })
      downloadText('PlayerNameOverwrite.json', content, 'application/json;charset=utf-8')
      setSpecMsg(
        `Gerado: ${stats.players} jogadores · ${stats.teams} equipes`
        + (stats.skipped ? ` · ${stats.skipped} sem id_jogo (ignorados)` : ''),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar PlayerNameOverwrite.json')
    } finally {
      setBusy('')
    }
  }

  const setTc = (key: keyof FfTextColors, value: string) => {
    setTextColors((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="export-tab-state">
        <Loader2 className="spin" size={18} /> Carregando...
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

  if (!data) return <p className="empty">Nenhum dado para exportar.</p>

  return (
    <div className="export-tab-panel export-tab-compact">
      <header className="export-tab-head export-tab-head-compact">
        <div>
          <p className="eyebrow">Produção</p>
          <h3>Download / SPEC</h3>
        </div>
        <button className="button secondary small" type="button" onClick={() => void loadBase()} disabled={Boolean(busy)}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </header>

      {error ? <div className="message error">{error}</div> : null}

      {/* FILTRO COMPACTO */}
      <section className="export-section export-section-compact">
        <div className="export-toolbar">
          <label className="export-inline-field">
            <span>Escopo</span>
            <select
              value={escopo}
              onChange={(e) => {
                const v = e.target.value as EscopoUi
                setEscopo(v)
                if (v === 'campeonato') {
                  setFaseId('')
                  setGrupoIds([])
                }
                if (v === 'fase') setGrupoIds([])
              }}
            >
              <option value="campeonato">Campeonato</option>
              <option value="fase">Fase</option>
              <option value="grupo">Grupo(s)</option>
            </select>
          </label>

          {(escopo === 'fase' || escopo === 'grupo') ? (
            <label className="export-inline-field">
              <span>Fase</span>
              <select
                value={faseId}
                onChange={(e) => {
                  setFaseId(e.target.value)
                  setGrupoIds([])
                }}
              >
                <option value="">{escopo === 'fase' ? 'Selecione' : 'Todas (filtro)'}</option>
                {fases.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="export-mini-stats">
            <span><b>{data.resumo.total_equipes}</b> eq</span>
            <span><b>{data.resumo.total_lines}</b> lines</span>
            <span><b>{data.resumo.total_jogadores}</b> jog</span>
            <span><b>{data.resumo.total_midias}</b> mídia</span>
          </div>
        </div>

        {escopo === 'grupo' ? (
          <div className="export-grupo-multi">
            <span className="export-grupo-label">Grupos (pode marcar vários)</span>
            <div className="export-grupo-chips">
              {grupos.map((g) => {
                const on = grupoIds.includes(g.id)
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`export-chip ${on ? 'active' : ''}`}
                    onClick={() => toggleGrupo(g.id)}
                  >
                    {g.nome}
                    {g.fase_nome ? <small>{g.fase_nome}</small> : null}
                  </button>
                )
              })}
              {!grupos.length ? <span className="empty">Nenhum grupo nesta fase.</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* SPEC FREE FIRE */}
      <section className="export-section export-section-compact">
        <div className="section-head">
          <h4>PlayerNameOverwrite.json</h4>
          <small>SPEC Free Fire · telamento</small>
        </div>
        <p className="export-help">
          Gera o arquivo com o <strong>mesmo nome</strong> do SPEC.
          Dados do sistema: <code>PlayerID</code> (id do jogo), tag + nick (separador invisível),
          função e cores. Equipes em <code>TeamRegionList</code>.
        </p>

        <div className="export-color-row">
          <label className="export-color-field">
            <span>Cor função</span>
            <input type="color" value={roleColor} onChange={(e) => setRoleColor(e.target.value)} />
            <input value={roleColor} onChange={(e) => setRoleColor(e.target.value)} />
          </label>
          <label className="export-color-field">
            <span>Cor equipe</span>
            <input type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} />
            <input value={teamColor} onChange={(e) => setTeamColor(e.target.value)} />
          </label>
          <label className="export-color-field">
            <span>Nome jogador</span>
            <input type="color" value={textColors.TeamPlayer1} onChange={(e) => {
              const v = e.target.value
              setTextColors((p) => ({
                ...p,
                TeamPlayer1: v,
                TeamPlayer2: v,
                TeamPlayer3: v,
                TeamPlayer4: v,
              }))
            }} />
          </label>
          <label className="export-color-field">
            <span>Número</span>
            <input type="color" value={textColors.TeamPlayer1Num} onChange={(e) => {
              const v = e.target.value
              setTextColors((p) => ({
                ...p,
                TeamPlayer1Num: v,
                TeamPlayer2Num: v,
                TeamPlayer3Num: v,
                TeamPlayer4Num: v,
              }))
            }} />
          </label>
          <label className="export-color-field">
            <span>Vivo</span>
            <input type="color" value={textColors.Alive} onChange={(e) => setTc('Alive', e.target.value)} />
          </label>
          <label className="export-color-field">
            <span>Knock</span>
            <input type="color" value={textColors.Knockdown} onChange={(e) => setTc('Knockdown', e.target.value)} />
          </label>
          <label className="export-color-field">
            <span>Eliminado</span>
            <input type="color" value={textColors.Eliminated} onChange={(e) => setTc('Eliminated', e.target.value)} />
          </label>
        </div>

        <div className="export-actions-row">
          <button
            className="button"
            type="button"
            disabled={!canDownload || Boolean(busy)}
            onClick={gerarPlayerNameOverwrite}
          >
            {busy === 'spec' ? <Loader2 size={15} className="spin" /> : <FileJson size={15} />}
            Baixar PlayerNameOverwrite.json
          </button>
          {specMsg ? <span className="export-spec-msg">{specMsg}</span> : null}
        </div>
      </section>

      {/* PACOTE ZIP / TABELAS — compacto */}
      <section className="export-section export-section-compact">
        <div className="section-head">
          <h4>Pacote e tabelas</h4>
        </div>
        <div className="export-actions-row export-actions-wrap">
          <button className="button secondary small" type="button" disabled={!canDownload || Boolean(busy)} onClick={() => void baixarPacote('completo')}>
            {busy === 'completo' ? <Loader2 size={14} className="spin" /> : <FolderArchive size={14} />}
            ZIP completo
          </button>
          <button className="button secondary small" type="button" disabled={!canDownload || Boolean(busy)} onClick={() => void baixarPacote('tabelas')}>
            {busy === 'tabelas' ? <Loader2 size={14} className="spin" /> : <Table2 size={14} />}
            ZIP tabelas
          </button>
          <button className="button secondary small" type="button" disabled={!canDownload || Boolean(busy) || !data.resumo.total_midias} onClick={() => void baixarPacote('midias')}>
            {busy === 'midias' ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
            ZIP mídias
          </button>
          <button
            className="button secondary small"
            type="button"
            disabled={!canDownload || Boolean(busy)}
            onClick={() => downloadText(`tabela-equipes-${baseName}.csv`, toCsv(buildEquipesRows(data)), 'text/csv;charset=utf-8')}
          >
            <Download size={14} /> CSV equipes
          </button>
          <button
            className="button secondary small"
            type="button"
            disabled={!canDownload || Boolean(busy)}
            onClick={() => downloadText(`tabela-jogadores-${baseName}.csv`, toCsv(buildJogadoresRows(data)), 'text/csv;charset=utf-8')}
          >
            <Download size={14} /> CSV jogadores
          </button>
        </div>
        {progress ? (
          <p className="export-progress">
            <Loader2 size={13} className="spin" /> {progress}
          </p>
        ) : null}
      </section>

      {/* PRÉVIA COMPACTA */}
      <section className="export-section export-section-compact">
        <div className="section-head">
          <h4>Prévia</h4>
          <small>{flatLines.length} lines</small>
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
                <th>Jog.</th>
              </tr>
            </thead>
            <tbody>
              {flatLines.slice(0, 30).map((line) => (
                <tr key={line.participacao_id}>
                  <td>{line.grupo?.fase_nome || '—'}</td>
                  <td>{line.grupo?.nome || '—'}</td>
                  <td>{line.slot?.numero ?? '—'}</td>
                  <td>{line.equipe_nome}</td>
                  <td>{line.nome}</td>
                  <td>{line.quantidade_jogadores}</td>
                </tr>
              ))}
              {!flatLines.length ? (
                <tr><td colSpan={6}>Nada no escopo — selecione fase/grupo ou use campeonato.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
