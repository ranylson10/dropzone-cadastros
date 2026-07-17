'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FolderArchive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Table2,
  Users,
  UserRound,
} from 'lucide-react'
import { campeonatoExportService } from '../services/campeonato-export.service'
import type {
  CampeonatoExportPayload,
  ExportPacoteModo,
} from '../types/campeonato-export.types'
import {
  buildExportZip,
  downloadBlob,
  slugify,
  toCsv,
} from '../utils/build-export-zip'
import {
  buildPlayerNameOverwrite,
  cityOnly,
  DEFAULT_FF_TEXT_COLORS,
  type FfNationSource,
  type FfTextColors,
} from '../utils/player-name-overwrite'
import { SpecMediaPanel } from './SpecMediaPanel'
import { exportOverridesService, type ExportOverrides } from '../services/export-overrides.service'

type EscopoUi = 'campeonato' | 'fase' | 'grupo'

/** Notas / subabas do fluxo Download-SPEC */
type ExportNote = 'equipes' | 'jogadores' | 'logos' | 'fotos'

const EXPORT_NOTES: {
  id: ExportNote
  label: string
  short: string
  step: number
}[] = [
  { id: 'equipes', label: 'Arquivos equipes', short: 'Equipes', step: 1 },
  { id: 'jogadores', label: 'Arquivos jogadores', short: 'Jogadores', step: 2 },
  { id: 'logos', label: 'Logos equipes', short: 'Logos', step: 3 },
  { id: 'fotos', label: 'Fotos jogadores', short: 'Fotos', step: 4 },
]

type EditEquipe = {
  id: string
  nome: string
  tag: string
}

type EditJogador = {
  key: string
  equipeId: string
  tag_equipe: string
  nick: string
  id_jogo: string
  funcao: string
  localidade: string
}

function downloadText(filename: string, content: string, mime: string) {
  downloadBlob(new Blob([content], { type: mime }), filename)
}

function buildEditState(payload: CampeonatoExportPayload) {
  const equipes: EditEquipe[] = []
  const jogadores: EditJogador[] = []
  for (const eq of payload.equipes || []) {
    equipes.push({
      id: eq.id,
      nome: eq.nome || '',
      tag: eq.tag || '',
    })
    for (const line of eq.lines || []) {
      const tagLine = line.tag || eq.tag || ''
      for (const jog of line.jogadores || []) {
        jogadores.push({
          key: `${eq.id}:${line.participacao_id}:${jog.id}`,
          equipeId: eq.id,
          tag_equipe: tagLine,
          nick: jog.nick || '',
          id_jogo: jog.id_jogo || '',
          funcao: jog.funcao || '',
          localidade: cityOnly(jog.localidade) || jog.localidade || '',
        })
      }
    }
  }
  return { equipes, jogadores }
}

/** Aplica edições da prévia no payload (CSV / ZIP / SPEC usam isso). */
function applyEdits(
  source: CampeonatoExportPayload,
  equipesEdit: EditEquipe[],
  jogadoresEdit: EditJogador[],
): CampeonatoExportPayload {
  const eqMap = new Map(equipesEdit.map((e) => [e.id, e]))
  const jogByKey = new Map(jogadoresEdit.map((j) => [j.key, j]))

  const equipes = (source.equipes || []).map((eq) => {
    const edit = eqMap.get(eq.id)
    const nome = edit?.nome ?? eq.nome
    const tag = edit?.tag ?? eq.tag
    return {
      ...eq,
      nome,
      tag,
      lines: (eq.lines || []).map((line) => ({
        ...line,
        tag: line.tag ? (edit?.tag ?? line.tag) : tag,
        jogadores: (line.jogadores || []).map((jog) => {
          const key = `${eq.id}:${line.participacao_id}:${jog.id}`
          const je = jogByKey.get(key)
          if (!je) return jog
          return {
            ...jog,
            nick: je.nick,
            id_jogo: je.id_jogo,
            funcao: je.funcao,
            localidade: je.localidade,
          }
        }),
      })),
    }
  })

  // se o adm mudou a tag da equipe, propaga para jogadores sem tag de line
  for (const j of jogadoresEdit) {
    const eq = eqMap.get(j.equipeId)
    if (eq && !j.tag_equipe) j.tag_equipe = eq.tag
  }

  // re-apply tag_equipe edits onto lines when tag_equipe differs
  const equipesFinal = equipes.map((eq) => ({
    ...eq,
    lines: eq.lines.map((line) => ({
      ...line,
      jogadores: line.jogadores.map((jog) => {
        const key = `${eq.id}:${line.participacao_id}:${jog.id}`
        const je = jogByKey.get(key)
        if (!je) return jog
        // se tag_equipe foi editada no jogador, grava na line.tag para o SPEC usar
        return jog
      }),
      // tag efetiva para SPEC: se todos jogadores da line têm mesma tag_equipe editada
      tag: (() => {
        const first = line.jogadores[0]
        if (!first) return line.tag || eq.tag
        const key = `${eq.id}:${line.participacao_id}:${first.id}`
        const je = jogByKey.get(key)
        return je?.tag_equipe || line.tag || eq.tag
      })(),
    })),
  }))

  return {
    ...source,
    equipes: equipesFinal,
    resumo: {
      ...source.resumo,
      total_equipes: equipesFinal.length,
      total_jogadores: jogadoresEdit.length,
    },
  }
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

  // edições da prévia (não grava no banco — só no export)
  const [equipesEdit, setEquipesEdit] = useState<EditEquipe[]>([])
  const [jogadoresEdit, setJogadoresEdit] = useState<EditJogador[]>([])

  // SPEC Free Fire
  const [roleColor, setRoleColor] = useState('#000000')
  const [teamColor, setTeamColor] = useState('#000000')
  const [textColors, setTextColors] = useState<FfTextColors>({ ...DEFAULT_FF_TEXT_COLORS })
  const [nationSource, setNationSource] = useState<FfNationSource>('funcao')
  const [overrides, setOverrides] = useState<ExportOverrides | null>(null)
  const [backupHint, setBackupHint] = useState('')
  const [missingTable, setMissingTable] = useState(false)
  const [note, setNote] = useState<ExportNote>('equipes')

  const applyOverridesToEdits = useCallback((
    payload: CampeonatoExportPayload,
    ov: ExportOverrides | null,
  ) => {
    const { equipes, jogadores } = buildEditState(payload)
    if (ov?.equipes) {
      for (const e of equipes) {
        const b = ov.equipes[e.id]
        if (b?.nome != null) e.nome = String(b.nome)
        if (b?.tag != null) e.tag = String(b.tag)
      }
    }
    if (ov?.jogadores) {
      for (const j of jogadores) {
        const b = ov.jogadores[j.key]
        if (!b) continue
        if (b.nick != null) j.nick = String(b.nick)
        if (b.id_jogo != null) j.id_jogo = String(b.id_jogo)
        if (b.funcao != null) j.funcao = String(b.funcao)
        if (b.localidade != null) j.localidade = String(b.localidade)
        if (b.tag_equipe != null) j.tag_equipe = String(b.tag_equipe)
      }
    }
    setEquipesEdit(equipes)
    setJogadoresEdit(jogadores)
    if (ov?.nation_source === 'funcao' || ov?.nation_source === 'localidade') {
      setNationSource(ov.nation_source)
    }
    if (ov?.role_color) setRoleColor(ov.role_color)
    if (ov?.team_color) setTeamColor(ov.team_color)
    if (ov?.text_colors && typeof ov.text_colors === 'object') {
      setTextColors({ ...DEFAULT_FF_TEXT_COLORS, ...(ov.text_colors as FfTextColors) })
    }
  }, [])

  const loadBase = useCallback(async () => {
    if (!campeonatoId) return
    setLoading(true)
    setError('')
    setBackupHint('')
    setMissingTable(false)
    try {
      const payload = await campeonatoExportService.carregar(campeonatoId)
      let ov: ExportOverrides | null = null
      try {
        const ovRes = await exportOverridesService.load(campeonatoId)
        ov = ovRes.overrides || null
        if (ovRes.missing_table) {
          setMissingTable(true)
          setBackupHint(
            'Backup desativado: falta criar a tabela no Supabase. Baixe o SQL abaixo, cole no SQL Editor e rode uma vez.',
          )
        } else if (ov?.updated_at) {
          setBackupHint(`Backup do campeonato carregado (${new Date(ov.updated_at).toLocaleString('pt-BR')}).`)
        }
      } catch {
        ov = null
      }
      setOverrides(ov)
      setBase(payload)
      setData(payload)
      applyOverridesToEdits(payload, ov)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar exportação.')
      setBase(null)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [campeonatoId, applyOverridesToEdits])

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
      applyOverridesToEdits(payload, overrides)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao filtrar exportação.')
    } finally {
      setBusy('')
    }
  }, [campeonatoId, filtro, overrides, applyOverridesToEdits])

  useEffect(() => {
    if (!base) return
    if (escopo === 'campeonato') {
      setData(base)
      applyOverridesToEdits(base, overrides)
      return
    }
    if (escopo === 'fase' && !faseId) return
    if (escopo === 'grupo' && !grupoIds.length) return
    void reloadFiltered()
  }, [escopo, faseId, grupoIds, base, reloadFiltered, overrides, applyOverridesToEdits])

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

  const editedPayload = useMemo(() => {
    if (!data) return null
    return applyEdits(data, equipesEdit, jogadoresEdit)
  }, [data, equipesEdit, jogadoresEdit])

  const canDownload =
    escopo === 'campeonato'
    || (escopo === 'fase' && Boolean(faseId))
    || (escopo === 'grupo' && grupoIds.length > 0)

  function toggleGrupo(id: string) {
    setGrupoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function patchEquipe(id: string, field: 'nome' | 'tag', value: string) {
    setEquipesEdit((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
    // se mudou tag da equipe, atualiza tag_equipe dos jogadores daquela equipe
    if (field === 'tag') {
      setJogadoresEdit((prev) =>
        prev.map((j) => (j.equipeId === id ? { ...j, tag_equipe: value } : j)),
      )
    }
  }

  function patchJogador(key: string, field: keyof EditJogador, value: string) {
    setJogadoresEdit((prev) => prev.map((j) => (j.key === key ? { ...j, [field]: value } : j)))
  }

  async function baixarPacote(modo: ExportPacoteModo) {
    if (!editedPayload || !canDownload) return
    setBusy(modo)
    setError('')
    setProgress('')
    try {
      const { blob, filename } = await buildExportZip(editedPayload, modo, (p) => {
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

  function baixarCsvEquipes() {
    if (!equipesEdit.length) return
    downloadText(
      `tabela-equipes-${baseName}.csv`,
      toCsv(equipesEdit.map((e) => ({ nome_equipe: e.nome, tag: e.tag }))),
      'text/csv;charset=utf-8',
    )
  }

  function baixarCsvJogadores() {
    if (!jogadoresEdit.length) return
    downloadText(
      `tabela-jogadores-${baseName}.csv`,
      toCsv(
        jogadoresEdit.map((j) => ({
          tag_equipe: j.tag_equipe,
          nick: j.nick,
          id_jogo: j.id_jogo,
          funcao: j.funcao,
          localidade: j.localidade,
        })),
      ),
      'text/csv;charset=utf-8',
    )
  }

  function gerarPlayerNameOverwrite() {
    if (!editedPayload || !canDownload) return
    setBusy('spec')
    setSpecMsg('')
    setError('')
    try {
      const { content, stats } = buildPlayerNameOverwrite(editedPayload, {
        roleColor,
        teamColor,
        textColor: textColors,
        nationSource,
      })
      downloadText('PlayerNameOverwrite.json', content, 'application/json;charset=utf-8')
      setSpecMsg(
        `Gerado: ${stats.players} jogadores · ${stats.teams} equipes`
        + (stats.skipped ? ` · ${stats.skipped} sem id_jogo` : '')
        + ` · PlayerNation=${nationSource === 'localidade' ? 'cidade' : 'função'}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar PlayerNameOverwrite.json')
    } finally {
      setBusy('')
    }
  }

  async function salvarEdicoesTextoNoCampeonato() {
    if (!canDownload) return
    setBusy('backup-texto')
    setError('')
    setSpecMsg('')
    try {
      const equipesMap: Record<string, { nome: string; tag: string }> = {}
      for (const e of equipesEdit) {
        equipesMap[e.id] = { nome: e.nome, tag: e.tag }
      }
      const jogadoresMap: Record<string, EditJogador> = {}
      for (const j of jogadoresEdit) {
        jogadoresMap[j.key] = j
      }
      await exportOverridesService.save(campeonatoId, {
        equipes: equipesMap,
        jogadores: Object.fromEntries(
          Object.entries(jogadoresMap).map(([k, j]) => [
            k,
            {
              nick: j.nick,
              id_jogo: j.id_jogo,
              funcao: j.funcao,
              localidade: j.localidade,
              tag_equipe: j.tag_equipe,
              equipe_id: j.equipeId,
            },
          ]),
        ),
        nation_source: nationSource,
        role_color: roleColor,
        team_color: teamColor,
        text_colors: textColors,
      })
      setSpecMsg('Edições de equipes/jogadores salvas neste campeonato.')
      setBackupHint('Backup de texto atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar backup de texto.')
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

  const noteIndex = EXPORT_NOTES.findIndex((n) => n.id === note)
  const prevNote = noteIndex > 0 ? EXPORT_NOTES[noteIndex - 1] : null
  const nextNote = noteIndex >= 0 && noteIndex < EXPORT_NOTES.length - 1 ? EXPORT_NOTES[noteIndex + 1] : null

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
      {backupHint ? <p className="export-spec-msg">{backupHint}</p> : null}
      {missingTable ? (
        <div className="export-actions-row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <a
            className="button secondary small"
            href="/sql/DOWNLOAD_export_overrides.sql"
            download="DOWNLOAD_export_overrides.sql"
          >
            <Download size={14} /> Baixar SQL (backup Download/SPEC)
          </a>
          <span className="export-spec-msg" style={{ margin: 0 }}>
            Supabase → SQL Editor · colar · Run
          </span>
        </div>
      ) : null}

      {/* Escopo comum a todas as notas */}
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
            <span><b>{equipesEdit.length}</b> eq</span>
            <span><b>{jogadoresEdit.length}</b> jog</span>
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

      {/* Notas / subabas */}
      <nav className="export-notes" aria-label="Etapas Download SPEC">
        {EXPORT_NOTES.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`export-note ${note === n.id ? 'active' : ''}`}
            onClick={() => setNote(n.id)}
            disabled={Boolean(busy)}
          >
            <span className="export-note-step">{n.step}</span>
            <span className="export-note-body">
              <strong>{n.short}</strong>
              <small>{n.label}</small>
            </span>
          </button>
        ))}
      </nav>

      {/* ——— 1. ARQUIVOS EQUIPES ——— */}
      {note === 'equipes' ? (
        <section className="export-section export-section-compact">
          <div className="section-head">
            <h4>
              <Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Arquivos equipes
            </h4>
            <small>edite nome/tag · baixe CSV · salve no campeonato</small>
          </div>
          <div className="export-table-wrap">
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Nome da equipe</th>
                  <th>Tag</th>
                </tr>
              </thead>
              <tbody>
                {equipesEdit.map((eq) => (
                  <tr key={eq.id}>
                    <td>
                      <input
                        className="export-cell-input"
                        value={eq.nome}
                        onChange={(e) => patchEquipe(eq.id, 'nome', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="export-cell-input export-cell-input-sm"
                        value={eq.tag}
                        onChange={(e) => patchEquipe(eq.id, 'tag', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
                {!equipesEdit.length ? (
                  <tr><td colSpan={2}>Nenhuma equipe no escopo.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="export-actions-row export-actions-wrap" style={{ marginTop: 8 }}>
            <button
              className="button secondary small"
              type="button"
              disabled={!canDownload || Boolean(busy) || !equipesEdit.length}
              onClick={baixarCsvEquipes}
            >
              <Download size={14} /> CSV equipes
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={!canDownload || Boolean(busy)}
              onClick={() => void baixarPacote('tabelas')}
            >
              {busy === 'tabelas' ? <Loader2 size={14} className="spin" /> : <Table2 size={14} />}
              ZIP tabelas
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={!canDownload || Boolean(busy)}
              onClick={() => void salvarEdicoesTextoNoCampeonato()}
            >
              {busy === 'backup-texto' ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              Salvar edições no campeonato
            </button>
          </div>
          {progress ? (
            <p className="export-progress">
              <Loader2 size={13} className="spin" /> {progress}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ——— 2. ARQUIVOS JOGADORES ——— */}
      {note === 'jogadores' ? (
        <>
          <section className="export-section export-section-compact">
            <div className="section-head">
              <h4>
                <UserRound size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Arquivos jogadores
              </h4>
              <small>edite e baixe CSV · não altera perfil global</small>
            </div>
            <div className="export-table-wrap">
              <table className="export-table export-table-edit">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Nick</th>
                    <th>Id de jogo</th>
                    <th>Função</th>
                    <th>Localidade (cidade)</th>
                  </tr>
                </thead>
                <tbody>
                  {jogadoresEdit.map((j) => (
                    <tr key={j.key}>
                      <td>
                        <input
                          className="export-cell-input export-cell-input-sm"
                          value={j.tag_equipe}
                          onChange={(e) => patchJogador(j.key, 'tag_equipe', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="export-cell-input"
                          value={j.nick}
                          onChange={(e) => patchJogador(j.key, 'nick', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="export-cell-input export-cell-input-md"
                          value={j.id_jogo}
                          onChange={(e) => patchJogador(j.key, 'id_jogo', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="export-cell-input export-cell-input-sm"
                          value={j.funcao}
                          onChange={(e) => patchJogador(j.key, 'funcao', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="export-cell-input"
                          value={j.localidade}
                          onChange={(e) => patchJogador(j.key, 'localidade', e.target.value)}
                          placeholder="Cidade"
                        />
                      </td>
                    </tr>
                  ))}
                  {!jogadoresEdit.length ? (
                    <tr><td colSpan={5}>Nenhum jogador no escopo.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="export-actions-row export-actions-wrap" style={{ marginTop: 8 }}>
              <button
                className="button secondary small"
                type="button"
                disabled={!canDownload || Boolean(busy) || !jogadoresEdit.length}
                onClick={baixarCsvJogadores}
              >
                <Download size={14} /> CSV jogadores
              </button>
              <button
                className="button secondary small"
                type="button"
                disabled={!canDownload || Boolean(busy)}
                onClick={() => void salvarEdicoesTextoNoCampeonato()}
              >
                {busy === 'backup-texto' ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                Salvar edições no campeonato
              </button>
            </div>
          </section>

          <section className="export-section export-section-compact">
            <div className="section-head">
              <h4>PlayerNameOverwrite.json</h4>
              <small>SPEC Free Fire · telamento</small>
            </div>

            <div className="export-toolbar" style={{ marginBottom: 8 }}>
              <label className="export-inline-field">
                <span>No arquivo, campo da função usa</span>
                <select
                  value={nationSource}
                  onChange={(e) => setNationSource(e.target.value as FfNationSource)}
                >
                  <option value="funcao">Função (SNIPER / RUSHER / …)</option>
                  <option value="localidade">Localidade (só cidade)</option>
                </select>
              </label>
            </div>

            <div className="export-color-row">
              <label className="export-color-field">
                <span>{nationSource === 'localidade' ? 'Cor cidade' : 'Cor função'}</span>
                <input type="color" value={roleColor} onChange={(e) => setRoleColor(e.target.value)} />
              </label>
              <label className="export-color-field">
                <span>Cor equipe</span>
                <input type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} />
              </label>
              <label className="export-color-field">
                <span>Nome jogador</span>
                <input
                  type="color"
                  value={textColors.TeamPlayer1}
                  onChange={(e) => {
                    const v = e.target.value
                    setTextColors((p) => ({
                      ...p,
                      TeamPlayer1: v,
                      TeamPlayer2: v,
                      TeamPlayer3: v,
                      TeamPlayer4: v,
                    }))
                  }}
                />
              </label>
              <label className="export-color-field">
                <span>Número</span>
                <input
                  type="color"
                  value={textColors.TeamPlayer1Num}
                  onChange={(e) => {
                    const v = e.target.value
                    setTextColors((p) => ({
                      ...p,
                      TeamPlayer1Num: v,
                      TeamPlayer2Num: v,
                      TeamPlayer3Num: v,
                      TeamPlayer4Num: v,
                    }))
                  }}
                />
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

            <div className="export-actions-row export-actions-wrap">
              <button
                className="button"
                type="button"
                disabled={!canDownload || Boolean(busy)}
                onClick={gerarPlayerNameOverwrite}
              >
                {busy === 'spec' ? <Loader2 size={15} className="spin" /> : <FileJson size={15} />}
                Baixar PlayerNameOverwrite.json
              </button>
              <button
                className="button secondary small"
                type="button"
                disabled={!canDownload || Boolean(busy)}
                onClick={() => void baixarPacote('completo')}
              >
                {busy === 'completo' ? <Loader2 size={14} className="spin" /> : <FolderArchive size={14} />}
                ZIP completo
              </button>
              {specMsg ? <span className="export-spec-msg">{specMsg}</span> : null}
            </div>
          </section>
        </>
      ) : null}

      {/* ——— 3. LOGOS EQUIPES ——— */}
      {note === 'logos' && editedPayload ? (
        <SpecMediaPanel
          campeonatoId={campeonatoId}
          data={editedPayload}
          focus="logos"
          disabled={!canDownload || Boolean(busy)}
          initialBackup={overrides}
          onBackupSaved={() => void loadBase()}
        />
      ) : null}

      {/* ——— 4. FOTOS JOGADORES ——— */}
      {note === 'fotos' && editedPayload ? (
        <>
          <SpecMediaPanel
            campeonatoId={campeonatoId}
            data={editedPayload}
            focus="fotos"
            disabled={!canDownload || Boolean(busy)}
            initialBackup={overrides}
            onBackupSaved={() => void loadBase()}
          />
          <section className="export-section export-section-compact">
            <div className="section-head">
              <h4>Pacotes extras</h4>
              <small>opcional · mídias brutas do cadastro</small>
            </div>
            <div className="export-actions-row export-actions-wrap">
              <button
                className="button secondary small"
                type="button"
                disabled={!canDownload || Boolean(busy) || !data.resumo.total_midias}
                onClick={() => void baixarPacote('midias')}
              >
                {busy === 'midias' ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
                ZIP mídias originais
              </button>
              <button
                className="button secondary small"
                type="button"
                disabled={!canDownload || Boolean(busy)}
                onClick={() => void baixarPacote('completo')}
              >
                {busy === 'completo' ? <Loader2 size={14} className="spin" /> : <FolderArchive size={14} />}
                ZIP completo
              </button>
            </div>
            {progress ? (
              <p className="export-progress">
                <Loader2 size={13} className="spin" /> {progress}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      {/* Navegação entre notas */}
      <div className="export-note-nav">
        {prevNote ? (
          <button
            type="button"
            className="button secondary small"
            disabled={Boolean(busy)}
            onClick={() => setNote(prevNote.id)}
          >
            <ChevronLeft size={14} />
            {prevNote.step}. {prevNote.short}
          </button>
        ) : (
          <span />
        )}
        <span className="export-note-nav-pos">
          {noteIndex + 1} / {EXPORT_NOTES.length}
        </span>
        {nextNote ? (
          <button
            type="button"
            className="button small"
            disabled={Boolean(busy)}
            onClick={() => setNote(nextNote.id)}
          >
            {nextNote.step}. {nextNote.short}
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="export-spec-msg" style={{ margin: 0 }}>Fluxo completo</span>
        )}
      </div>
    </div>
  )
}
