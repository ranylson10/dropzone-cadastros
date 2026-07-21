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
import { buildProfileCreationHref } from '@/features/auth/auth-return'
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
  | 'inicio'
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
  const [step, setStep] = useState<Step>('inicio')
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('')
  const [generated, setGenerated] = useState<{ link: string; texto: string } | null>(null)
  const [detailVaga, setDetailVaga] = useState<Vaga | null>(null)
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [lastSlotChoice, setLastSlotChoice] = useState<{ label: string; occupied: boolean } | null>(null)
  const [chatReveal, setChatReveal] = useState<'slots' | 'slot_answer' | 'lines' | 'line_answer'>('slots')
  const [chatTyping, setChatTyping] = useState(false)
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
    slotsLivresLista.find((vaga) => vaga.slot_id === selectedSlotId) || null
  const selectedLine = linesDisponiveis.find((line) => line.id === lineId) || null
  const selectedLineLabel = selectedLine?.nome || nomeNovaLine.trim()
  const freeSlotLetters = slotsLivresLista
    .map((vaga) => vaga.slot_letra || String(vaga.slot_numero || '').trim())
    .filter(Boolean)

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

    if (!payload.autenticado) return 'inicio'
    // Manager / multi-equipe: escolher com qual pasta entrar
    if (!payload.equipe && (payload.equipes_disponiveis || []).length > 0) return 'escolher_equipe'
    if (!payload.equipe) return 'sem_equipe'
    if (hasInscrita && parts.length > 0) return 'hub'
    if (multi) return 'escolher_equipe'
    if (opts.justLoggedIn) return 'confirmar_equipe'
    return 'inicio'
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
    // Não pré-seleciona line: no chat, o usuário precisa responder a opção.
    setLineId('')
    setNomeNovaLine('')

    // Mantém slot escolhido se ainda estiver livre; senão deixa o usuário escolher na conversa.
    const freeSlots = (payload.vagas || []).filter((vaga: Vaga) => !vaga.ocupada && vaga.slot_id)
    const stillFree = freeSlots.some((vaga: Vaga) => vaga.slot_id === selectedSlotId)
    if (!stillFree) {
      setSelectedSlotId('')
    }
    setLastSlotChoice(null)
    setChatReveal('slots')
    setChatTyping(false)

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
    setChatReveal('slots')
    setChatTyping(false)
    setStep('escolher_line')
  }

  function escolherSlotPeloChat(vaga: Vaga) {
    const label = vaga.slot_letra || String(vaga.slot_numero || '').trim() || '?'
    const occupied = Boolean(vaga.ocupada || !vaga.slot_id)
    setLastSlotChoice({ label, occupied })
    setChatReveal('slots')
    setChatTyping(true)
    if (vaga.ocupada || !vaga.slot_id) {
      setSelectedSlotId('')
      setMessage(
        `Você escolheu o slot ${label}, mas ele está ocupado. Tente um livre. Agora estão livres: ${freeSlotLetters.join(', ') || 'nenhum'}.`,
      )
      window.setTimeout(() => {
        setChatTyping(false)
        setChatReveal('slot_answer')
      }, 650)
      return
    }
    setSelectedSlotId(String(vaga.slot_id))
    setLineId('')
    setNomeNovaLine('')
    setMessage(`Slot ${label} escolhido. Agora escolha uma line ou crie uma nova.`)
    window.setTimeout(() => {
      setChatReveal('slot_answer')
      window.setTimeout(() => {
        setChatTyping(false)
        setChatReveal('lines')
      }, 750)
    }, 650)
  }

  function escolherLinePeloChat(id: string) {
    setLineId(id)
    setChatReveal('lines')
    setChatTyping(true)
    if (id !== '__create__') {
      const line = linesDisponiveis.find((item) => item.id === id)
      setNomeNovaLine('')
      setMessage(`Line ${line?.nome || 'selecionada'} escolhida. Se estiver tudo certo, confirme a inscrição.`)
      window.setTimeout(() => {
        setChatTyping(false)
        setChatReveal('line_answer')
      }, 650)
      return
    }
    setMessage('Beleza. Me diga o nome da nova line para eu finalizar a inscrição.')
    window.setTimeout(() => {
      setChatTyping(false)
      setChatReveal('line_answer')
    }, 650)
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
      : step === 'inicio'
        ? 'Convite de inscrição'
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

  const isChatStep = step === 'inicio'
    || step === 'login'
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
        </div>
      </div>
    )
  }

  function UserBubble({ children }: { children: ReactNode }) {
    return (
      <div className="invite-chat-row user">
        <div className="invite-chat-bubble user">
          <div>{children}</div>
        </div>
      </div>
    )
  }

  function TypingBubble() {
    if (!busy && !payBusy && !chatTyping) return null
    return (
      <div className="invite-chat-row bot">
        <span className="invite-bot-avatar"><Bot size={18} /></span>
        <div className="invite-typing" aria-label="DropBot digitando">
          <span />
          <span />
          <span />
          <em>DropBot digitando...</em>
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

          {/* ——— INÍCIO DO CHAT ——— */}
          {step === 'inicio' ? (
            <div className="invite-auth-box invite-chat-shell" style={{ marginTop: 16 }}>
              <BotBubble>
                <p>Oi! Eu sou o DropBot 🤖</p>
                <p>Você recebeu um convite para o grupo <strong>{data.grupo?.nome}</strong> do campeonato <strong>{data.campeonato?.nome}</strong>.</p>
                <p>O que você quer fazer?</p>
              </BotBubble>
              <div className="invite-chat-actions">
                <button className="invite-chat-option primary" type="button" onClick={startInscricao}>
                  Quero inscrever minha equipe
                </button>
                <button className="invite-chat-option" type="button" onClick={() => setStep('acompanhar')}>
                  Só acompanhar as inscrições
                </button>
              </div>
            </div>
          ) : null}

          {/* ——— LOGIN (só 2 opções) ——— */}
          {step === 'login' ? (
            <div className="invite-auth-box invite-chat-shell" style={{ marginTop: 16 }}>
              <UserBubble><p>Quero inscrever minha equipe</p></UserBubble>
              <BotBubble>
                {podeInscrever ? (
                  <>
                    <p>Verifiquei aqui: você ainda não está logado em nenhuma conta de equipe.</p>
                    <p>Entre com Google para eu identificar sua equipe. Se ainda não tiver uma, eu te levo para cadastrar.</p>
                  </>
                ) : (
                  <>
                    <p>Esse link não aceita novas inscrições agora.</p>
                    <p>Se sua equipe já está no grupo, entre com Google para escalar o elenco.</p>
                  </>
                )}
              </BotBubble>
              <SocialLogin profileType="equipe" returnTo={returnTo} />
              <button
                className="invite-chat-option"
                type="button"
                onClick={() => setStep('acompanhar')}
              >
                Só acompanhar as inscrições
              </button>
              <TypingBubble />
            </div>
          ) : null}

          {/* ——— SEM EQUIPE ——— */}
          {step === 'sem_equipe' ? (
            <div className="invite-auth-box invite-chat-shell" style={{ marginTop: 16 }}>
              <UserBubble><p>Quero inscrever minha equipe</p></UserBubble>
              <BotBubble>
                {data.papel_sessao === 'manager' ? (
                  <p>Você entrou como manager, mas ainda não controla nenhuma equipe. Cadastre ou aceite uma equipe para continuar.</p>
                ) : (
                  <>
                    <p>Seu Google entrou certinho.</p>
                    <p>Mas ainda não encontrei uma <strong>equipe cadastrada</strong> nessa conta.</p>
                    <p>Cadastre sua equipe e depois eu continuo a inscrição.</p>
                  </>
                )}
              </BotBubble>
              <a className="invite-chat-option primary" href={buildProfileCreationHref('equipe', returnTo)}>
                Cadastrar minha equipe
              </a>
              <SocialLogin profileType={data.papel_sessao === 'manager' ? 'manager' : 'equipe'} returnTo={returnTo} />
              <button className="invite-chat-option" type="button" onClick={() => setStep('acompanhar')}>
                Só acompanhar
              </button>
              <TypingBubble />
            </div>
          ) : null}

          {/* ——— MANAGER / MULTI-EQUIPE: escolher pasta ——— */}
          {step === 'escolher_equipe' ? (
            <div className="invite-section invite-chat-shell" style={{ marginTop: 16 }}>
              <UserBubble><p>Quero inscrever minha equipe</p></UserBubble>
              <BotBubble>
                {data.papel_sessao === 'manager' ? (
                  <>
                    <p>Você entrou como <strong>manager</strong>.</p>
                    <p>{!inscricaoAberta ? 'Escolha a equipe inscrita neste grupo para gerenciar a escalação.' : 'Escolha com qual equipe deseja se inscrever neste campeonato.'}</p>
                  </>
                ) : (
                  <p>{!inscricaoAberta ? 'Você controla mais de uma equipe. Escolha a inscrita neste grupo para gerenciar a escalação.' : 'Você controla mais de uma equipe. Com qual deseja entrar?'}</p>
                )}
              </BotBubble>
              <div className="invite-chat-options">
                {(data.equipes_disponiveis || [])
                  .slice()
                  .sort((a, b) => Number(Boolean(b.inscrita_no_grupo)) - Number(Boolean(a.inscrita_no_grupo)))
                  .map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    className="invite-chat-option"
                    onClick={() => void escolherEquipe(eq.id)}
                    disabled={busy}
                  >
                    {eq.inscrita_no_grupo ? 'Gerenciar ' : 'Usar '}
                    {eq.nome}
                    {eq.papel ? ` · ${eq.papel === 'dono' ? 'Dono' : 'Staff'}` : ''}
                  </button>
                ))}
              </div>
              {data.equipe && inscricaoAberta ? (
                <button type="button" className="invite-chat-option" onClick={() => setStep('escolher_line')}>
                  Continuar com {data.equipe.nome}
                </button>
              ) : null}
              <button className="invite-chat-option" type="button" onClick={() => setStep('acompanhar')}>
                Só acompanhar
              </button>
              <TypingBubble />
            </div>
          ) : null}

          {/* ——— CONFIRMAR EQUIPE (só sessão já existente ao abrir o link) ——— */}
          {step === 'confirmar_equipe' && data.equipe ? (
            <div className="invite-auth-box invite-chat-shell" style={{ marginTop: 16 }}>
              <UserBubble><p>Quero inscrever minha equipe</p></UserBubble>
              <BotBubble>
                <p>Você está logado com a equipe <strong>{data.equipe.nome}</strong>.</p>
                <p>Quer inscrever essa equipe no grupo <strong>{data.grupo?.nome}</strong>?</p>
              </BotBubble>
              <UserBubble>
                <p>{data.equipe.nome}</p>
              </UserBubble>
              <button className="invite-chat-option primary" type="button" onClick={confirmarEstaEquipe}>
                Sim, inscrever {data.equipe.nome}
              </button>
              <SocialLogin profileType="equipe" returnTo={returnTo} />
              <button className="invite-chat-option" type="button" onClick={() => setStep('acompanhar')}>
                Só acompanhar
              </button>
              <TypingBubble />
            </div>
          ) : null}

          {/* ——— ESCOLHER SLOT + LINE ——— */}
          {step === 'escolher_line' ? (
            <div className="invite-section invite-chat-shell invite-chat-flow" style={{ marginTop: 12 }}>
              <UserBubble><p>Sim, quero inscrever a {data.equipe?.nome}</p></UserBubble>
              <BotBubble>
                <p>Fechado. Escolha um slot livre para a <strong>{data.equipe?.nome}</strong>.</p>
              </BotBubble>

              {(data.vagas || []).length ? (
                <div className="invite-chat-row bot">
                  <span className="invite-bot-avatar"><Bot size={18} /></span>
                  <div className="invite-chat-bubble invite-chat-list-bubble">
                    <strong>DropBot</strong>
                    <p>Slots do grupo {data.grupo?.nome}</p>
                    <div className="invite-chat-slot-list">
                      {(data.vagas || []).map((vaga) => {
                        const active = selectedSlotId === vaga.slot_id
                        const label = vaga.slot_letra || vaga.slot_numero || vaga.index + 1
                        return (
                          <button
                            type="button"
                            key={vaga.slot_id || vaga.index}
                            className={`invite-chat-slot ${vaga.ocupada ? 'occupied' : 'free'} ${active ? 'selected' : ''}`}
                            onClick={() => escolherSlotPeloChat(vaga)}
                            title={vaga.ocupada ? `Slot ${label} ocupado` : `Escolher slot ${label}`}
                          >
                            {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
                            <strong>{label}</strong>
                            <span>{vaga.ocupada ? 'ocupado' : active ? 'ok' : 'livre'}</span>
                          </button>
                        )
                      })}
                    </div>
                    <small className="invite-chat-hint">
                      Livres agora: {freeSlotLetters.join(', ') || 'nenhum slot disponível'}
                    </small>
                  </div>
                </div>
              ) : (
                <BotBubble><p>Nenhum slot foi configurado neste grupo ainda.</p></BotBubble>
              )}

              {lastSlotChoice ? (
                <UserBubble><p>Escolho o slot {lastSlotChoice.label}</p></UserBubble>
              ) : null}

              <TypingBubble />

              {lastSlotChoice && (chatReveal === 'slot_answer' || chatReveal === 'lines' || chatReveal === 'line_answer') ? (
                <BotBubble>
                  <p>
                    {lastSlotChoice.occupied
                      ? `Esse slot ${lastSlotChoice.label} já está ocupado. Escolha outro livre: ${freeSlotLetters.join(', ') || 'nenhum'}.`
                      : `Boa. Slot ${lastSlotChoice.label} selecionado.`}
                  </p>
                </BotBubble>
              ) : null}

              {selectedSlot && (chatReveal === 'lines' || chatReveal === 'line_answer') && linesJaNoCampeonato.length ? (
                <BotBubble>
                  <p>Agora precisamos escolher uma line.</p>
                  <p>Essas aqui já estão no campeonato e não podem ser inscritas de novo:</p>
                  <p><strong>{linesJaNoCampeonato.map((l) => l.nome).filter(Boolean).join(', ')}</strong></p>
                </BotBubble>
              ) : null}

              {selectedSlot && (chatReveal === 'lines' || chatReveal === 'line_answer') ? (
                <div className="invite-chat-row bot">
                  <span className="invite-bot-avatar"><Bot size={18} /></span>
                  <div className="invite-chat-bubble invite-chat-list-bubble">
                    <strong>DropBot</strong>
                    {linesDisponiveis.length ? (
                      <p>Você pode inscrever uma dessas lines livres ou criar uma nova:</p>
                    ) : (
                      <p>Não encontrei line livre nessa equipe. Crie uma nova para continuar:</p>
                    )}
                    <div className="invite-chat-options">
                    {linesDisponiveis.map((line) => (
                      <button
                        key={line.id}
                        type="button"
                        className={`invite-chat-option ${lineId === line.id ? 'selected' : ''}`}
                        onClick={() => escolherLinePeloChat(line.id)}
                      >
                        {line.nome}
                      </button>
                    ))}
                      <button
                        type="button"
                        className={`invite-chat-option ${lineId === '__create__' ? 'selected' : ''}`}
                        onClick={() => escolherLinePeloChat('__create__')}
                      >
                        + Criar nova line
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedLine ? (
                <UserBubble><p>Vai ser a line {selectedLine.nome}</p></UserBubble>
              ) : null}

              {selectedSlot && chatReveal === 'line_answer' && (!lineId || lineId === '__create__') ? (
                <>
                  <UserBubble><p>Quero criar uma nova line</p></UserBubble>
                  <BotBubble>
                    <p>Perfeito. Digite o nome da nova line. Exemplo: <strong>ALOE ELITE 2</strong>.</p>
                    <label className="invite-chat-input">
                      <span>Nome da line</span>
                      <input
                        value={nomeNovaLine}
                        onChange={(e) => setNomeNovaLine(e.target.value)}
                        placeholder="Ex.: ALOE ELITE 2"
                        autoFocus={!linesDisponiveis.length || lineId === '__create__'}
                      />
                    </label>
                  </BotBubble>
                </>
              ) : null}

              {selectedSlot && chatReveal === 'line_answer' && selectedLineLabel ? (
                <>
                  <BotBubble>
                    <p>Resumo antes de confirmar:</p>
                    <p>
                      Equipe: <strong>{data.equipe?.nome}</strong><br />
                      Grupo: <strong>{data.grupo?.nome}</strong><br />
                      Slot: <strong>{selectedSlot.slot_letra || selectedSlot.slot_numero}</strong><br />
                      Line: <strong>{selectedLineLabel}</strong>
                    </p>
                    <p>Posso finalizar sua inscrição?</p>
                  </BotBubble>
                  <div className="invite-chat-actions">
                    <button
                      className="invite-chat-option primary"
                      type="button"
                      disabled={busy || (slotsLivresLista.length > 0 && !selectedSlotId)}
                      onClick={() => void confirmarInscricao()}
                    >
                      {busy ? 'Confirmando...' : 'Sim, confirmar inscrição'}
                    </button>
                    <button
                      className="invite-chat-option"
                      type="button"
                      onClick={() => setStep('acompanhar')}
                    >
                      Só acompanhar por enquanto
                    </button>
                  </div>
                </>
              ) : null}

              <TypingBubble />
            </div>
          ) : null}

          {/* ——— SUCESSO ——— */}
          {step === 'sucesso' ? (
            <div className="invite-auth-box invite-chat-shell" style={{ marginTop: 16 }}>
              <BotBubble>
                <p>Pronto, inscrição confirmada ✅</p>
                <p>Guarde o comprovante abaixo. Boa sorte no campeonato!</p>
              </BotBubble>
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
