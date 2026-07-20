'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { championshipThemeStyle } from '@/lib/championship-theme'
import {
  Bot,
  CheckCircle2,
  ClipboardCopy,
  Link2,
  ListChecks,
  Shield,
  Users,
  UserPlus,
  X,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

type Vaga = {
  index: number
  nome: string
  slot_id?: string | null
  slot_numero?: number | null
  slot_letra: string | null
  ocupada: boolean
  equipe_nome: string | null
  line_nome: string | null
  logo_url: string | null
  referencia_equipe?: string | null
  campeonato_equipe_id?: string | null
  jogadores?: Array<{
    id: string
    nick: string
    foto_url?: string | null
    id_jogo?: string | null
    funcao?: string | null
  }>
  quantidade_jogadores?: number
}

type Participacao = {
  id: string
  campeonato_equipe_id: string
  nome_exibicao: string
  slot_numero: number | null
  line: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  jogadores: Array<{
    id: string
    nick: string
    foto_url?: string | null
    id_jogo?: string | null
    funcao?: string | null
  }>
  quantidade_jogadores: number
  limite_jogadores: number
  vagas_disponiveis: number
  link_escalacao: {
    id: string
    token: string
    expira_em: string | null
    limite_jogadores: number
    public_path: string
  } | null
}

type GroupInvitePayload = {
  error?: string
  autenticado?: boolean
  inscrita?: boolean
  modo?: 'inscricao' | 'acompanhamento'
  inscricao_aberta?: boolean
  status_link?: string
  status_mensagem?: string | null
  campeonato?: { id: string; nome: string; logo_url: string | null }
  tema?: {
    cor_principal?: string | null
    cor_secundaria?: string | null
    bg_opacidade?: number | null
    bg_image_url?: string | null
    cor_texto_clara?: string | null
    cor_texto_escura?: string | null
  } | null
  grupo?: { id: string; nome: string }
  vagas?: Vaga[]
  equipes_esperadas?: Array<{ nome: string; disponivel: boolean; status?: string }>
  resumo_grupo?: { total: number; ocupadas: number; livres: number }
  resumo_link?: { limite_vagas: number; usos: number; restantes: number }
  link?: {
    token?: string
    titulo?: string
    limite_vagas?: number
    usos?: number
    restantes?: number
    expira_em?: string | null
  }
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null; papel?: string | null } | null
  equipes_disponiveis?: Array<{
    id: string
    nome: string
    username?: string | null
    logo_url?: string | null
    tag?: string | null
    papel?: string
    inscrita_no_grupo?: boolean
  }>
  papel_sessao?: 'equipe' | 'manager' | null
  lines?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita: boolean }>
  lines_disponiveis?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita?: boolean }>
  total_lines_inscritas_campeonato?: number
  minhas_participacoes?: Participacao[]
  /** Alguma equipe controlada já está inscrita neste grupo (escalação / hub) */
  tem_equipe_inscrita_no_grupo?: boolean
}

/**
 * login → (criar equipe) → [confirmar só se sessão prévia] → escolher line → sucesso
 * Acompanhamento público é o default quando o link está fechado ou o usuário escolhe só ver.
 */
type Step =
  | 'acompanhar'
  | 'login'
  | 'sem_equipe'
  | 'escolher_equipe'
  | 'confirmar_equipe'
  | 'escolher_line'
  | 'sucesso'
  | 'hub'
  | 'escalar'
  | 'jogadores'

const SESSION_WAS_LOGGED_KEY = 'dz_invite_was_logged'
const SESSION_JUST_LOGIN_KEY = 'dz_invite_just_login'

export default function ConviteGrupoPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const returnTo = `/convite/grupo/${encodeURIComponent(token)}`

  const [data, setData] = useState<GroupInvitePayload | null>(null)
  const [selectedEquipeId, setSelectedEquipeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<Step>('acompanhar')
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('')
  const [generated, setGenerated] = useState<{ link: string; texto: string } | null>(null)
  const [detailVaga, setDetailVaga] = useState<Vaga | null>(null)
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [sucessoInfo, setSucessoInfo] = useState<{
    line: string
    slot?: string
    campeonatoEquipeId?: string
    valorInscricao?: number | null
    precisaPagamento?: boolean
  } | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [payUrl, setPayUrl] = useState('')

  const linesDisponiveis = useMemo(() => {
    // Preferir lines_disponiveis mesmo se vazio (lista vazia = todas já inscritas)
    const source = Array.isArray(data?.lines_disponiveis)
      ? data!.lines_disponiveis!
      : Array.isArray(data?.lines)
        ? data!.lines!
        : []
    return source.filter((line) => !line.ja_inscrita && String(line.nome || '').trim().toLowerCase() !== 'nova line')
  }, [data?.lines, data?.lines_disponiveis])

  const linesJaNoCampeonato = useMemo(() => {
    const list = Array.isArray((data as any)?.lines_inscritas) ? (data as any).lines_inscritas : []
    return list as Array<{ id: string; nome: string }>
  }, [data])

  const slotsLivresLista = useMemo(
    () => (data?.vagas || []).filter((vaga) => !vaga.ocupada && vaga.slot_id),
    [data?.vagas],
  )

  const minhasParticipacoes = data?.minhas_participacoes || []
  const selectedParticipacao =
    minhasParticipacoes.find((item) => item.id === selectedParticipacaoId) || minhasParticipacoes[0] || null
  const inscricaoAberta = data?.inscricao_aberta !== false && data?.modo !== 'acompanhamento'
  const slotsLivres = Number(data?.resumo_grupo?.livres || 0)
  const restantesLink = data?.resumo_link?.restantes ?? 1
  const podeInscrever = Boolean(inscricaoAberta && slotsLivres > 0 && restantesLink > 0)
  const selectedSlot =
    slotsLivresLista.find((vaga) => vaga.slot_id === selectedSlotId) || slotsLivresLista[0] || null

  const themeStyle = useMemo(
    () =>
      championshipThemeStyle({
        cor_principal: data?.tema?.cor_principal,
        cor_secundaria: data?.tema?.cor_secundaria,
        bg_opacidade: data?.tema?.bg_opacidade,
        bg_image_url: data?.tema?.bg_image_url,
      }),
    [
      data?.tema?.cor_principal,
      data?.tema?.cor_secundaria,
      data?.tema?.bg_opacidade,
      data?.tema?.bg_image_url,
    ],
  )

  function markSessionContext(hasSession: boolean) {
    try {
      const key = `${SESSION_WAS_LOGGED_KEY}:${token}`
      const justKey = `${SESSION_JUST_LOGIN_KEY}:${token}`
      if (!hasSession) {
        // Marca que o fluxo começou deslogado — após o login, pulamos "confirmar equipe"
        sessionStorage.setItem(key, '0')
        sessionStorage.removeItem(justKey)
        return { wasLogged: false, justLoggedIn: false }
      }
      const prev = sessionStorage.getItem(key)
      // prev === '0' → abriu sem login e acabou de autenticar neste fluxo
      const justLoggedIn = prev === '0' || sessionStorage.getItem(justKey) === '1'
      if (justLoggedIn) sessionStorage.setItem(justKey, '1')
      sessionStorage.setItem(key, '1')
      // prev null ou '1' com sessão = já estava logado ao abrir o link
      const wasLogged = !justLoggedIn
      return { wasLogged, justLoggedIn }
    } catch {
      return { wasLogged: hasSession, justLoggedIn: false }
    }
  }

  function clearJustLoginFlag() {
    try {
      sessionStorage.removeItem(`${SESSION_JUST_LOGIN_KEY}:${token}`)
    } catch {
      // ignore
    }
  }

  /**
   * - Link fechado + equipe já inscrita → hub (escalação / jogadores).
   * - Link fechado + multi-equipe inscrita sem pasta → escolher_equipe.
   * - Link fechado sem vínculo → acompanhamento público.
   * - Link aberto + sem login → login (com opção acompanhar).
   * - Link aberto + logado com equipe:
   *     · sessão prévia → confirmar equipe (1x)
   *     · login neste fluxo → direto na line
   */
  function resolveStep(
    payload: GroupInvitePayload,
    opts: { wasLogged: boolean; justLoggedIn: boolean; forceAcompanhar?: boolean },
  ): Step {
    const open = payload.inscricao_aberta !== false && payload.modo !== 'acompanhamento'
    const parts = payload.minhas_participacoes || []
    const multi = (payload.equipes_disponiveis || []).length > 1
    const hasInscrita =
      parts.length > 0
      || payload.tem_equipe_inscrita_no_grupo === true
      || (payload.equipes_disponiveis || []).some((e) => e.inscrita_no_grupo)

    if (opts.forceAcompanhar) return 'acompanhar'

    // Link esgotado/fechado: ainda libera hub de escalação para quem já entrou
    if (!open) {
      if (payload.autenticado && parts.length > 0) return 'hub'
      // Várias pastas e alguma inscrita: escolher qual gerenciar
      if (payload.autenticado && multi && hasInscrita) return 'escolher_equipe'
      return 'acompanhar'
    }

    if (!payload.autenticado) return 'login'
    // Manager / multi-equipe: escolher com qual pasta entrar
    if (!payload.equipe && (payload.equipes_disponiveis || []).length > 0) return 'escolher_equipe'
    if (!payload.equipe) return 'sem_equipe'
    if (multi && opts.wasLogged && !opts.justLoggedIn) return 'escolher_equipe'
    // Acabou de logar neste fluxo: não pergunta equipe de novo (já selecionou ou é única)
    if (opts.justLoggedIn) return 'escolher_line'
    // Já estava logado ao abrir o link → confirma (ou troca) a equipe
    if (opts.wasLogged) return multi ? 'escolher_equipe' : 'confirmar_equipe'
    return 'escolher_line'
  }

  async function carregar(opts?: { forceStep?: Step; forceAcompanhar?: boolean; equipeId?: string }) {
    setLoading(true)
    setMessage('')
    const { data: sessionData } = await supabase.auth.getSession()
    const hasSession = Boolean(sessionData.session)
    const sessionCtx = markSessionContext(hasSession)
    const eqId = opts?.equipeId || selectedEquipeId
    const qs = eqId ? `?equipe_id=${encodeURIComponent(eqId)}` : ''

    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}${qs}`, {
      headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
      cache: 'no-store',
    })
    const payload: GroupInvitePayload = await response.json()
    setData(payload)
    if (payload.equipe?.id) setSelectedEquipeId(payload.equipe.id)

    // Token inexistente de verdade (sem campeonato)
    if (!response.ok && payload.error && !payload.campeonato) {
      setLoading(false)
      return
    }

    const parts: Participacao[] = payload.minhas_participacoes || []
    if (parts[0]?.id) setSelectedParticipacaoId(parts[0].id)

    const freeLines = (Array.isArray(payload.lines_disponiveis) ? payload.lines_disponiveis : payload.lines || [])
      .filter((line: any) => !line.ja_inscrita)
      .filter((line: any) => String(line.nome || '').trim().toLowerCase() !== 'nova line')
    // Se há line livre, seleciona a primeira; senão entra no modo "criar" (sem id)
    setLineId(freeLines[0]?.id || '__create__')
    setNomeNovaLine('')

    // Mantém slot escolhido se ainda estiver livre; senão primeiro livre
    const freeSlots = (payload.vagas || []).filter((vaga: Vaga) => !vaga.ocupada && vaga.slot_id)
    const stillFree = freeSlots.some((vaga: Vaga) => vaga.slot_id === selectedSlotId)
    if (!stillFree) {
      setSelectedSlotId(String(freeSlots[0]?.slot_id || ''))
    }

    setStep(
      opts?.forceStep ||
        resolveStep(payload, {
          wasLogged: sessionCtx.wasLogged,
          justLoggedIn: sessionCtx.justLoggedIn,
          forceAcompanhar: opts?.forceAcompanhar,
        }),
    )
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
  }, [token])

  function startInscricao() {
    setMessage('')
    if (!data) return
    if (!podeInscrever) {
      setMessage(data.status_mensagem || 'Este link não aceita novas inscrições no momento.')
      setStep('acompanhar')
      return
    }
    if (!data.autenticado) {
      setStep('login')
      return
    }
    if ((data.equipes_disponiveis || []).length > 1 && !data.equipe) {
      setStep('escolher_equipe')
      return
    }
    if (!data.equipe && !(data.equipes_disponiveis || []).length) {
      setStep('sem_equipe')
      return
    }
    if ((data.equipes_disponiveis || []).length > 1) {
      setStep('escolher_equipe')
      return
    }
    // CTA "Escalar" / inscrição a partir do acompanhamento: se já tinha sessão, confirma; senão line
    try {
      const wasLogged = sessionStorage.getItem(`${SESSION_WAS_LOGGED_KEY}:${token}`) === '1'
      const justLoggedIn = sessionStorage.getItem(`${SESSION_JUST_LOGIN_KEY}:${token}`) === '1'
      setStep(justLoggedIn || !wasLogged ? 'escolher_line' : 'confirmar_equipe')
    } catch {
      setStep('escolher_line')
    }
  }

  async function escolherEquipe(equipeId: string) {
    setSelectedEquipeId(equipeId)
    setMessage('')
    // Não força "escolher_line": se o link estiver fechado e a equipe já estiver
    // inscrita, resolveStep manda para o hub de escalação.
    await carregar({ equipeId })
  }

  function confirmarEstaEquipe() {
    setMessage('')
    clearJustLoginFlag()
    setStep('escolher_line')
  }

  async function confirmarInscricao() {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setStep('login')
      return setMessage('Entre com sua conta de equipe para continuar.')
    }
    if (!data?.equipe) {
      setStep('sem_equipe')
      return
    }
    const creatingNew = !lineId || lineId === '__create__'
    if (creatingNew && !nomeNovaLine.trim()) {
      return setMessage('Selecione uma line livre ou digite o nome de uma nova line.')
    }
    if (creatingNew) {
      const nome = nomeNovaLine.trim().toLowerCase()
      if (['nova line', 'nova_line', 'new line', '+ criar nova line', 'criar nova line'].includes(nome)) {
        return setMessage('Use um nome real para a line (ex.: ALOE ELITE 2), não "Nova Line".')
      }
    }
    if (slotsLivresLista.length > 0 && !selectedSlotId) {
      return setMessage('Selecione o slot que sua equipe vai ocupar.')
    }

    let resolvedLineId = creatingNew ? null : lineId
    let resolvedNomeLine = creatingNew ? nomeNovaLine.trim() : null
    if (!resolvedLineId && resolvedNomeLine) {
      const freeMatch = linesDisponiveis.find(
        (line) => String(line.nome || '').trim().toLowerCase() === resolvedNomeLine!.toLowerCase(),
      )
      if (freeMatch) {
        resolvedLineId = freeMatch.id
        resolvedNomeLine = null
      }
    }

    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        equipe_id: selectedEquipeId || data?.equipe?.id || undefined,
        line_id: resolvedLineId || undefined,
        nome_line: resolvedNomeLine || undefined,
        // slot escolhido pelo usuário (API ainda faz auto-slot se omitido)
        slot_id: selectedSlotId || undefined,
      }),
    })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(payload.error || 'Não foi possível entrar no grupo.')

    clearJustLoginFlag()
    setSucessoInfo({
      line: payload.line?.nome || resolvedNomeLine || 'Line',
      slot: payload.slot_letra || selectedSlot?.slot_letra || undefined,
      campeonatoEquipeId: payload.campeonato_equipe_id || payload.participacao?.id || undefined,
      valorInscricao: payload.valor_inscricao ?? null,
      precisaPagamento: Boolean(payload.precisa_pagamento),
    })
    setPayUrl('')
    setStep('sucesso')
    await carregar({ forceStep: 'sucesso' })
  }

  async function pagarInscricao() {
    if (!sucessoInfo?.campeonatoEquipeId) return
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return setMessage('Entre novamente para pagar a inscrição.')
    setPayBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/pagamentos/inscricao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          campeonato_equipe_id: sucessoInfo.campeonatoEquipeId,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Não foi possível gerar o pagamento.')
      const url = String(json.payment?.invoice_url || '')
      setPayUrl(url)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      setMessage(e?.message || 'Erro no pagamento')
    } finally {
      setPayBusy(false)
    }
  }

  async function gerarLinkEscalacao() {
    if (!selectedParticipacao) return setMessage('Nenhuma line inscrita neste grupo.')
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return setMessage('Entre com sua conta de equipe para continuar.')

    setBusy(true)
    setMessage('')
    setGenerated(null)
    try {
      const response = await fetch('/api/equipe/escalacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          campeonato_equipe_id: selectedParticipacao.campeonato_equipe_id,
          limite_jogadores: selectedParticipacao.limite_jogadores || 6,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao gerar link de escalação.')
      setGenerated({
        link: String(json.public_url || `${window.location.origin}/escala/${json.token}`),
        texto: String(json.texto || json.public_url || ''),
      })
      await carregar({ forceStep: 'escalar' })
      setMessage('Link de escalação gerado.')
    } catch (error: any) {
      setMessage(error?.message || 'Erro ao gerar link de escalação.')
    } finally {
      setBusy(false)
    }
  }

  async function copiar(texto: string, okMessage = 'Copiado.') {
    try {
      await navigator.clipboard.writeText(texto)
      setMessage(okMessage)
    } catch {
      setMessage('Não foi possível copiar automaticamente.')
    }
  }

  function openVagaDetail(vaga: Vaga) {
    if (!vaga.ocupada) return
    setDetailVaga(vaga)
  }

  function renderSlots() {
    return (
      <div className="lineup-slots public-lineup-slots invite-slot-grid">
        {(data?.vagas || []).map((vaga) => (
          <button
            type="button"
            key={vaga.slot_id || vaga.index}
            className={`lineup-slot invite-slot-button ${vaga.ocupada ? 'occupied' : 'free'} ${vaga.ocupada ? 'clickable' : ''}`}
            onClick={() => openVagaDetail(vaga)}
            disabled={!vaga.ocupada}
            title={
              vaga.ocupada
                ? 'Ver line e jogadores'
                : `Slot ${vaga.slot_letra} livre`
            }
          >
            <b>{vaga.slot_letra || vaga.index + 1}</b>
            {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
            <div>
              <strong>
                {vaga.ocupada
                  ? vaga.line_nome || vaga.equipe_nome || 'Ocupado'
                  : `Slot ${vaga.slot_letra}`}
              </strong>
              <span>
                {vaga.ocupada
                  ? `${vaga.equipe_nome || 'Equipe'}${vaga.quantidade_jogadores != null ? ` · ${vaga.quantidade_jogadores} jog.` : ''}`
                  : 'Disponível'}
              </span>
            </div>
          </button>
        ))}
      </div>
    )
  }

  if (loading) return <DropzoneLoader label="Carregando link de equipes" />

  // Só 404 real: token inexistente e sem dados de campeonato
  if (!data || (data.error && !data.campeonato)) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Link indisponível</h1>
          <p>{data?.error || 'Não foi possível carregar este link.'}</p>
          <a className="button invite-confirm" href="/">
            Ir para o início
          </a>
        </div>
      </main>
    )
  }

  const showTrackingChrome =
    step === 'acompanhar' || step === 'hub' || step === 'escalar' || step === 'jogadores' || step === 'sucesso'

  const eyebrow =
    step === 'hub'
      ? minhasParticipacoes.length > 1
        ? `${minhasParticipacoes.length} lines inscritas`
        : 'Equipe inscrita'
      : step === 'login'
        ? 'Entrada de equipes'
        : step === 'sem_equipe'
          ? 'Perfil de equipe'
          : step === 'escolher_equipe'
            ? 'Escolher equipe'
            : step === 'confirmar_equipe'
              ? 'Confirmar equipe'
              : step === 'escolher_line'
                ? 'Escolher line'
              : step === 'sucesso'
                ? 'Inscrição confirmada'
                : step === 'escalar'
                  ? 'Escalar elenco'
                  : step === 'jogadores'
                    ? 'Jogadores inscritos'
                    : !inscricaoAberta
                      ? 'Acompanhamento do grupo'
                      : 'Acompanhamento do grupo'

  const isChatStep = step === 'login'
    || step === 'sem_equipe'
    || step === 'escolher_equipe'
    || step === 'confirmar_equipe'
    || step === 'escolher_line'
    || step === 'sucesso'

  function BotBubble({ children }: { children: ReactNode }) {
    return (
      <div className="invite-chat-row bot">
        <span className="invite-bot-avatar"><Bot size={18} /></span>
        <div>
          <div className="invite-chat-bubble">
            <strong>DropBot</strong>
            <div>{children}</div>
          </div>
          <div className="invite-typing" aria-label="DropBot digitando">
            <span />
            <span />
            <span />
            <em>DropBot digitando...</em>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <main className="invite-page champ-theme" style={themeStyle}>
        <div className={`invite-card ${showTrackingChrome ? 'invite-hub-card' : ''} ${isChatStep ? 'invite-chat-card' : ''}`}>
          {data.campeonato?.logo_url ? (
            <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          ) : step === 'sucesso' || (showTrackingChrome && minhasParticipacoes.length) ? (
            <CheckCircle2 size={42} />
          ) : (
            <Users size={42} />
          )}

          <p className="eyebrow">{eyebrow}</p>
          <h1>{data.campeonato?.nome}</h1>
          <p>
            {data.grupo?.nome}
            {data.equipe && step !== 'acompanhar' ? ` · ${data.equipe.nome}` : ''}
          </p>

          <div className="invite-mini-stats">
            <span>
              <strong>{data.resumo_grupo?.ocupadas ?? 0}</strong> ocupadas
            </span>
            <span>
              <strong>{data.resumo_grupo?.livres ?? 0}</strong> livres
            </span>
            <span>
              <strong>{data.resumo_grupo?.total ?? 0}</strong> slots
            </span>
            {data.resumo_link ? (
              <span>
                <strong>
                  {data.resumo_link.usos}/{data.resumo_link.limite_vagas}
                </strong>{' '}
                no link
              </span>
            ) : null}
          </div>

          {!inscricaoAberta && data.status_mensagem && step === 'acompanhar' ? (
            <p className="invite-section-copy" style={{ textAlign: 'center', marginTop: 6 }}>
              {data.status_mensagem}
            </p>
          ) : null}

          {/* ——— LOGIN (só 2 opções) ——— */}
          {step === 'login' ? (
            <div className="invite-auth-box invite-chat-shell" style={{ marginTop: 16 }}>
              <BotBubble>
                {podeInscrever ? (
                  <>
                    <p>Oi! Eu sou o DropBot 🤖</p>
                    <p>Para inscrever sua equipe no <strong>{data.campeonato?.nome}</strong>, primeiro preciso confirmar seu login.</p>
                    <p>Como você quer continuar?</p>
                  </>
                ) : (
                  <>
                    <p>Esse link não aceita novas inscrições agora.</p>
                    <p>Se sua equipe já está no grupo, entre para escalar o elenco.</p>
                  </>
                )}
              </BotBubble>
              <SocialLogin profileType="equipe" returnTo={returnTo} />
              <a
                className="button secondary"
                href={buildLoginHref('equipe', returnTo)}
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
              >
                Entrar com e-mail e senha
              </a>
              <button
                className="button secondary"
                type="button"
                onClick={() => setStep('acompanhar')}
                style={{ width: '100%', marginTop: 8 }}
              >
                Só acompanhar as inscrições
              </button>
            </div>
          ) : null}

          {/* ——— SEM EQUIPE ——— */}
          {step === 'sem_equipe' ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <Shield size={22} />
              <p>
                {data.papel_sessao === 'manager'
                  ? 'Seu perfil de manager não controla nenhuma equipe ainda. Aceite um convite de staff ou crie uma equipe neste login.'
                  : (
                    <>
                      Seu login está ativo, mas ainda <strong>não tem conta de equipe</strong>. Crie o perfil para
                      continuar a inscrição automaticamente.
                    </>
                  )}
              </p>
              <a className="button invite-confirm" href={buildProfileCreationHref('equipe', returnTo)}>
                Criar perfil de equipe
              </a>
              <a className="button secondary" href={buildLoginHref(data.papel_sessao === 'manager' ? 'manager' : 'equipe', returnTo, true)}>
                Usar outra conta
              </a>
              <button className="button secondary" type="button" onClick={() => setStep('acompanhar')} style={{ width: '100%', marginTop: 8 }}>
                Só acompanhar
              </button>
            </div>
          ) : null}

          {/* ——— MANAGER / MULTI-EQUIPE: escolher pasta ——— */}
          {step === 'escolher_equipe' ? (
            <div className="invite-section" style={{ marginTop: 16 }}>
              <div className="invite-auth-box" style={{ marginBottom: 12 }}>
                <Users size={22} />
                <p>
                  {data.papel_sessao === 'manager' ? (
                  <>
                    Você entrou como <strong>manager</strong>.{' '}
                    {!inscricaoAberta
                      ? 'Escolha a equipe inscrita neste grupo para gerenciar a escalação.'
                      : 'Escolha com qual equipe deseja se inscrever neste campeonato.'}
                  </>
                ) : (
                  !inscricaoAberta
                    ? 'Você controla mais de uma equipe. Escolha a inscrita neste grupo para gerenciar a escalação.'
                    : 'Você controla mais de uma equipe. Escolha com qual deseja entrar.'
                )}
                </p>
              </div>
              <div className="championship-vagas-list">
                {(data.equipes_disponiveis || [])
                  .slice()
                  .sort((a, b) => Number(Boolean(b.inscrita_no_grupo)) - Number(Boolean(a.inscrita_no_grupo)))
                  .map((eq) => (
                  <article
                    key={eq.id}
                    className={`championship-vaga-row ${eq.inscrita_no_grupo ? 'status-ocupada' : 'status-livre'}`}
                  >
                    <button
                      type="button"
                      className="vaga-row-summary"
                      onClick={() => void escolherEquipe(eq.id)}
                      disabled={busy}
                    >
                      <span className="vaga-row-number">{eq.papel === 'dono' ? 'DN' : 'ST'}</span>
                      <span className={`vaga-row-avatar ${eq.inscrita_no_grupo ? 'status-ocupada' : 'status-livre'}`} aria-hidden>
                        {eq.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={eq.logo_url} alt="" />
                        ) : (
                          <Users size={18} />
                        )}
                      </span>
                      <span className="vaga-row-identity">
                        <strong>{eq.nome}</strong>
                        <small>
                          {eq.username ? `@${eq.username}` : 'Equipe'}
                          {' · '}
                          {eq.papel === 'dono' ? 'Dono' : 'Staff'}
                        </small>
                      </span>
                      <span className="vaga-row-meta">
                        <span className={`vaga-status-pill ${eq.inscrita_no_grupo ? 'status-ocupada' : 'status-livre'}`}>
                          {eq.inscrita_no_grupo ? 'Inscrita' : 'Usar'}
                        </span>
                      </span>
                      <span className="vaga-row-chevron" aria-hidden />
                    </button>
                  </article>
                ))}
              </div>
              {data.equipe && inscricaoAberta ? (
                <button
                  type="button"
                  className="button secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => setStep('escolher_line')}
                >
                  Continuar com {data.equipe.nome}
                </button>
              ) : null}
              <button className="button secondary" type="button" onClick={() => setStep('acompanhar')} style={{ width: '100%', marginTop: 8 }}>
                Só acompanhar
              </button>
            </div>
          ) : null}

          {/* ——— CONFIRMAR EQUIPE (só sessão já existente ao abrir o link) ——— */}
          {step === 'confirmar_equipe' && data.equipe ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <div className="invite-current-team" style={{ width: '100%' }}>
                <small>Equipe logada</small>
                <strong>{data.equipe.nome}</strong>
                <span>{data.equipe.tag ? `Tag ${data.equipe.tag}` : 'Sem tag'}</span>
              </div>
              <p>
                Usar a equipe <strong>{data.equipe.nome}</strong> nesta inscrição?
              </p>
              <button className="button invite-confirm" type="button" onClick={confirmarEstaEquipe}>
                Usar {data.equipe.nome}
              </button>
              <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                Trocar de equipe (outro login)
              </a>
              <button className="button secondary" type="button" onClick={() => setStep('acompanhar')} style={{ width: '100%', marginTop: 8 }}>
                Só acompanhar
              </button>
            </div>
          ) : null}

          {/* ——— ESCOLHER SLOT + LINE ——— */}
          {step === 'escolher_line' ? (
            <div className="invite-section" style={{ marginTop: 12 }}>
              <div className="invite-current-team" style={{ marginBottom: 12 }}>
                <small>Inscrevendo com</small>
                <strong>{data.equipe?.nome}</strong>
                <span>
                  {selectedSlot
                    ? `Slot ${selectedSlot.slot_letra || selectedSlot.slot_numero || ''} selecionado.`
                    : 'Escolha o slot vazio e a line.'}
                </span>
              </div>

              {slotsLivresLista.length ? (
                <div className="invite-slot-pick" style={{ marginBottom: 14 }}>
                  <p className="invite-section-copy" style={{ marginBottom: 8 }}>
                    Escolha o <strong>slot</strong> que sua equipe vai ocupar:
                  </p>
                  <div className="lineup-slots public-lineup-slots invite-slot-grid">
                    {slotsLivresLista.map((vaga) => {
                      const active = selectedSlotId === vaga.slot_id
                      return (
                        <button
                          type="button"
                          key={vaga.slot_id || vaga.index}
                          className={`lineup-slot invite-slot-button free clickable ${active ? 'selected' : ''}`}
                          onClick={() => setSelectedSlotId(String(vaga.slot_id))}
                          title={`Selecionar slot ${vaga.slot_letra || vaga.slot_numero || ''}`}
                        >
                          <b>{vaga.slot_letra || vaga.slot_numero || '?'}</b>
                          <div>
                            <strong>Slot {vaga.slot_letra || vaga.slot_numero}</strong>
                            <span>{active ? 'Selecionado' : 'Disponível'}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="invite-section-copy" style={{ marginBottom: 12 }}>
                  Nenhum slot livre neste grupo no momento.
                </p>
              )}

              {linesJaNoCampeonato.length ? (
                <p className="invite-section-copy" style={{ marginBottom: 10 }}>
                  Já no campeonato (ocultas):{' '}
                  <strong>{linesJaNoCampeonato.map((l) => l.nome).filter(Boolean).join(', ')}</strong>
                </p>
              ) : null}

              {linesDisponiveis.length ? (
                <label className="field">
                  <span>Line livre (ainda não está no campeonato)</span>
                  <select
                    value={lineId || '__create__'}
                    onChange={(e) => {
                      setLineId(e.target.value)
                      if (e.target.value !== '__create__') setNomeNovaLine('')
                    }}
                  >
                    {linesDisponiveis.map((line) => (
                      <option key={line.id} value={line.id}>
                        {line.nome}
                      </option>
                    ))}
                    <option value="__create__">+ Criar nova line…</option>
                  </select>
                </label>
              ) : (
                <div className="invite-lines-note">
                  <small>Criar line</small>
                  <p>
                    Todas as lines desta equipe já estão no campeonato (ou você ainda não tem line). Crie uma{' '}
                    <strong>line com nome próprio</strong> (ex.: ALOE ELITE 2) para esta inscrição.
                  </p>
                </div>
              )}

              {!lineId || lineId === '__create__' ? (
                <label className="field">
                  <span>Nome da nova line</span>
                  <input
                    value={nomeNovaLine}
                    onChange={(e) => setNomeNovaLine(e.target.value)}
                    placeholder="Ex.: ALOE ELITE 2"
                    autoFocus={!linesDisponiveis.length || lineId === '__create__'}
                  />
                </label>
              ) : null}

              <button
                className="button invite-confirm"
                type="button"
                disabled={busy || (slotsLivresLista.length > 0 && !selectedSlotId)}
                onClick={() => void confirmarInscricao()}
                style={{ width: '100%', marginTop: 12 }}
              >
                {busy
                  ? 'Confirmando...'
                  : selectedSlot
                    ? `Confirmar no slot ${selectedSlot.slot_letra || selectedSlot.slot_numero || ''}`
                    : 'Confirmar inscrição'}
              </button>
              <button
                className="button secondary"
                type="button"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setStep('acompanhar')}
              >
                Voltar ao acompanhamento
              </button>
            </div>
          ) : null}

          {/* ——— SUCESSO ——— */}
          {step === 'sucesso' ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <CheckCircle2 size={40} />
              <p>
                <strong>{sucessoInfo?.line || 'Line'}</strong> inscrita
                {sucessoInfo?.slot ? (
                  <>
                    {' '}
                    no slot <strong>{sucessoInfo.slot}</strong>
                  </>
                ) : null}
                .
              </p>
              {sucessoInfo?.precisaPagamento && sucessoInfo.valorInscricao ? (
                <div className="message" style={{ marginTop: 12, textAlign: 'left' }}>
                  <strong>
                    Inscrição:{' '}
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      Number(sucessoInfo.valorInscricao),
                    )}
                  </strong>
                  <p style={{ margin: '6px 0 10px' }}>
                    Pague via ASAAS para confirmar a inscrição financeira (comissão do vendedor cai na carteira
                    automática).
                  </p>
                  <button
                    className="button invite-confirm"
                    type="button"
                    disabled={payBusy}
                    onClick={() => void pagarInscricao()}
                    style={{ width: '100%' }}
                  >
                    {payBusy ? 'Gerando pagamento…' : 'Pagar inscrição'}
                  </button>
                  {payUrl ? (
                    <a
                      className="button secondary"
                      href={payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: '100%', marginTop: 8, display: 'inline-flex', justifyContent: 'center' }}
                    >
                      Abrir fatura novamente
                    </a>
                  ) : null}
                </div>
              ) : null}
              <button className="button invite-confirm" type="button" onClick={() => setStep('hub')} style={{ marginTop: 10 }}>
                Gerenciar minha inscrição
              </button>
              <button className="button secondary" type="button" onClick={() => setStep('acompanhar')} style={{ width: '100%' }}>
                Ver grupo
              </button>
            </div>
          ) : null}

          {/* ——— HUB pós-inscrição ——— */}
          {step === 'hub' ? (
            <>
              {minhasParticipacoes.length > 1 ? (
                <label className="field">
                  <span>Line inscrita</span>
                  <select
                    value={selectedParticipacao?.id || ''}
                    onChange={(e) => setSelectedParticipacaoId(e.target.value)}
                  >
                    {minhasParticipacoes.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.line?.nome || part.nome_exibicao}
                        {part.slot_numero ? ` · slot ${part.slot_numero}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : selectedParticipacao ? (
                <div className="invite-current-team">
                  <small>Line confirmada</small>
                  <strong>{selectedParticipacao.line?.nome || selectedParticipacao.nome_exibicao}</strong>
                  <span>
                    {selectedParticipacao.quantidade_jogadores}/{selectedParticipacao.limite_jogadores} jogadores
                    {selectedParticipacao.slot_numero ? ` · slot ${selectedParticipacao.slot_numero}` : ''}
                  </span>
                </div>
              ) : (
                <p className="invite-section-copy" style={{ textAlign: 'center' }}>
                  Acompanhe as equipes do grupo abaixo.
                </p>
              )}

              <div className="invite-hub-actions">
                {selectedParticipacao ? (
                  <>
                    <button className="invite-hub-option invite-hub-option-primary" type="button" onClick={() => setStep('escalar')}>
                      <Link2 size={20} />
                      <span>
                        <strong>Escalar elenco</strong>
                        <small>Gere o link de escalação para os jogadores</small>
                      </span>
                    </button>
                    <button className="invite-hub-option" type="button" onClick={() => setStep('jogadores')}>
                      <ListChecks size={20} />
                      <span>
                        <strong>Jogadores inscritos</strong>
                        <small>Quem já confirmou na escalação</small>
                      </span>
                    </button>
                  </>
                ) : null}
                <button className="invite-hub-option" type="button" onClick={() => setStep('acompanhar')}>
                  <Users size={20} />
                  <span>
                    <strong>Acompanhar grupo</strong>
                    <small>Veja as equipes e slots do grupo</small>
                  </span>
                </button>
                {podeInscrever && data.autenticado && data.equipe ? (
                  <button className="invite-hub-option" type="button" onClick={() => setStep('escolher_line')}>
                    <UserPlus size={20} />
                    <span>
                      <strong>Nova inscrição</strong>
                      <small>Mesma equipe, outra line</small>
                    </span>
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {/* ——— ACOMPANHAR (público) ——— */}
          {step === 'acompanhar' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Slots do grupo</h2>
                {minhasParticipacoes.length ? (
                  <button className="button secondary" type="button" onClick={() => setStep('hub')}>
                    Minha equipe
                  </button>
                ) : null}
              </div>
              <p className="invite-section-copy">
                Toque em uma equipe inscrita para ver a line e os jogadores escalados.
              </p>
              {renderSlots()}

              {podeInscrever ? (
                <button
                  className="button invite-confirm"
                  type="button"
                  onClick={startInscricao}
                  style={{ width: '100%', marginTop: 16 }}
                >
                  <UserPlus size={16} />
                  Escalar minha equipe
                </button>
              ) : minhasParticipacoes.length ? (
                <button
                  className="button invite-confirm"
                  type="button"
                  onClick={() => setStep('hub')}
                  style={{ width: '100%', marginTop: 16 }}
                >
                  <Link2 size={16} />
                  Gerenciar escalação
                </button>
              ) : (
                <>
                  <p className="invite-section-copy" style={{ textAlign: 'center', marginTop: 16 }}>
                    {data.status_mensagem || 'Novas inscrições por este link estão encerradas.'}
                  </p>
                  {!data.autenticado ? (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setStep('login')}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      Entrar para gerenciar escalação
                    </button>
                  ) : (data.equipes_disponiveis || []).length > 0 || data.tem_equipe_inscrita_no_grupo ? (
                    <button
                      className="button invite-confirm"
                      type="button"
                      onClick={() => {
                        if ((data.equipes_disponiveis || []).length > 1) setStep('escolher_equipe')
                        else if (data.equipe?.id) void carregar({ equipeId: data.equipe.id })
                        else setStep('escolher_equipe')
                      }}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      <Link2 size={16} />
                      Gerenciar escalação da minha equipe
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* ——— ESCALAR ——— */}
          {step === 'escalar' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Escalar elenco</h2>
                <button className="button secondary" type="button" onClick={() => setStep('hub')}>
                  Voltar
                </button>
              </div>
              <p className="invite-section-copy">
                Gere um link de escalação para a line{' '}
                <strong>{selectedParticipacao?.line?.nome || selectedParticipacao?.nome_exibicao}</strong>.
              </p>
              {selectedParticipacao?.link_escalacao ? (
                <div className="invite-link-box">
                  <small>Link ativo</small>
                  <strong>
                    {typeof window !== 'undefined' ? window.location.origin : ''}
                    {selectedParticipacao.link_escalacao.public_path}
                  </strong>
                  <div className="invite-inline-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        copiar(
                          `${window.location.origin}${selectedParticipacao.link_escalacao!.public_path}`,
                          'Link de escalação copiado.',
                        )
                      }
                    >
                      <ClipboardCopy size={15} /> Copiar link
                    </button>
                  </div>
                </div>
              ) : null}
              {generated ? (
                <div className="invite-link-box">
                  <small>Novo link gerado</small>
                  <strong>{generated.link}</strong>
                  <div className="invite-inline-actions">
                    <button className="button" type="button" onClick={() => copiar(generated.link)}>
                      <ClipboardCopy size={15} /> Copiar link
                    </button>
                  </div>
                </div>
              ) : null}
              <button className="button invite-confirm" type="button" disabled={busy} onClick={() => void gerarLinkEscalacao()}>
                <UserPlus size={16} />
                {selectedParticipacao?.link_escalacao ? 'Gerar novo link' : 'Gerar link de escalação'}
              </button>
            </div>
          ) : null}

          {/* ——— JOGADORES ——— */}
          {step === 'jogadores' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Jogadores inscritos</h2>
                <button className="button secondary" type="button" onClick={() => setStep('hub')}>
                  Voltar
                </button>
              </div>
              {(selectedParticipacao?.jogadores || []).length === 0 ? (
                <p className="invite-empty">Nenhum jogador inscrito ainda.</p>
              ) : (
                <div className="invite-player-list">
                  {selectedParticipacao?.jogadores.map((player) => (
                    <div className="invite-player-row" key={player.id}>
                      <span className="invite-player-avatar">
                        {player.foto_url ? <img src={player.foto_url} alt="" /> : <Users size={16} />}
                      </span>
                      <div>
                        <strong>{player.nick}</strong>
                        <small>
                          {player.funcao || 'função'}
                          {player.id_jogo ? ` · ID ${player.id_jogo}` : ''}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {message ? <p className="invite-message">{message}</p> : null}
        </div>
      </main>

      {/* Detalhe público da line ao clicar no slot */}
      {detailVaga ? (
        <div className="invite-modal-backdrop" onClick={() => setDetailVaga(null)}>
          <section className="invite-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Slot {detailVaga.slot_letra}</p>
                <h2>{detailVaga.line_nome || detailVaga.equipe_nome || 'Equipe'}</h2>
                <span>{detailVaga.equipe_nome || 'Equipe'}</span>
              </div>
              <button type="button" onClick={() => setDetailVaga(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            {(detailVaga.jogadores || []).length === 0 ? (
              <p className="invite-empty">Nenhum jogador escalado ainda.</p>
            ) : (
              <div className="invite-player-list">
                {detailVaga.jogadores!.map((player) => (
                  <div className="invite-player-row" key={player.id}>
                    <span className="invite-player-avatar">
                      {player.foto_url ? <img src={player.foto_url} alt="" /> : <Users size={16} />}
                    </span>
                    <div>
                      <strong>{player.nick}</strong>
                      <small>
                        {player.funcao || 'função'}
                        {player.id_jogo ? ` · ID ${player.id_jogo}` : ''}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="button secondary" type="button" onClick={() => setDetailVaga(null)} style={{ width: '100%', marginTop: 12 }}>
              Fechar
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}
