'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FolderOpen,
  Loader2,
  Shield,
  Trophy,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { CampeonatoEquipesTab } from '@/features/campeonatos/equipes'
import { CampeonatoJogadoresTab } from '@/features/campeonatos/jogadores'
import { CampeonatoEstatisticasTab } from '@/features/campeonatos/estatisticas'
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

function permissionLabels(perms: Record<string, boolean> | undefined) {
  const labels: string[] = []
  if (permOn(perms, 'adicionar_equipes', true)) labels.push('Adicionar equipes')
  if (permOn(perms, 'gerar_convites_equipe', true)) labels.push('Convites de vaga')
  if (permOn(perms, 'ver_estrutura', true)) labels.push('Ver estrutura')
  if (permOn(perms, 'organizar_grupos', false)) labels.push('Organizar grupos')
  if (permOn(perms, 'pontuar_tabela', false)) labels.push('Pontuar tabela')
  return labels
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
  const labels = permissionLabels(perms)
  const canScore = permOn(perms, 'pontuar_tabela', false)
  const canOrganize = permOn(perms, 'organizar_grupos', false)
  const canViewStructure = permOn(perms, 'ver_estrutura', true) || canOrganize || canScore

  const [estrutura, setEstrutura] = useState<EstruturaPayload | null>(null)
  const [estruturaLoading, setEstruturaLoading] = useState(false)
  const [estruturaError, setEstruturaError] = useState('')
  const [maps, setMaps] = useState<Array<{ codigo: string; nome: string }>>([])

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
    if (!canViewStructure && props.tab !== 'equipes' && props.tab !== 'jogadores' && props.tab !== 'info') {
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

  if (props.selectedChampId && selected) {
    const champ = selected.campeonatos || {}
    const producer = selected.produtoras || {}
    const limite = Number(selected.limite_vagas || 0)
    const used = Number(selected.vagas_usadas || 0)
    const resumo = estrutura?.resumo

    return (
      <section className="panel span-3 manager-champ-panel">
        <div className="section-head">
          <div>
            <button
              type="button"
              className="button small secondary manager-back-btn"
              onClick={() => {
                props.setSelectedChampId('')
                props.setTab('equipes')
                props.onRefreshUsage?.()
              }}
            >
              <ArrowLeft size={14} /> Campeonatos
            </button>
            <p className="eyebrow" style={{ marginTop: 10 }}>
              Painel de operação · {producer.nome || 'Produtora'}
            </p>
            <h2>{champ.nome || 'Campeonato'}</h2>
            <p className="empty" style={{ marginTop: 6 }}>
              {limite > 0 ? `Seu uso: ${used}/${limite} vaga(s)` : `Você preencheu ${used} vaga(s)`}
              {canOrganize ? ' · grupos liberados' : ''}
              {canScore ? ' · pontuação liberada' : ''}
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

        <div className="manager-perm-chips">
          {labels.map((label) => (
            <span key={label} className="manager-perm-chip">
              <Shield size={12} /> {label}
            </span>
          ))}
          {!labels.length ? <span className="manager-perm-chip muted">Sem permissões extras</span> : null}
        </div>

        <div className="producer-tabs manager-champ-tabs">
          <button type="button" className={props.tab === 'equipes' ? 'active' : ''} onClick={() => props.setTab('equipes')}>
            Equipes / vagas
          </button>
          <button type="button" className={props.tab === 'jogadores' ? 'active' : ''} onClick={() => props.setTab('jogadores')}>
            Jogadores
          </button>
          {canViewStructure ? (
            <button type="button" className={props.tab === 'grupos' ? 'active' : ''} onClick={() => props.setTab('grupos')}>
              Fases e grupos
            </button>
          ) : null}
          {canViewStructure ? (
            <button type="button" className={props.tab === 'jogos' ? 'active' : ''} onClick={() => props.setTab('jogos')}>
              Jogos
            </button>
          ) : null}
          <button type="button" className={props.tab === 'estatisticas' ? 'active' : ''} onClick={() => props.setTab('estatisticas')}>
            Estatísticas
          </button>
          <button type="button" className={props.tab === 'info' ? 'active' : ''} onClick={() => props.setTab('info')}>
            Funções
          </button>
        </div>

        <div className="manager-champ-body">
          {props.tab === 'equipes' ? (
            <div className="manager-equipes-wrap">
              <div className="manager-equipes-hint">
                <strong>Fluxo de preenchimento</strong>
                <p>
                  Slot livre → Adicionar line (equipe vendida) ou gerar convite. Seu limite neste evento:{' '}
                  <b>
                    {used}
                    {limite > 0 ? `/${limite}` : ''}
                  </b>
                  .
                </p>
                <button type="button" className="button small secondary" onClick={() => props.onRefreshUsage?.()}>
                  Atualizar meu uso de vagas
                </button>
              </div>
              <CampeonatoEquipesTab campeonatoId={selected.campeonato_id} />
            </div>
          ) : null}
          {props.tab === 'jogadores' ? <CampeonatoJogadoresTab campeonatoId={selected.campeonato_id} /> : null}

          {props.tab === 'grupos' ? (
            <div className="manager-structure-view">
              {estruturaLoading ? (
                <p className="empty">
                  <Loader2 className="spin" size={16} /> Carregando fases e grupos...
                </p>
              ) : null}
              {estruturaError ? <div className="message error">{estruturaError}</div> : null}
              {!estruturaLoading && !estruturaError && !(estrutura?.grupos || []).length ? (
                <p className="empty">Nenhum grupo cadastrado ainda neste campeonato.</p>
              ) : null}

              {(estrutura?.fases || []).map((fase) => {
                const grupos = (estrutura?.grupos || []).filter((grupo) => grupo.fase_id === fase.id)
                return (
                  <div key={fase.id} className="manager-fase-block">
                    <header>
                      <p className="eyebrow">Fase {fase.ordem ?? ''}</p>
                      <h3>{fase.nome}</h3>
                    </header>
                    {grupos.length === 0 ? <p className="empty">Sem grupos nesta fase.</p> : null}
                    <div className="manager-grupo-grid">
                      {grupos.map((grupo) => (
                        <article key={grupo.id} className="manager-grupo-card">
                          <strong>{grupo.nome}</strong>
                          <span>
                            {grupo.slots_ocupados || 0}/{grupo.slots_total || 0} slots ocupados
                          </span>
                          <small>{grupo.slots_livres || 0} livres</small>
                          {grupo.whatsapp_url ? (
                            <a href={grupo.whatsapp_url} target="_blank" rel="noreferrer">
                              WhatsApp do grupo
                            </a>
                          ) : (
                            <small className="muted">Sem WhatsApp do grupo</small>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )
              })}

              {canOrganize ? (
                <div className="permission-note compact-note" style={{ marginTop: 14 }}>
                  <Shield size={16} />
                  <div>
                    <strong>Organizar grupos liberado</strong>
                    <p>
                      Você pode ver a estrutura. A criação/edição completa de fases e slots continua no painel da
                      produtora nesta versão; use a aba Equipes para preencher vagas vendidas.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="empty" style={{ marginTop: 12 }}>
                  Visualização da estrutura. Peça ao admin para liberar “Organizar grupos” se precisar montar fases.
                </p>
              )}
            </div>
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

              <div className="manager-jogo-list">
                {(estrutura?.jogos || []).map((jogo) => {
                  const fase = jogo.fase_id ? fasesById.get(jogo.fase_id) : null
                  return (
                    <article key={jogo.id} className="manager-jogo-card">
                      <div>
                        <strong>{jogo.nome || 'Jogo'}</strong>
                        <span>
                          {fase?.nome || 'Sem fase'} · {formatDate(jogo.data_jogo)}
                          {jogo.horario ? ` · ${String(jogo.horario).slice(0, 5)}` : ''}
                        </span>
                        <small>
                          {(jogo.mapas || []).length
                            ? `${(jogo.mapas || []).length} mapa(s): ${(jogo.mapas || []).slice(0, 3).join(', ')}`
                            : 'Mapas a definir'}
                        </small>
                      </div>
                      <div className="compact-row-actions">
                        {canScore ? (
                          <a className="button small" href={`/campeonatos/${selected.campeonato_id}/pontuador/${jogo.id}`}>
                            Pontuar
                          </a>
                        ) : (
                          <span className="manager-perm-chip muted">Pontuação bloqueada</span>
                        )}
                        <a
                          className="button small secondary"
                          href={`/campeonatos/${selected.campeonato_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={14} /> Público
                        </a>
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

          {props.tab === 'info' ? (
            <div className="manager-champ-info">
              <h3>O que você pode fazer neste campeonato</h3>
              <ul>
                <li>
                  <strong>Adicionar equipes/lines:</strong>{' '}
                  {permOn(perms, 'adicionar_equipes', true)
                    ? `Sim — você já preencheu ${used}${limite > 0 ? ` de ${limite}` : ''} vaga(s).`
                    : 'Não liberado pelo admin.'}
                </li>
                <li>
                  <strong>Gerar convites de vaga:</strong>{' '}
                  {permOn(perms, 'gerar_convites_equipe', true) ? 'Sim — envie link de slot/grupo.' : 'Não liberado.'}
                </li>
                <li>
                  <strong>Ver fases/grupos/jogos:</strong>{' '}
                  {canViewStructure ? 'Sim — abas Fases e grupos / Jogos.' : 'Não liberado.'}
                </li>
                <li>
                  <strong>Organizar grupos:</strong>{' '}
                  {canOrganize
                    ? 'Sim — liberado pelo admin (montagem avançada em evolução).'
                    : 'Ainda bloqueado. Peça ao admin do campeonato para liberar.'}
                </li>
                <li>
                  <strong>Pontuar tabela:</strong>{' '}
                  {canScore
                    ? 'Sim — use a aba Jogos → Pontuar em cada partida.'
                    : 'Ainda bloqueado. O admin pode liberar pontuação para você.'}
                </li>
              </ul>
              <p className="empty">
                Funções avançadas são controladas pela produtora em Vendedores → Liberar neste evento.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="panel span-3">
      <div className="section-head">
        <div>
          <p className="eyebrow">Operação de campeonatos</p>
          <h2>Campeonatos liberados para você</h2>
          <p className="empty" style={{ marginTop: 6 }}>
            Abra um campeonato para adicionar as equipes/lines que vendeu, ver vagas, grupos, jogos e pontuar se o admin
            liberar.
          </p>
        </div>
        <Trophy />
      </div>

      {props.sellerLoading ? <p className="empty">Carregando...</p> : null}
      {props.sellerError ? <div className="message error">{props.sellerError}</div> : null}

      {!props.sellerLoading && ativos.length === 0 ? (
        <p className="empty">
          Nenhum campeonato ativo. Quando a produtora te liberar em um evento, ele aparece aqui para operação (não só
          venda).
        </p>
      ) : null}

      <div className="manager-champ-grid">
        {ativos.map((item) => {
          const champ = item.campeonatos || {}
          const producer = item.produtoras || {}
          const labels = permissionLabels(item.permissoes)
          return (
            <button
              key={item.id}
              type="button"
              className="manager-champ-card"
              onClick={() => {
                props.setSelectedChampId(item.campeonato_id)
                props.setTab('equipes')
              }}
            >
              <div className="manager-champ-card-logo">
                {champ.logo_url ? <img src={champ.logo_url} alt="" /> : <Trophy size={22} />}
              </div>
              <div className="manager-champ-card-copy">
                <strong>{champ.nome || 'Campeonato'}</strong>
                <span>{producer.nome ? `Produtora ${producer.nome}` : 'Evento liberado'}</span>
                <small>
                  {formatUsage(item)}
                  {item.anunciando ? ' · no portfólio' : ''}
                </small>
                <div className="manager-perm-chips compact">
                  {labels.slice(0, 3).map((label) => (
                    <span key={label} className="manager-perm-chip">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <Users size={18} className="manager-champ-card-icon" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
