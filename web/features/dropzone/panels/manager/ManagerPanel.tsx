'use client'

import { BriefcaseBusiness, MessageCircle, Trophy, UserRound, Users, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { DropZoneRow, WebProfileType } from '@/lib/types'
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
import { ProfileEditForm } from '@/components/forms/ProfileEditForm'
import { dataText } from '../../utils'
import { WorkspaceContent, WorkspaceFocus, WorkspaceHeader, WorkspaceMoreMenu, WorkspaceNav, WorkspaceShell } from '@/components/workspace'

const contextIcons: Record<Exclude<ManagerPanelMode, 'hub'>, typeof Trophy> = {
  produtora: Trophy,
  equipes: Users,
  jogador: UserRound,
}

export function ManagerPanel(props: {
  account: DropZoneRow
  accounts?: DropZoneRow[]
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: WebProfileType) => void
  /** Aceita modes antigos (vendas/campeonatos) e normaliza. */
  initialMode?: string
  /** Commercial legacy surface only; delegated management uses the normal entity panels. */
  commercialOnly?: boolean
}) {
  const accounts = props.accounts || []
  const [mode, setMode] = useState<ManagerPanelMode>(() => props.commercialOnly ? 'produtora' : normalizeManagerMode(props.initialMode))
  const [produtoraSub, setProdutoraSub] = useState<ManagerProdutoraSub>(
    'vendas',
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
  const [showManagerPerfil, setShowManagerPerfil] = useState(false)

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
    if (!props.commercialOnly) void loadVinculos()
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
    const publicUrl = `${window.location.origin}/vagas?vendedor=${props.account.id}`
    navigator.clipboard.writeText(publicUrl)
    setFeedback('Link copiado.')
  }

  function openMode(next: ManagerPanelMode) {
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
    <WorkspaceShell kind="manager" className="dashboard manager-dashboard">
      {/* Afiliado não administra o campeonato. Esta central mostra somente
          campanhas liberadas, vínculos e o próprio perfil comercial. */}
      <WorkspaceHeader
        eyebrow={props.commercialOnly ? 'Afiliados' : mode === 'produtora' && !showManagerPerfil ? 'Vendedor' : 'Sua área'}
        title={props.commercialOnly ? 'Central de afiliados' : mode === 'produtora' && !showManagerPerfil ? 'Painel do vendedor' : 'Sua área'}
        description={props.commercialOnly ? 'Campanhas, links de venda, contato e comissões.' : mode === 'produtora' && !showManagerPerfil ? 'Campanhas, links de venda e comissões, sem ferramentas de gestão misturadas.' : 'Acompanhe suas equipes e jogadores.'}
        icon={<Trophy size={18} />}
        actions={<a href="/carteira"><Wallet size={14} /> Carteira</a>}
      />
      <WorkspaceNav
        ariaLabel="Áreas de vendas"
        activeId={showManagerPerfil ? undefined : mode}
        onChange={(id) => {
          if (id === 'perfil') {
            setShowManagerPerfil(true)
            return
          }
          setShowManagerPerfil(false)
          openMode(id as ManagerPanelMode)
        }}
        items={props.commercialOnly ? [{ id: 'produtora', label: 'Vendas', icon: <BriefcaseBusiness size={15} /> }] : [
          { id: 'hub', label: 'Início', icon: <Trophy size={15} /> },
          ...MANAGER_CONTEXT_CARDS.map((item) => {
            const Icon = contextIcons[item.id]
            return { id: item.id, label: item.id === 'produtora' ? 'Vendas' : item.title, icon: item.id === 'produtora' ? <BriefcaseBusiness size={15} /> : <Icon size={15} />, badge: modeCount(item.id) }
          }),
        ]}
      />
      <WorkspaceMoreMenu label="Informações comerciais"
        activeId={showManagerPerfil ? 'perfil' : undefined}
        onChange={() => { setShowManagerPerfil(true); openMode('produtora') }}
        items={[{ id: 'perfil', label: 'Editar perfil', detail: 'Conta e informações comerciais' }]}
      />
      <WorkspaceContent>

      {mode === 'hub' && !showManagerPerfil ? (
        <WorkspaceFocus
          role="manager" eyebrow="Central do manager" title="O que você vai gerenciar hoje?"
          description="Acesse seus vínculos e solicitações. Vendas e comissões têm uma área própria."
          status={`${countEquipes} vínculo(s) de equipe · ${countJogador} de jogador`}
          actions={[
            { id: 'equipes', title: 'Minhas equipes', detail: 'Vínculos e solicitações', icon: <Users size={20} />, onClick: () => openMode('equipes') },
            { id: 'jogadores', title: 'Meus jogadores', detail: 'Perfis e relacionamentos', icon: <UserRound size={20} />, onClick: () => openMode('jogador') },
            { id: 'vendas', title: 'Central de vendas', detail: 'Links, anúncios e comissões', icon: <BriefcaseBusiness size={20} />, onClick: () => openMode('produtora') },
          ]}
        />
      ) : null}

      {mode === 'produtora' && !showManagerPerfil ? (
        <WorkspaceFocus
          role="vendedor" eyebrow="Central de vendas" title="Venda sem perder tempo"
          description="Gerencie seus campeonatos de venda. Configure o contato uma vez e compartilhe seu link."
          status={`${countCampeonatos} campeonato(s) disponível(is) · ${ativos.filter((item) => item.anunciando).length} anunciado(s)`}
          actions={whatsapp.trim() ? [
            { id: 'link', title: 'Copiar link de vendas', detail: 'Compartilhe seu catálogo de vagas', icon: <BriefcaseBusiness size={20} />, onClick: copyPublicLink },
            { id: 'perfil', title: 'Configurar contato', detail: 'Nome público e WhatsApp', icon: <MessageCircle size={20} />, onClick: () => setShowManagerPerfil(true) },
            { id: 'carteira', title: 'Minha carteira', detail: 'Comissões e histórico', icon: <Wallet size={20} />, href: '/carteira' },
          ] : [
            { id: 'perfil', title: 'Configurar contato', detail: 'Defina seu WhatsApp para vender', icon: <MessageCircle size={20} />, onClick: () => setShowManagerPerfil(true) },
            { id: 'carteira', title: 'Minha carteira', detail: 'Comissões e histórico', icon: <Wallet size={20} />, href: '/carteira' },
          ]}
        />
      ) : null}

      {mode === 'hub' && !showManagerPerfil ? (
        <section className="manager-guide-grid span-3" aria-label="Resumo do manager">
          <article><Trophy size={18}/><span><strong>{countCampeonatos}</strong><small>campeonatos liberados para venda</small></span></article>
          <article><MessageCircle size={18}/><span><strong>{ativos.filter((item) => item.anunciando).length}</strong><small>campanhas anunciadas agora</small></span></article>
          <a href="/carteira"><Wallet size={18}/><span><strong>Carteira</strong><small>saldo, comissões e histórico</small></span></a>
        </section>
      ) : null}

      {showManagerPerfil ? (
        <section className="panel span-3">
          <div className="section-head compact-head">
            <div>
              <p className="eyebrow">Manager</p>
              <h2>Editar perfil</h2>
            </div>
          </div>
          <ProfileEditForm
            profileType="manager"
            profileId={props.account.id}
            initial={{
              nome: props.account.name || '',
              avatar_url: dataText(props.account, 'avatar_url'),
              bio: dataText(props.account, 'bio'),
              whatsapp_url: whatsapp,
              nome_publico_vendas: nomePublico,
            }}
            onSaved={(profile) => {
              if (profile?.whatsapp_url != null) setWhatsapp(profile.whatsapp_url || '')
              if (profile?.nome_publico_vendas != null) setNomePublico(profile.nome_publico_vendas || '')
            }}
          />
        </section>
      ) : null}

      {/* ——— CAMPEONATOS (antes: produtora) ——— */}
      {mode === 'produtora' && !showManagerPerfil ? (
        <>
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
        </>
      ) : null}

      {/* ——— EQUIPES — sem trocar de perfil ——— */}
      {mode === 'equipes' && !showManagerPerfil ? (
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
      {mode === 'jogador' && !showManagerPerfil ? (
        <ManagerContextsView
          context="jogador"
          staff={staffJogadores}
          linkedProfiles={jogadorAccounts}
          loading={vinculosLoading}
          error={vinculosError}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}
      </WorkspaceContent>
    </WorkspaceShell>
  )
}
