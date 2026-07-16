'use client'

import {
  ArrowLeft,
  Building2,
  LayoutGrid,
  MessageCircle,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { DropZoneRow, ProfileType } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'
import {
  MANAGER_CONTEXT_CARDS,
  type ManagerChampTab,
  type ManagerPanelMode,
  type ManagerProdutoraSub,
  normalizeManagerMode,
} from './manager-modes'
import { ManagerCampeonatosView } from './ManagerCampeonatosView'
import { ManagerContextsView, type StaffVinculo } from './ManagerContextsView'
import { ManagerFlowStrip } from './ManagerFlowStrip'
import { ManagerVendasView } from './ManagerVendasView'

const contextIcons: Record<Exclude<ManagerPanelMode, 'hub'>, typeof Trophy> = {
  produtora: Building2,
  equipes: Users,
  jogador: UserRound,
}

function remainingSlots(item: any) {
  const used = Number(item.vagas_usadas || 0)
  const limit = Number(item.limite_vagas || 0)
  if (limit > 0) return Math.max(0, limit - used)
  return used === 0 ? 1 : 0
}

export function ManagerPanel(props: {
  account: DropZoneRow
  accounts?: DropZoneRow[]
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: ProfileType) => void
  /** Aceita modes antigos (vendas/campeonatos) e normaliza. */
  initialMode?: string
}) {
  const accounts = props.accounts || []
  const [mode, setMode] = useState<ManagerPanelMode>(() => normalizeManagerMode(props.initialMode))
  const [produtoraSub, setProdutoraSub] = useState<ManagerProdutoraSub>(
    props.initialMode === 'campeonatos' ? 'campeonatos' : 'vendas',
  )
  const [sellerItems, setSellerItems] = useState<any[]>([])
  const [sellerLoading, setSellerLoading] = useState(false)
  const [sellerError, setSellerError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [publishing, setPublishing] = useState<Record<string, boolean>>({})
  const [whatsapp, setWhatsapp] = useState('')
  const [nomePublico, setNomePublico] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [selectedChampId, setSelectedChampId] = useState('')
  const [champTab, setChampTab] = useState<ManagerChampTab>('equipes')

  const [vinculosLoading, setVinculosLoading] = useState(false)
  const [vinculosError, setVinculosError] = useState('')
  const [staffEquipes, setStaffEquipes] = useState<StaffVinculo[]>([])
  const [staffProdutoras, setStaffProdutoras] = useState<StaffVinculo[]>([])
  const [staffJogadores, setStaffJogadores] = useState<StaffVinculo[]>([])

  const equipeAccounts = useMemo(() => accounts.filter((a) => a.profile_type === 'equipe'), [accounts])
  const jogadorAccounts = useMemo(() => accounts.filter((a) => a.profile_type === 'jogador'), [accounts])
  const ativos = useMemo(() => sellerItems.filter((item) => item.status === 'ativo'), [sellerItems])
  const anunciando = useMemo(() => sellerItems.filter((item) => item.anunciando), [sellerItems])
  const hasWhatsapp = Boolean(whatsapp.trim())
  const pendentesPreencher = useMemo(
    () => ativos.filter((item) => remainingSlots(item) > 0).length,
    [ativos],
  )
  const nextChampToFill = useMemo(
    () => ativos.find((item) => remainingSlots(item) > 0) || ativos[0] || null,
    [ativos],
  )

  const countProdutora = ativos.length + staffProdutoras.length
  const countEquipes = staffEquipes.length + equipeAccounts.length
  const countJogador = staffJogadores.length + jogadorAccounts.length

  async function authHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async function loadSeller() {
    if (!props.account?.id) return
    setSellerLoading(true)
    setSellerError('')
    try {
      const [campRes, perfilRes] = await Promise.all([
        fetch(`/api/vendedores/${encodeURIComponent(props.account.id)}/campeonatos`, { cache: 'no-store' }),
        fetch(`/api/vendedores/${encodeURIComponent(props.account.id)}/perfil`, {
          headers: await authHeaders().catch(() => ({} as any)),
          cache: 'no-store',
        }),
      ])
      const campJson = await campRes.json()
      if (!campRes.ok) throw new Error(campJson.error || 'Não foi possível carregar campeonatos de venda.')
      setSellerItems(Array.isArray(campJson.campeonatos) ? campJson.campeonatos : [])
      if (campJson.manager) {
        setWhatsapp(campJson.manager.whatsapp_url || '')
        setNomePublico(campJson.manager.nome_publico_vendas || campJson.manager.nome || props.account.name || '')
      }
      if (perfilRes.ok) {
        const perfilJson = await perfilRes.json()
        if (perfilJson.manager) {
          setWhatsapp(perfilJson.manager.whatsapp_url || '')
          setNomePublico(perfilJson.manager.nome_publico_vendas || perfilJson.manager.nome || props.account.name || '')
        }
      }
    } catch (error: any) {
      setSellerError(error?.message || 'Não foi possível carregar campeonatos de venda.')
    } finally {
      setSellerLoading(false)
    }
  }

  async function loadVinculos() {
    if (!props.account?.id) return
    setVinculosLoading(true)
    setVinculosError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/managers/${encodeURIComponent(props.account.id)}/vinculos`, {
        headers,
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar vínculos de ajudante.')
      setStaffEquipes(Array.isArray(json.equipes) ? json.equipes : [])
      setStaffProdutoras(Array.isArray(json.produtoras) ? json.produtoras : [])
      setStaffJogadores(Array.isArray(json.jogadores) ? json.jogadores : [])
    } catch (error: any) {
      setVinculosError(error?.message || 'Erro ao carregar vínculos.')
      setStaffEquipes([])
      setStaffProdutoras([])
      setStaffJogadores([])
    } finally {
      setVinculosLoading(false)
    }
  }

  useEffect(() => {
    void loadSeller()
    void loadVinculos()
  }, [props.account?.id])

  async function saveProfile() {
    if (!props.account?.id) return
    setSavingProfile(true)
    setFeedback('')
    setSellerError('')
    try {
      const response = await fetch(`/api/vendedores/${encodeURIComponent(props.account.id)}/perfil`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({
          whatsapp_url: whatsapp,
          nome_publico_vendas: nomePublico,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar perfil de vendas.')
      setFeedback('Perfil de vendas atualizado.')
      await loadSeller()
    } catch (error: any) {
      setSellerError(error?.message || 'Erro ao salvar perfil de vendas.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function toggleAnuncio(campeonatoId: string, anunciar: boolean) {
    if (!props.account?.id) return
    if (anunciar && !whatsapp.trim()) {
      setSellerError('Salve o WhatsApp de compra antes de anunciar no portfólio.')
      setProdutoraSub('vendas')
      return
    }
    setPublishing((current) => ({ ...current, [campeonatoId]: true }))
    setSellerError('')
    try {
      const response = await fetch(`/api/vendedores/${encodeURIComponent(props.account.id)}/campeonatos`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ campeonatoId, anunciar }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Não foi possível atualizar o anúncio.')
      setSellerItems((current) =>
        current.map((item) =>
          item.campeonato_id === campeonatoId ? { ...item, anunciando: anunciar } : item,
        ),
      )
      if (anunciar) {
        setFeedback('Evento no portfólio. Quando vender a vaga, use Preencher vagas.')
      }
    } catch (error: any) {
      setSellerError(error?.message || 'Erro ao atualizar anúncio.')
    } finally {
      setPublishing((current) => ({ ...current, [campeonatoId]: false }))
    }
  }

  function copyPublicLink() {
    if (!whatsapp.trim()) {
      setSellerError('Configure o WhatsApp antes de copiar o link de vendas.')
      return
    }
    const publicUrl = `${window.location.origin}/vendedores/${props.account.id}`
    navigator.clipboard.writeText(publicUrl)
    setFeedback('Link de vendas copiado.')
  }

  function openMode(next: Exclude<ManagerPanelMode, 'hub'>) {
    setMode(next)
    if (next !== 'produtora') {
      setSelectedChampId('')
      setChampTab('equipes')
    }
  }

  function openChampionship(campeonatoId: string, tab: ManagerChampTab = 'equipes') {
    setMode('produtora')
    setProdutoraSub('campeonatos')
    setSelectedChampId(campeonatoId)
    setChampTab(tab)
    void loadSeller()
  }

  function setSelectedChampIdAndRefresh(id: string) {
    setSelectedChampId(id)
    if (!id) void loadSeller()
  }

  const title =
    mode === 'hub'
      ? 'Manager — 3 contextos'
      : MANAGER_CONTEXT_CARDS.find((c) => c.id === mode)?.title || 'Manager'

  const subtitle =
    mode === 'hub'
      ? 'Você é um ajudante. Cada bloco é um papel diferente: produtora, equipe ou jogador — tudo separado.'
      : MANAGER_CONTEXT_CARDS.find((c) => c.id === mode)?.help || ''

  return (
    <div className="dashboard manager-dashboard">
      <section className="panel span-3 manager-hub-header">
        <div className="section-head">
          <div>
            <p className="eyebrow">Painel do manager</p>
            <h2>{title}</h2>
            <p className="empty" style={{ marginTop: 6 }}>{subtitle}</p>
          </div>
          <LayoutGrid />
        </div>

        <div className="manager-mode-nav">
          {mode !== 'hub' ? (
            <button type="button" className="manager-mode-chip" onClick={() => setMode('hub')}>
              <ArrowLeft size={14} /> Hub
            </button>
          ) : null}
          {MANAGER_CONTEXT_CARDS.map((card) => {
            const Icon = contextIcons[card.id]
            const active = mode === card.id
            const count =
              card.id === 'produtora' ? countProdutora : card.id === 'equipes' ? countEquipes : countJogador
            return (
              <button
                key={card.id}
                type="button"
                className={`manager-mode-chip ${active ? 'active' : ''}`}
                onClick={() => openMode(card.id)}
              >
                <Icon size={14} />
                {card.title}
                <span className="manager-mode-count">{count}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ——— HUB: 3 em 1, organizado ——— */}
      {mode === 'hub' ? (
        <>
          <section className="panel span-3">
            <div className="section-head">
              <div>
                <p className="eyebrow">Papéis de ajudante</p>
                <h2>Escolha o contexto</h2>
                <p className="empty" style={{ marginTop: 6 }}>
                  Não misture: abra <strong>Produtora</strong> para vendas, <strong>Equipes</strong> para staff de time,
                  <strong> Jogador</strong> para atleta.
                </p>
              </div>
            </div>
            <div className="manager-hub-grid manager-hub-grid-3">
              {MANAGER_CONTEXT_CARDS.map((card) => {
                const Icon = contextIcons[card.id]
                const count =
                  card.id === 'produtora' ? countProdutora : card.id === 'equipes' ? countEquipes : countJogador
                const detail =
                  card.id === 'produtora'
                    ? `${ativos.length} evento(s) · ${staffProdutoras.length} produtora(s) staff`
                    : card.id === 'equipes'
                      ? `${staffEquipes.length} staff · ${equipeAccounts.length} perfil(is)`
                      : `${staffJogadores.length} staff · ${jogadorAccounts.length} perfil(is)`
                return (
                  <button key={card.id} type="button" className="manager-hub-card" onClick={() => openMode(card.id)}>
                    <span className="manager-hub-card-icon">
                      <Icon size={22} />
                    </span>
                    <span className="manager-hub-card-copy">
                      <small>{card.eyebrow}</small>
                      <strong>{card.title}</strong>
                      <span>{card.description}</span>
                      <em className="manager-hub-card-detail">{detail}</em>
                    </span>
                    <span className="manager-hub-card-metric">
                      <b>{count}</b>
                      <small>itens</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Atalho do fluxo de vendedor — só no hub, claramente “produtora” */}
          <ManagerFlowStrip
            hasWhatsapp={hasWhatsapp}
            ativosCount={ativos.length}
            anunciandoCount={anunciando.length}
            pendentesPreencher={pendentesPreencher}
            onGoVendas={() => {
              setMode('produtora')
              setProdutoraSub('vendas')
            }}
            onGoCampeonatos={() => {
              setMode('produtora')
              setProdutoraSub('campeonatos')
            }}
            onOpenNextChamp={() => {
              if (nextChampToFill) openChampionship(nextChampToFill.campeonato_id)
              else {
                setMode('produtora')
                setProdutoraSub('campeonatos')
              }
            }}
          />

          {staffEquipes.length > 0 ? (
            <section className="panel span-3">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Staff de equipe</p>
                  <h2>Equipes que te convidaram</h2>
                </div>
                <button type="button" className="button secondary small" onClick={() => openMode('equipes')}>
                  Ver todas
                </button>
              </div>
              <div className="manager-hub-quick-list">
                {staffEquipes.slice(0, 4).map((item) => (
                  <button
                    key={item.vinculo_id}
                    type="button"
                    className="manager-hub-quick-item"
                    onClick={() => openMode('equipes')}
                  >
                    <strong>{item.alvo.nome || 'Equipe'}</strong>
                    <small>
                      {item.alvo.username ? `@${item.alvo.username}` : 'staff'}
                      {' · '}
                      {Object.entries(item.permissoes)
                        .filter(([, v]) => v)
                        .map(([k]) => k.replace('pode_', ''))
                        .join(', ') || 'ver'}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* ——— PRODUTORA: vendas + campeonatos ——— */}
      {mode === 'produtora' ? (
        <>
          <section className="panel span-3">
            <div className="manager-subnav">
              <button
                type="button"
                className={`manager-mode-chip ${produtoraSub === 'vendas' ? 'active' : ''}`}
                onClick={() => setProdutoraSub('vendas')}
              >
                <MessageCircle size={14} /> Vendas
              </button>
              <button
                type="button"
                className={`manager-mode-chip ${produtoraSub === 'campeonatos' ? 'active' : ''}`}
                onClick={() => setProdutoraSub('campeonatos')}
              >
                <Trophy size={14} /> Campeonatos
                <span className="manager-mode-count">{ativos.length}</span>
              </button>
            </div>
            <p className="empty" style={{ marginTop: 8 }}>
              Contexto <strong>Produtora</strong>: você opera como vendedor/afiliado nos eventos liberados.
              {staffProdutoras.length > 0
                ? ` Também é staff de ${staffProdutoras.length} produtora(s).`
                : ''}
            </p>
            {staffProdutoras.length > 0 ? (
              <div className="manager-staff-inline">
                {staffProdutoras.map((p) => (
                  <span key={p.vinculo_id} className="manager-staff-pill">
                    {p.alvo.nome || 'Produtora'}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {produtoraSub === 'vendas' ? (
            <ManagerVendasView
              accountId={props.account.id}
              sellerItems={sellerItems}
              sellerLoading={sellerLoading}
              sellerError={sellerError}
              feedback={feedback}
              whatsapp={whatsapp}
              setWhatsapp={setWhatsapp}
              nomePublico={nomePublico}
              setNomePublico={setNomePublico}
              savingProfile={savingProfile}
              publishing={publishing}
              onSaveProfile={() => void saveProfile()}
              onToggleAnuncio={(id, value) => void toggleAnuncio(id, value)}
              onCopyPublicLink={copyPublicLink}
              onOpenChampionship={(id) => openChampionship(id)}
            />
          ) : null}

          {produtoraSub === 'campeonatos' ? (
            <ManagerCampeonatosView
              sellerItems={sellerItems}
              sellerLoading={sellerLoading}
              sellerError={sellerError}
              selectedChampId={selectedChampId}
              setSelectedChampId={setSelectedChampIdAndRefresh}
              tab={champTab}
              setTab={setChampTab}
              onRefreshUsage={() => void loadSeller()}
            />
          ) : null}
        </>
      ) : null}

      {/* ——— EQUIPES ——— */}
      {mode === 'equipes' ? (
        <ManagerContextsView
          context="equipes"
          staff={staffEquipes}
          linkedProfiles={equipeAccounts}
          loading={vinculosLoading}
          error={vinculosError}
          onSwitchAccount={props.onSwitchAccount}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}

      {/* ——— JOGADOR ——— */}
      {mode === 'jogador' ? (
        <ManagerContextsView
          context="jogador"
          staff={staffJogadores}
          linkedProfiles={jogadorAccounts}
          loading={vinculosLoading}
          error={vinculosError}
          onSwitchAccount={props.onSwitchAccount}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}
    </div>
  )
}
