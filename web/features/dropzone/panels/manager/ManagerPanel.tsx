'use client'

import { MessageCircle, Trophy, UserRound, Users } from 'lucide-react'
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
import { ManagerVendasView } from './ManagerVendasView'

const contextIcons: Record<Exclude<ManagerPanelMode, 'hub'>, typeof Trophy> = {
  produtora: Trophy,
  equipes: Users,
  jogador: UserRound,
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
    props.initialMode === 'vendas' ? 'vendas' : 'campeonatos',
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
  const [staffJogadores, setStaffJogadores] = useState<StaffVinculo[]>([])

  const equipeAccounts = useMemo(() => accounts.filter((a) => a.profile_type === 'equipe'), [accounts])
  const jogadorAccounts = useMemo(() => accounts.filter((a) => a.profile_type === 'jogador'), [accounts])
  const ativos = useMemo(() => sellerItems.filter((item) => item.status === 'ativo'), [sellerItems])

  const countCampeonatos = ativos.length
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
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar vínculos.')
      setStaffEquipes(Array.isArray(json.equipes) ? json.equipes : [])
      setStaffJogadores(Array.isArray(json.jogadores) ? json.jogadores : [])
    } catch (error: any) {
      setVinculosError(error?.message || 'Erro ao carregar vínculos.')
      setStaffEquipes([])
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
      setFeedback('Contato salvo.')
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
      setSellerError('Salve o WhatsApp antes de anunciar.')
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
      if (anunciar) setFeedback('Evento no portfólio.')
    } catch (error: any) {
      setSellerError(error?.message || 'Erro ao atualizar anúncio.')
    } finally {
      setPublishing((current) => ({ ...current, [campeonatoId]: false }))
    }
  }

  function copyPublicLink() {
    if (!whatsapp.trim()) {
      setSellerError('Configure o WhatsApp antes de copiar o link.')
      return
    }
    const publicUrl = `${window.location.origin}/vendedores/${props.account.id}`
    navigator.clipboard.writeText(publicUrl)
    setFeedback('Link copiado.')
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

  function modeCount(id: Exclude<ManagerPanelMode, 'hub'>) {
    if (id === 'produtora') return countCampeonatos
    if (id === 'equipes') return countEquipes
    return countJogador
  }

  return (
    <div className="dashboard manager-dashboard">
      {/* Nav compacta — sem texto explicativo */}
      <section className="panel span-3 manager-hub-header manager-hub-header-compact">
        <nav className="manager-mode-nav manager-mode-nav-main" aria-label="Áreas do manager">
          {MANAGER_CONTEXT_CARDS.map((card) => {
            const Icon = contextIcons[card.id]
            const active = mode === card.id
            const count = modeCount(card.id)
            return (
              <button
                key={card.id}
                type="button"
                className={`manager-mode-chip ${active ? 'active' : ''}`}
                onClick={() => openMode(card.id)}
              >
                <Icon size={15} />
                <span>{card.title}</span>
                <span className="manager-mode-count">{count}</span>
              </button>
            )
          })}
        </nav>

        {mode === 'produtora' ? (
          <div className="manager-subnav">
            <button
              type="button"
              className={`manager-mode-chip manager-mode-chip-sm ${produtoraSub === 'campeonatos' ? 'active' : ''}`}
              onClick={() => setProdutoraSub('campeonatos')}
            >
              <Trophy size={13} /> Operação
            </button>
            <button
              type="button"
              className={`manager-mode-chip manager-mode-chip-sm ${produtoraSub === 'vendas' ? 'active' : ''}`}
              onClick={() => setProdutoraSub('vendas')}
            >
              <MessageCircle size={13} /> Vendas
            </button>
          </div>
        ) : null}
      </section>

      {/* ——— CAMPEONATOS (antes: produtora) ——— */}
      {mode === 'produtora' ? (
        <>
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

      {/* ——— EQUIPES — sem trocar de perfil ——— */}
      {mode === 'equipes' ? (
        <ManagerContextsView
          context="equipes"
          staff={staffEquipes}
          linkedProfiles={equipeAccounts}
          loading={vinculosLoading}
          error={vinculosError}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}

      {/* ——— JOGADORES — sem trocar de perfil ——— */}
      {mode === 'jogador' ? (
        <ManagerContextsView
          context="jogador"
          staff={staffJogadores}
          linkedProfiles={jogadorAccounts}
          loading={vinculosLoading}
          error={vinculosError}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}
    </div>
  )
}
