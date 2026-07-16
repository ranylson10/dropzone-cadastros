'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download,
  FileJson,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Table2,
  Users,
} from 'lucide-react'
import { campeonatoExportService } from '../services/campeonato-export.service'
import type { CampeonatoExportPayload, ExportMidia } from '../types/campeonato-export.types'

function slugify(value: string) {
  return String(value || 'campeonato')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'campeonato'
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}`
}

const MIDIA_LABEL: Record<ExportMidia['tipo'], string> = {
  campeonato_logo: 'Logo campeonato',
  equipe_logo: 'Logo equipe',
  line_logo: 'Logo line',
  jogador_foto: 'Foto jogador',
}

export function CampeonatoExportTab({ campeonatoId }: { campeonatoId: string }) {
  const [data, setData] = useState<CampeonatoExportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const reload = useCallback(async () => {
    if (!campeonatoId) return
    setLoading(true)
    setError('')
    try {
      setData(await campeonatoExportService.carregar(campeonatoId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar exportação.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [campeonatoId])

  useEffect(() => {
    void reload()
  }, [reload])

  const baseName = useMemo(
    () => slugify(data?.campeonato?.nome || campeonatoId),
    [data?.campeonato?.nome, campeonatoId],
  )

  const equipesCsvRows = useMemo(() => {
    if (!data) return []
    const rows: Array<Record<string, unknown>> = []
    for (const eq of data.equipes || []) {
      for (const line of eq.lines || []) {
        rows.push({
          equipe_id: eq.id,
          equipe_nome: eq.nome,
          equipe_tag: eq.tag || '',
          equipe_logo_url: eq.logo_url || '',
          line_id: line.id || '',
          line_nome: line.nome,
          line_tag: line.tag || '',
          line_logo_url: line.logo_url || '',
          nome_exibicao: line.nome_exibicao || '',
          slot_numero: line.slot?.numero ?? '',
          slot_letra: line.slot?.letra || '',
          grupo_nome: line.grupo?.nome || '',
          qtd_jogadores: line.quantidade_jogadores,
        })
      }
    }
    return rows
  }, [data])

  const jogadoresCsvRows = useMemo(() => {
    if (!data) return []
    const rows: Array<Record<string, unknown>> = []
    for (const eq of data.equipes || []) {
      for (const line of eq.lines || []) {
        for (const jog of line.jogadores || []) {
          rows.push({
            equipe_nome: eq.nome,
            line_nome: line.nome,
            nick: jog.nick || '',
            id_jogo: jog.id_jogo || '',
            funcao: jog.funcao || '',
            localidade: jog.localidade || '',
            status: jog.status || '',
            foto_url: jog.foto_url || '',
            slot_numero: line.slot?.numero ?? '',
          })
        }
      }
    }
    return rows
  }, [data])

  async function baixarJson() {
    if (!data) return
    setBusy('json')
    try {
      downloadText(
        `dropzone-export-${baseName}.json`,
        JSON.stringify(data, null, 2),
        'application/json;charset=utf-8',
      )
    } finally {
      setBusy('')
    }
  }

  function baixarCsvEquipes() {
    if (!equipesCsvRows.length) return
    setBusy('csv-equipes')
    try {
      downloadText(
        `dropzone-equipes-${baseName}.csv`,
        toCsv(equipesCsvRows),
        'text/csv;charset=utf-8',
      )
    } finally {
      setBusy('')
    }
  }

  function baixarCsvJogadores() {
    if (!jogadoresCsvRows.length) return
    setBusy('csv-jogadores')
    try {
      downloadText(
        `dropzone-jogadores-${baseName}.csv`,
        toCsv(jogadoresCsvRows),
        'text/csv;charset=utf-8',
      )
    } finally {
      setBusy('')
    }
  }

  function baixarListaMidias() {
    if (!data?.midias?.length) return
    setBusy('midias')
    try {
      const rows = data.midias.map((item) => ({
        tipo: item.tipo,
        ref_id: item.ref_id,
        nome: item.nome,
        url: item.url,
      }))
      downloadText(
        `dropzone-midias-${baseName}.csv`,
        toCsv(rows),
        'text/csv;charset=utf-8',
      )
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return (
      <div className="export-tab-state">
        <Loader2 className="spin" size={18} /> Carregando dados do campeonato...
      </div>
    )
  }

  if (error) {
    return (
      <div className="export-tab-panel">
        <div className="message error">{error}</div>
        <button className="button secondary" type="button" onClick={() => void reload()}>
          <RefreshCw size={15} /> Tentar de novo
        </button>
      </div>
    )
  }

  if (!data) {
    return <p className="empty">Nenhum dado para exportar.</p>
  }

  return (
    <div className="export-tab-panel">
      <header className="export-tab-head">
        <div>
          <p className="eyebrow">Produção / SPEC</p>
          <h3>Exportar dados do campeonato</h3>
          <p className="empty" style={{ margin: '6px 0 0' }}>
            Pacote v{data.export_version} para overlays, SPEC do jogo e pós-produção.
            Depois evoluímos para ZIP com logos e fotos embutidas.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => void reload()}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </header>

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
          <span>Mídias</span>
        </div>
      </div>

      <section className="export-actions-grid">
        <button className="button" type="button" disabled={Boolean(busy)} onClick={() => void baixarJson()}>
          {busy === 'json' ? <Loader2 size={16} className="spin" /> : <FileJson size={16} />}
          Baixar JSON completo
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy) || !equipesCsvRows.length}
          onClick={baixarCsvEquipes}
        >
          {busy === 'csv-equipes' ? <Loader2 size={16} className="spin" /> : <Table2 size={16} />}
          CSV equipes / lines
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy) || !jogadoresCsvRows.length}
          onClick={baixarCsvJogadores}
        >
          {busy === 'csv-jogadores' ? <Loader2 size={16} className="spin" /> : <Users size={16} />}
          CSV jogadores
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy) || !data.midias.length}
          onClick={baixarListaMidias}
        >
          {busy === 'midias' ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
          CSV lista de mídias
        </button>
      </section>

      <section className="export-section">
        <div className="section-head">
          <h4>Conteúdo do pacote</h4>
        </div>
        <ul className="export-checklist">
          <li>Campeonato: nome, logo, status, cores de tema</li>
          <li>Equipes: nome, tag, logo</li>
          <li>Lines: nome, logo, slot, grupo</li>
          <li>Jogadores: nick, id do jogo, função, foto, localidade</li>
          <li>Lista de URLs de mídias (logos e fotos)</li>
        </ul>
      </section>

      <section className="export-section">
        <div className="section-head">
          <h4>Prévia — equipes e lines</h4>
          <small>{data.equipes.length} equipes</small>
        </div>
        <div className="export-preview-list">
          {data.equipes.slice(0, 12).map((eq) => (
            <article key={eq.id} className="export-preview-card">
              <div className="export-preview-identity">
                {eq.logo_url ? (
                  <img src={eq.logo_url} alt="" />
                ) : (
                  <span className="export-preview-fallback">{eq.nome.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{eq.nome}</strong>
                  <small>
                    {eq.tag ? `${eq.tag} · ` : ''}
                    {eq.lines.length} line{eq.lines.length === 1 ? '' : 's'}
                  </small>
                </div>
              </div>
              <div className="export-preview-lines">
                {eq.lines.slice(0, 4).map((line) => (
                  <span key={line.participacao_id}>
                    {line.nome}
                    {line.slot?.numero ? ` · slot ${line.slot.numero}` : ''}
                    {` · ${line.quantidade_jogadores} jog.`}
                  </span>
                ))}
                {eq.lines.length > 4 ? <span>+{eq.lines.length - 4} lines</span> : null}
              </div>
            </article>
          ))}
          {!data.equipes.length ? <p className="empty">Nenhuma equipe ativa no campeonato.</p> : null}
          {data.equipes.length > 12 ? (
            <p className="empty">Mostrando 12 de {data.equipes.length}. O download traz tudo.</p>
          ) : null}
        </div>
      </section>

      <section className="export-section">
        <div className="section-head">
          <h4>Mídias encontradas</h4>
          <small>{data.midias.length} URLs</small>
        </div>
        <div className="export-midia-list">
          {data.midias.slice(0, 24).map((item) => (
            <a
              key={`${item.tipo}-${item.ref_id}-${item.url}`}
              className="export-midia-item"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              <img src={item.url} alt="" />
              <span>
                <strong>{item.nome}</strong>
                <small>{MIDIA_LABEL[item.tipo]}</small>
              </span>
              <Download size={14} />
            </a>
          ))}
          {!data.midias.length ? <p className="empty">Nenhuma logo ou foto cadastrada ainda.</p> : null}
          {data.midias.length > 24 ? (
            <p className="empty">Prévia de 24 itens. Use o CSV de mídias para a lista completa.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
