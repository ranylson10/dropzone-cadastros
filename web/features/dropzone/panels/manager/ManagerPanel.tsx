'use client'

import { ArrowLeft, LayoutGrid, MessageCircle, Trophy, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { DropZoneRow, ProfileType } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'
import { MANAGER_MODE_CARDS, type ManagerChampTab, type ManagerPanelMode } from './manager-modes'
import { ManagerCampeonatosView } from './ManagerCampeonatosView'
import { ManagerFlowStrip } from './ManagerFlowStrip'
import { ManagerProfileSwitchView } from './ManagerProfileSwitchView'
import { ManagerVendasView } from './ManagerVendasView'

const modeIcons: Record<Exclude<ManagerPanelMode, 'hub'>, typeof Trophy> = {
  vendas: MessageCircle,
  campeonatos: Trophy,
  equipes: Users,
  jogador: UserRound,
}

function remainingSlots(item: any) {
  const used = Number(item.vagas_usadas || 0)
  const limit = Number(item.limite_vagas || 0)
  if (limit > 0) return Math.max(0, limit - used)
  // sem limite: considera “pendente” se ainda não preencheu nada (lembrete de operar)
  return used === 0 ? 1 : 0
}

export function ManagerPanel(props: {
  account: DropZoneRow
  accounts?: DropZoneRow[]
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: ProfileType) => void
  initialMode?: Exclude<ManagerPanelMode, 'hub'>
}) {
  const accounts = props.accounts || []
  const [mode, setMode] = useState<ManagerPanelMode>(props.initialMode || 'hub')
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

  async function authHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async function load() {
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

  useEffect(() => {
    void load()
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
      setFeedback('Perfil de vendas atualizado. Próximo passo: anunciar e preencher vagas.')
      await load()
    } catch (error: any) {
      setSellerError(error?.message || 'Erro ao salvar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function toggleAnuncio(campeonatoId: string, anunciar: boolean) {
    if (!props.account?.id) return
    if (anunciar && !whatsapp.trim()) {
      setSellerError('Salve o WhatsApp de compra antes de anunciar no portfólio.')
      setMode('vendas')
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
      setSellerError(error?.message || 'Não foi possível atualizar o anúncio.')
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
    if (next !== 'campeonatos') {
      setSelectedChampId('')
      setChampTab('equipes')
    }
    if (next === 'campeonatos') {
      void load()
    }
  }

  function openChampionship(campeonatoId: string, tab: ManagerChampTab = 'equipes') {
    setMode('campeonatos')
    setSelectedChampId(campeonatoId)
    setChampTab(tab)
    void load()
  }

  function setSelectedChampIdAndRefresh(id: string) {
    setSelectedChampId(id)
    if (!id) void load()
  }

  return (
    <div className="dashboard manager-dashboard">
      <section className="panel span-3 manager-hub-header">
        <div className="section-head">
          <div>
            <p className="eyebrow">Painel do manager</p>
            <h2>
              {mode === 'hub'
                ? 'Fluxo do vendedor'
                : MANAGER_MODE_CARDS.find((c) => c.id === mode)?.title || 'Manager'}
            </h2>
            <p className="empty" style={{ marginTop: 6 }}>
              {mode === 'hub'
                ? 'Vender no link, anunciar o evento e preencher a line no campeonato — sem perder o contexto.'
                : 'Troque de contexto pelos chips ou volte ao hub.'}
            </p>
          </div>
          <LayoutGrid />
        </div>

        <div className="manager-mode-nav">
          {mode !== 'hub' ? (
            <button type="button" className="manager-mode-chip" onClick={() => setMode('hub')}>
              <ArrowLeft size={14} /> Hub
            </button>
          ) : null}
          {MANAGER_MODE_CARDS.map((card) => {
            const Icon = modeIcons[card.id]
            const active = mode === card.id
            const count =
              card.id === 'vendas' || card.id === 'campeonatos'
                ? ativos.length
                : card.id === 'equipes'
                  ? equipeAccounts.length
                  : jogadorAccounts.length
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

      {mode === 'hub' ? (
        <>
          <ManagerFlowStrip
            hasWhatsapp={hasWhatsapp}
            ativosCount={ativos.length}
            anunciandoCount={anunciando.length}
            pendentesPreencher={pendentesPreencher}
            onGoVendas={() => openMode('vendas')}
            onGoCampeonatos={() => openMode('campeonatos')}
            onOpenNextChamp={() => {
              if (nextChampToFill) openChampionship(nextChampToFill.campeonato_id)
              else openMode('campeonatos')
            }}
          />

          <section className="panel span-3">
            <div className="section-head">
              <div>
                <p className="eyebrow">Atalhos</p>
                <h2>Tudo que você controla</h2>
              </div>
            </div>
            <div className="manager-hub-grid">
              {MANAGER_MODE_CARDS.map((card) => {
                const Icon = modeIcons[card.id]
                const count =
                  card.id === 'vendas' || card.id === 'campeonatos'
                    ? ativos.length
                    : card.id === 'equipes'
                      ? equipeAccounts.length
                      : jogadorAccounts.length
                return (
                  <button key={card.id} type="button" className="manager-hub-card" onClick={() => openMode(card.id)}>
                    <span className="manager-hub-card-icon">
                      <Icon size={22} />
                    </span>
                    <span className="manager-hub-card-copy">
                      <small>{card.eyebrow}</small>
                      <strong>{card.title}</strong>
                      <span>{card.description}</span>
                    </span>
                    <span className="manager-hub-card-metric">
                      <b>{count}</b>
                      <small>
                        {card.id === 'vendas' || card.id === 'campeonatos'
                          ? 'eventos'
                          : card.id === 'equipes'
                            ? 'equipes'
                            : 'perfil'}
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>

            {ativos.length > 0 ? (
              <div className="manager-hub-quick-champs">
                <p className="eyebrow">Operação rápida</p>
                <div className="manager-hub-quick-list">
                  {ativos.slice(0, 4).map((item) => {
                    const used = Number(item.vagas_usadas || 0)
                    const limit = Number(item.limite_vagas || 0)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="manager-hub-quick-item"
                        onClick={() => openChampionship(item.campeonato_id)}
                      >
                        <strong>{item.campeonatos?.nome || 'Campeonato'}</strong>
                        <small>
                          {limit > 0 ? `${used}/${limit} vagas` : `${used} preenchida(s)`}
                          {item.anunciando ? ' · no link' : ''}
                        </small>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {mode === 'vendas' ? (
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

      {mode === 'campeonatos' ? (
        <ManagerCampeonatosView
          sellerItems={sellerItems}
          sellerLoading={sellerLoading}
          sellerError={sellerError}
          selectedChampId={selectedChampId}
          setSelectedChampId={setSelectedChampIdAndRefresh}
          tab={champTab}
          setTab={setChampTab}
          onRefreshUsage={() => void load()}
        />
      ) : null}

      {mode === 'equipes' ? (
        <ManagerProfileSwitchView
          mode="equipes"
          accounts={accounts}
          onSwitchAccount={props.onSwitchAccount}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}

      {mode === 'jogador' ? (
        <ManagerProfileSwitchView
          mode="jogador"
          accounts={accounts}
          onSwitchAccount={props.onSwitchAccount}
          onCreateLinkedProfile={props.onCreateLinkedProfile}
        />
      ) : null}
    </div>
  )
}
