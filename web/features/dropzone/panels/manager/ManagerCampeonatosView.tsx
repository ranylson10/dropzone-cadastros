'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ExternalLink,
  FolderOpen,
  Loader2,
  Plus,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { CampeonatoEquipesTab } from '@/features/campeonatos/equipes'
import { CampeonatoJogadoresTab } from '@/features/campeonatos/jogadores'
import { CampeonatoEstatisticasTab } from '@/features/campeonatos/estatisticas'
import { CampeonatoEstruturaTab } from '@/features/campeonatos/fases'
import type { ManagerChampTab } from './manager-modes'

type SellerItem = {
  id: string
  campeonato_id: string
  status: string
  limite_vagas?: number
  vagas_usadas?: number
  vagas_restantes?: number | null
  anunciando?: boolean
  permissoes?: Record<string, boolean>
  campeonatos?: { id?: string; nome?: string; logo_url?: string | null; status?: string } | null
  produtoras?: { nome?: string; logo_url?: string | null } | null
}

type EstruturaPayload = {
  campeonato: { id: string; nome: string; logo_url?: string | null }
  fases: Array<{ id: string; nome: string; ordem?: number }>
  grupos: Array<{
    id: string
    nome: string
    fase_id: string
    slots_total?: number
    slots_ocupados?: number
    slots_livres?: number
    whatsapp_url?: string | null
  }>
  jogos: Array<{
    id: string
    nome: string
    fase_id?: string | null
    data_jogo?: string | null
    horario?: string | null
    numero_partidas?: number | null
    mapas?: string[]
    grupos_ids?: string[]
    status?: string | null
  }>
  resumo?: {
    fases: number
    grupos: number
    slots_total: number
    slots_ocupados: number
    jogos: number
  }
  permission?: {
    canManage?: boolean
    canOrganizeGroups?: boolean
    canScore?: boolean
    role?: string
  }
}

function permOn(perms: Record<string, boolean> | undefined, key: string, fallback = false) {
  if (!perms || perms[key] === undefined) return fallback
  return Boolean(perms[key])
}

function formatDate(value?: string | null) {
  if (!value) return 'Data a definir'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  if (!year || !month || !day) return String(value)
  return `${day}/${month}/${year}`
}

function formatUsage(item: SellerItem) {
  const used = Number(item.vagas_usadas || 0)
  const limit = Number(item.limite_vagas || 0)
  if (limit > 0) return `${used}/${limit} vaga(s)`
  return used > 0 ? `${used} preenchida(s)` : 'Sem limite'
}

function toDropZoneRows(
  rows: Array<Record<string, any>>,
  entityType: string,
  mapData?: (row: Record<string, any>) => Record<string, unknown>,
): DropZoneRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    entity_type: entityType as DropZoneRow['entity_type'],
    name: String(row.nome || row.name || ''),
    username: null,
    public_id: null,
    profile_type: null,
    status: String(row.status || 'ativo'),
    parent_id: row.fase_id || row.campeonato_id || null,
    ref_id: null,
    created_by: null,
    auth_user_id: null,
    token: null,
    data: mapData ? mapData(row) : { ...row },
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }))
}

export function ManagerCampeonatosView(props: {
  managerId: string
  sellerItems: SellerItem[]
  sellerLoading: boolean
  sellerError: string
  selectedChampId: string
  setSelectedChampId: (id: string) => void
  tab: ManagerChampTab
  setTab: (tab: ManagerChampTab) => void
  onRefreshUsage?: () => void
}) {
  const ativos = props.sellerItems.filter((item) => item.status === 'ativo')
  const selected = ativos.find((item) => item.campeonato_id === props.selectedChampId) || null
  const perms = selected?.permissoes || {}
  const canScore = permOn(perms, 'pontuar_tabela', false)
  const canOrganize = permOn(perms, 'organizar_grupos', false)
  const canViewStructure = permOn(perms, 'ver_estrutura', true) || canOrganize || canScore

  const [estrutura, setEstrutura] = useState<EstruturaPayload | null>(null)
  const [estruturaLoading, setEstruturaLoading] = useState(false)
  const [estruturaError, setEstruturaError] = useState('')
  const [maps, setMaps] = useState<Array<{ codigo: string; nome: string }>>([])

  const [showAdd, setShowAdd] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState<any[]>([])
  const [addSelected, setAddSelected] = useState<any | null>(null)
  const [addMessage, setAddMessage] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')
  const [addOk, setAddOk] = useState('')

  async function authHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada.')
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async function searchChampionships() {
    setAddError('')
    setAddOk('')
    setAddBusy(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/campeonatos/busca?q=${encodeURIComponent(addQuery)}`, {
        headers,
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro na busca.')
      setAddResults(Array.isArray(json.items) ? json.items : [])
      if (!(json.items || []).length) setAddError('Nenhum campeonato encontrado.')
    } catch (err: any) {
      setAddError(err?.message || 'Erro na busca.')
      setAddResults([])
    } finally {
      setAddBusy(false)
    }
  }

  async function sendPedido() {
    if (!addSelected?.id) {
      setAddError('Selecione um campeonato.')
      return
    }
    setAddBusy(true)
    setAddError('')
    setAddOk('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/managers/${encodeURIComponent(props.managerId)}/campeonatos/pedidos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          campeonato_id: addSelected.id,
          mensagem: addMessage,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar pedido.')
      setAddOk(json.mensagem || 'Pedido enviado ao admin.')
      setAddQuery('')
      setAddResults([])
      setAddSelected(null)
      setAddMessage('')
    } catch (err: any) {
      setAddError(err?.message || 'Erro ao enviar pedido.')
    } finally {
      setAddBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    fetch('/api/mapas')
      .then(async (response) => {
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar mapas')
        if (active) {
          setMaps(
            (Array.isArray(json.mapas) ? json.mapas : []).map((item: any) => ({
              codigo: String(item.codigo || item.nome || ''),
              nome: String(item.nome || item.codigo || ''),
            })),
          )
        }
      })
      .catch(() => {
        if (active) setMaps([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!props.selectedChampId || !selected) {
      setEstrutura(null)
      setEstruturaError('')
      return
    }
    if (!canViewStructure && props.tab !== 'equipes' && props.tab !== 'jogadores' && props.tab !== 'estatisticas') {
      return
    }

    let cancelled = false
    async function load() {
      setEstruturaLoading(true)
      setEstruturaError('')
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error('Sessão expirada. Entre novamente.')
        const response = await fetch(`/api/campeonatos/${encodeURIComponent(props.selectedChampId)}/estrutura`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || 'Não foi possível carregar a estrutura.')
        if (!cancelled) setEstrutura(json as EstruturaPayload)
      } catch (error) {
        if (!cancelled) {
          setEstrutura(null)
          setEstruturaError(error instanceof Error ? error.message : 'Erro ao carregar estrutura.')
        }
      } finally {
        if (!cancelled) setEstruturaLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [props.selectedChampId, selected?.id, canViewStructure, props.tab])

  const phaseRows = useMemo(
    () => toDropZoneRows(estrutura?.fases || [], 'phase', (row) => ({ ordem: row.ordem })),
    [estrutura?.fases],
  )
  const groupRows = useMemo(
    () =>
      toDropZoneRows(estrutura?.grupos || [], 'group', (row) => ({
        fase_id: row.fase_id,
        slots: row.slots_total,
        whatsapp_url: row.whatsapp_url,
      })),
    [estrutura?.grupos],
  )
  const gameRows = useMemo(
    () =>
      toDropZoneRows(estrutura?.jogos || [], 'game', (row) => ({
        fase_id: row.fase_id,
        data_jogo: row.data_jogo,
        horario: row.horario,
        numero_partidas: row.numero_partidas,
        mapas: row.mapas,
        grupos_ids: row.grupos_ids,
      })),
    [estrutura?.jogos],
  )

  const fasesById = useMemo(() => new Map((estrutura?.fases || []).map((fase) => [fase.id, fase])), [estrutura?.fases])

  // Auto-seleciona o primeiro campeonato ativo se nada estiver selecionado
  useEffect(() => {
    if (props.sellerLoading) return
    if (!ativos.length) {
      if (props.selectedChampId) props.setSelectedChampId('')
      return
    }
    const stillValid = ativos.some((item) => item.campeonato_id === props.selectedChampId)
    if (!stillValid) {
      props.setSelectedChampId(ativos[0].campeonato_id)
      props.setTab('equipes')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sellerLoading, ativos.map((a) => a.campeonato_id).join('|'), props.selectedChampId])

  const champ = selected?.campeonatos || {}
  const producer = selected?.produtoras || {}
  const limite = Number(selected?.limite_vagas || 0)
  const used = Number(selected?.vagas_usadas || 0)
  const resumo = estrutura?.resumo

  return (
    <div className="producer-layout-ref span-3 manager-champ-layout">
      <aside className="championship-nav-card panel">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Manager</p>
            <h2>Campeonatos</h2>
          </div>
          <Trophy />
        </div>

        <div className="championship-list ref-list">
          {props.sellerLoading ? <p className="empty">Carregando...</p> : null}
          {props.sellerError ? <div className="message error">{props.sellerError}</div> : null}
          {!props.sellerLoading && ativos.length === 0 ? (
            <p className="empty">
              Nenhum campeonato ativo. Quando a produtora te liberar em um evento, ele aparece aqui.
            </p>
          ) : null}

          {ativos.map((item) => {
            const c = item.campeonatos || {}
            const p = item.produtoras || {}
            const isActive = selected?.campeonato_id === item.campeonato_id
            return (
              <button
                key={item.id}
                type="button"
                className={`champ-list-item ref-champ-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  props.setSelectedChampId(item.campeonato_id)
                  props.setTab('equipes')
                }}
              >
                <span className="champ-thumb">
                  {c.logo_url ? <img src={c.logo_url} alt="" /> : <Trophy size={18} />}
                </span>
                <span>
                  <strong>{c.nome || 'Campeonato'}</strong>
                  <small>
                    {p.nome || 'Evento liberado'} · {formatUsage(item)}
                    {item.anunciando ? ' · portfólio' : ''}
                  </small>
                </span>
              </button>
            )
          })}
        </div>

        <div className="manager-list-actions">
          <button type="button" className="button full" onClick={() => { setShowAdd(true); setAddError(''); setAddOk('') }}>
            <Plus size={15} /> Adicionar campeonato
          </button>
          <button type="button" className="button secondary full" onClick={() => props.onRefreshUsage?.()}>
            Atualizar lista
          </button>
        </div>
      </aside>

      {showAdd ? (
        <div className="manager-add-champ-overlay" role="dialog" aria-modal="true">
          <div className="manager-add-champ-modal panel">
            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">Pedido de acesso</p>
                <h2>Adicionar campeonato</h2>
              </div>
              <button type="button" className="button secondary small" onClick={() => setShowAdd(false)} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
            {addError ? <div className="message error">{addError}</div> : null}
            {addOk ? <div className="message success">{addOk}</div> : null}
            <label className="field">
              <span>Buscar campeonato</span>
              <div className="staff-search-row">
                <input
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Nome do campeonato"
                  onKeyDown={(e) => { if (e.key === 'Enter') void searchChampionships() }}
                />
                <button type="button" className="button secondary" disabled={addBusy} onClick={() => void searchChampionships()}>
                  Buscar
                </button>
              </div>
            </label>
            {addResults.length > 0 ? (
              <div className="championship-list ref-list" style={{ maxHeight: 240, overflow: 'auto' }}>
                {addResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`champ-list-item ref-champ-item ${addSelected?.id === c.id ? 'active' : ''}`}
                    onClick={() => setAddSelected(c)}
                  >
                    <span className="champ-thumb">
                      {c.logo_url ? <img src={c.logo_url} alt="" /> : <Trophy size={18} />}
                    </span>
                    <span>
                      <strong>{c.nome}</strong>
                      <small>{c.produtora?.nome || 'Campeonato'}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <label className="field" style={{ marginTop: 10 }}>
              <span>Mensagem (opcional)</span>
              <input
                value={addMessage}
                onChange={(e) => setAddMessage(e.target.value)}
                placeholder="Ex.: Posso ajudar a preencher vagas deste evento."
              />
            </label>
            <div className="manager-detail-actions" style={{ marginTop: 12 }}>
              <button type="button" className="button" disabled={addBusy || !addSelected} onClick={() => void sendPedido()}>
                {addBusy ? 'Enviando...' : 'Enviar pedido'}
              </button>
              <button type="button" className="button secondary" onClick={() => setShowAdd(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="championship-detail-card panel manager-detail-panel manager-champ-panel">
        {!selected ? (
          <div className="manager-detail-empty">
            <Trophy size={28} />
            <div>
              <strong>Selecione um campeonato</strong>
              <p>
                O manager não administra a produtora — só opera os campeonatos liberados para venda e preenchimento de
                vagas. Escolha um evento à esquerda.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">Operação · {producer.nome || 'Produtora'}</p>
                <h2>{champ.nome || 'Campeonato'}</h2>
                <p className="empty" style={{ marginTop: 6 }}>
                  {limite > 0 ? `Seu uso: ${used}/${limite} vaga(s)` : `Você preencheu ${used} vaga(s)`}
                </p>
              </div>
              {champ.logo_url ? (
                <img className="manager-champ-logo" src={champ.logo_url} alt="" />
              ) : (
                <Trophy />
              )}
            </div>

            {resumo ? (
              <div className="player-summary-grid manager-champ-summary">
                <div>
                  <FolderOpen size={18} />
                  <strong>{resumo.fases}</strong>
                  <span>Fases</span>
                </div>
                <div>
                  <Users size={18} />
                  <strong>
                    {resumo.slots_ocupados}/{resumo.slots_total || 0}
                  </strong>
                  <span>Slots ocupados</span>
                </div>
                <div>
                  <CalendarDays size={18} />
                  <strong>{resumo.jogos}</strong>
                  <span>Jogos</span>
                </div>
                <div>
                  <Shield size={18} />
                  <strong>
                    {used}
                    {limite > 0 ? `/${limite}` : ''}
                  </strong>
                  <span>Suas vagas</span>
                </div>
              </div>
            ) : null}

            <div className="producer-tabs manager-champ-tabs">
              <button
                type="button"
                className={props.tab === 'equipes' ? 'active' : ''}
                onClick={() => props.setTab('equipes')}
              >
                Equipes / vagas
              </button>
              <button
                type="button"
                className={props.tab === 'jogadores' ? 'active' : ''}
                onClick={() => props.setTab('jogadores')}
              >
                Jogadores
              </button>
              {canViewStructure ? (
                <button
                  type="button"
                  className={props.tab === 'grupos' ? 'active' : ''}
                  onClick={() => props.setTab('grupos')}
                >
                  Fases e grupos
                </button>
              ) : null}
              {canViewStructure ? (
                <button
                  type="button"
                  className={props.tab === 'jogos' ? 'active' : ''}
                  onClick={() => props.setTab('jogos')}
                >
                  Jogos
                </button>
              ) : null}
              <button
                type="button"
                className={props.tab === 'estatisticas' ? 'active' : ''}
                onClick={() => props.setTab('estatisticas')}
              >
                Estatísticas
              </button>
            </div>

            <div className="manager-champ-body">
              {props.tab === 'equipes' ? (
                <CampeonatoEquipesTab campeonatoId={selected.campeonato_id} />
              ) : null}
              {props.tab === 'jogadores' ? <CampeonatoJogadoresTab campeonatoId={selected.campeonato_id} /> : null}

              {props.tab === 'grupos' ? (
                <CampeonatoEstruturaTab campeonatoId={selected.campeonato_id} />
              ) : null}

              {props.tab === 'jogos' ? (
                <div className="manager-structure-view">
                  {estruturaLoading ? (
                    <p className="empty">
                      <Loader2 className="spin" size={16} /> Carregando jogos...
                    </p>
                  ) : null}
                  {estruturaError ? <div className="message error">{estruturaError}</div> : null}
                  {!estruturaLoading && !(estrutura?.jogos || []).length ? (
                    <p className="empty">Nenhum jogo cadastrado ainda.</p>
                  ) : null}

                  <div className="championship-vagas-list">
                    {(estrutura?.jogos || []).map((jogo, index) => {
                      const fase = jogo.fase_id ? fasesById.get(jogo.fase_id) : null
                      return (
                        <article key={jogo.id} className="championship-vaga-row status-ocupada">
                          <div className="vaga-row-summary" style={{ cursor: 'default' }}>
                            <span className="vaga-row-number">{String(index + 1).padStart(2, '0')}</span>
                            <span className="vaga-row-avatar status-ocupada" aria-hidden>
                              <CalendarDays size={16} />
                            </span>
                            <span className="vaga-row-identity">
                              <strong>{jogo.nome || 'Jogo'}</strong>
                              <small>
                                {fase?.nome || 'Sem fase'} · {formatDate(jogo.data_jogo)}
                                {jogo.horario ? ` · ${String(jogo.horario).slice(0, 5)}` : ''}
                                {(jogo.mapas || []).length
                                  ? ` · ${(jogo.mapas || []).slice(0, 3).join(', ')}`
                                  : ''}
                              </small>
                            </span>
                            <span className="vaga-row-meta">
                              {canScore ? (
                                <a
                                  className="button small"
                                  href={`/campeonatos/${selected.campeonato_id}/pontuador/${jogo.id}`}
                                >
                                  Pontuar
                                </a>
                              ) : null}
                            </span>
                            <span className="vaga-row-chevron" aria-hidden>
                              <a
                                className="button small secondary"
                                href={`/campeonatos/${selected.campeonato_id}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Ver público"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {props.tab === 'estatisticas' ? (
                <CampeonatoEstatisticasTab
                  campeonatoId={selected.campeonato_id}
                  phases={phaseRows}
                  groups={groupRows}
                  games={gameRows}
                  maps={maps}
                />
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
