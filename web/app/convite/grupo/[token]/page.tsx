'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCopy,
  Link2,
  ListChecks,
  LogIn,
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
  grupo?: { id: string; nome: string }
  vagas?: Vaga[]
  equipes_esperadas?: Array<{ nome: string; disponivel: boolean }>
  equipes_esperadas_disponiveis?: string[]
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
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita: boolean }>
  lines_disponiveis?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita?: boolean }>
  lines_inscritas?: Array<{ id: string; nome: string; slot_numero?: number | null; nome_exibicao?: string | null }>
  total_lines_inscritas_campeonato?: number
  minhas_participacoes?: Participacao[]
}

/** login → confirmar equipe → escolher slot → hub/acompanhamento */
type Step = 'login' | 'sem_equipe' | 'confirmar_equipe' | 'inscricao' | 'hub' | 'acompanhar' | 'escalar' | 'jogadores'

export default function ConviteGrupoPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const returnTo = `/convite/grupo/${encodeURIComponent(token)}`

  const [data, setData] = useState<GroupInvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<Step>('login')
  const [equipeConfirmada, setEquipeConfirmada] = useState(false)
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('')
  const [generated, setGenerated] = useState<{ link: string; texto: string } | null>(null)

  const [slotModal, setSlotModal] = useState<Vaga | null>(null)
  const [referenciaEquipe, setReferenciaEquipe] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')

  /** Só lines livres no campeonato — nunca listar as já inscritas (evita erro do usuário). */
  const linesDisponiveis = useMemo(() => {
    const free = data?.lines_disponiveis?.length
      ? data.lines_disponiveis
      : (data?.lines || []).filter((line) => !line.ja_inscrita)
    return free.filter((line) => !line.ja_inscrita)
  }, [data?.lines, data?.lines_disponiveis])
  const minhasParticipacoes = data?.minhas_participacoes || []
  const selectedParticipacao =
    minhasParticipacoes.find((item) => item.id === selectedParticipacaoId) || minhasParticipacoes[0] || null
  const inscricaoAberta = data?.inscricao_aberta !== false && data?.modo !== 'acompanhamento'
  const canInscrever = Boolean(data?.autenticado && data?.equipe && equipeConfirmada && inscricaoAberta)
  const equipesDisponiveis = data?.equipes_esperadas_disponiveis || []
  const slotsLivres = Number(data?.resumo_grupo?.livres || 0)
  const podeNovaInscricao = canInscrever && slotsLivres > 0 && (data?.resumo_link?.restantes ?? 1) > 0

  /**
   * Ordem fixa (link aberto):
   * login → sem equipe / criar → confirmar equipe → inscrição (slot+line) → hub (só após inscrever ou se pedir)
   * Nunca pular pro hub só porque já existe participação antiga.
   */
  function resolveStep(
    payload: GroupInvitePayload,
    confirmed: boolean,
    opts?: { preferHub?: boolean },
  ): Step {
    const hasSession = Boolean(payload.autenticado)
    const parts = payload.minhas_participacoes || []
    const open = payload.inscricao_aberta !== false && payload.modo !== 'acompanhamento'

    // Link esgotado/pausado: acompanhamento (ou hub se já inscreveu e pediu)
    if (!open) {
      if (opts?.preferHub && hasSession && parts.length > 0) return 'hub'
      return 'acompanhar'
    }

    if (!hasSession) return 'login'
    if (!payload.equipe) return 'sem_equipe'
    if (!confirmed) return 'confirmar_equipe'

    // Só vai ao hub se a inscrição acabou de concluir (preferHub)
    if (opts?.preferHub && parts.length > 0) return 'hub'
    return 'inscricao'
  }

  async function carregar(opts?: { preferHub?: boolean; keepConfirm?: boolean }) {
    setLoading(true)
    setMessage('')
    const { data: sessionData } = await supabase.auth.getSession()

    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
      cache: 'no-store',
    })
    const payload: GroupInvitePayload = await response.json()
    setData(payload)

    // Token inválido de verdade
    if (!response.ok && payload.error && !payload.campeonato) {
      setLoading(false)
      return
    }

    const parts: Participacao[] = payload.minhas_participacoes || []
    if (parts[0]?.id) setSelectedParticipacaoId(parts[0].id)

    const confirmed = Boolean(opts?.keepConfirm && equipeConfirmada)
    if (!opts?.keepConfirm && !opts?.preferHub) setEquipeConfirmada(false)

    // Após inscrição bem-sucedida: mantém equipe confirmada e abre hub
    if (opts?.preferHub && payload.autenticado && payload.equipe) {
      setEquipeConfirmada(true)
    }

    const next = resolveStep(
      payload,
      confirmed || Boolean(opts?.preferHub && payload.equipe),
      { preferHub: opts?.preferHub },
    )
    setStep(next)

    const freeLines = (payload.lines_disponiveis || []).filter((line: any) => !line.ja_inscrita)
    setLineId(freeLines[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
  }, [token])

  function openSlot(vaga: Vaga) {
    if (vaga.ocupada) return
    if (!inscricaoAberta) {
      setMessage(data?.status_mensagem || 'Este link não aceita mais inscrições. Você pode só acompanhar o grupo.')
      return
    }
    if (!data?.autenticado) {
      setStep('login')
      setMessage('Entre com uma conta para se inscrever.')
      return
    }
    if (!data.equipe) {
      setStep('sem_equipe')
      return
    }
    if (!equipeConfirmada) {
      setStep('confirmar_equipe')
      setMessage('Confirme a equipe que vai se inscrever.')
      return
    }
    setSlotModal(vaga)
    setReferenciaEquipe(equipesDisponiveis[0] || '')
    // Só lines livres — se não houver, força criar nova
    if (linesDisponiveis[0]) {
      setLineId(linesDisponiveis[0].id)
      setNomeNovaLine('')
    } else {
      setLineId('')
      setNomeNovaLine('')
    }
    setMessage('')
  }

  function confirmarEstaEquipe() {
    setEquipeConfirmada(true)
    setMessage('')
    // Depois de confirmar a equipe, sempre vai para inscrição (slot + line livre)
    setStep('inscricao')
  }

  async function confirmarInscricao() {
    if (!slotModal?.slot_id) return setMessage('Slot inválido.')
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setStep('login')
      return setMessage('Entre com sua conta de equipe para continuar.')
    }
    if (!data?.equipe) {
      setStep('sem_equipe')
      return
    }
    if ((data.equipes_esperadas || []).length && !referenciaEquipe.trim()) {
      return setMessage('Selecione qual equipe da lista você está representando.')
    }
    if (!lineId && !nomeNovaLine.trim()) {
      return setMessage('Selecione uma line livre ou crie uma nova line para esta vaga.')
    }

    let resolvedLineId = lineId || null
    let resolvedNomeLine = lineId ? null : nomeNovaLine.trim()
    if (!resolvedLineId && resolvedNomeLine) {
      const freeMatch = linesDisponiveis.find(
        (line) => String(line.nome || '').trim().toLowerCase() === resolvedNomeLine!.toLowerCase(),
      )
      if (freeMatch) {
        resolvedLineId = freeMatch.id
        resolvedNomeLine = null
      } else {
        const enrolled = (data?.lines || []).find(
          (line) =>
            line.ja_inscrita &&
            String(line.nome || '').trim().toLowerCase() === resolvedNomeLine!.toLowerCase(),
        )
        if (enrolled) {
          return setMessage(
            `A line "${enrolled.nome}" já está neste campeonato. Cada vaga precisa de outra line — crie uma nova (ex.: ${enrolled.nome} 2).`,
          )
        }
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
        slot_id: slotModal.slot_id,
        vaga_index: slotModal.index,
        referencia_equipe: referenciaEquipe || null,
        line_id: resolvedLineId,
        nome_line: resolvedNomeLine,
      }),
    })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(payload.error || 'Não foi possível entrar no grupo.')

    setSlotModal(null)
    setEquipeConfirmada(true)
    setMessage(
      payload.mensagem ||
        `${payload.line?.nome || 'Line'} entrou no slot ${payload.slot_letra || ''}.`,
    )
    // Direciona para acompanhamento (hub)
    await carregar({ preferHub: true, keepConfirm: true })
    setStep('hub')
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
      await carregar({ preferHub: true, keepConfirm: true })
      setStep('escalar')
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

  function renderSlots(opts?: { clickableWhenFree?: boolean }) {
    const clickableWhenFree = opts?.clickableWhenFree ?? false
    return (
      <div className="lineup-slots public-lineup-slots invite-slot-grid">
        {(data?.vagas || []).map((vaga) => {
          const clickable = !vaga.ocupada && clickableWhenFree && podeNovaInscricao
          return (
            <button
              type="button"
              key={vaga.slot_id || vaga.index}
              className={`lineup-slot invite-slot-button ${vaga.ocupada ? 'occupied' : 'free'} ${clickable ? 'clickable' : ''}`}
              onClick={() => (clickable ? openSlot(vaga) : undefined)}
              disabled={!clickable}
              title={
                vaga.ocupada
                  ? 'Slot ocupado'
                  : clickable
                    ? `Escolher slot ${vaga.slot_letra}`
                    : `Slot ${vaga.slot_letra}`
              }
            >
              <b>{vaga.slot_letra || vaga.index + 1}</b>
              {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
              <div>
                <strong>
                  {vaga.ocupada
                    ? vaga.line_nome || vaga.referencia_equipe || vaga.equipe_nome || 'Ocupado'
                    : `Slot ${vaga.slot_letra}`}
                </strong>
                <span>
                  {vaga.ocupada
                    ? `${vaga.equipe_nome || 'Equipe'}${vaga.referencia_equipe ? ` · ${vaga.referencia_equipe}` : ''}`
                    : clickable
                      ? 'Toque para escolher'
                      : 'Disponível'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  if (loading) return <DropzoneLoader label="Carregando link de equipes" />

  // Token inexistente / erro fatal sem dados de campeonato
  if (!data || (data.error && !data.campeonato)) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Link inválido</h1>
          <p>{data?.error || 'Não foi possível carregar este link.'}</p>
          <a className="button invite-confirm" href="/">
            Ir para o painel
          </a>
        </div>
      </main>
    )
  }

  const showHubChrome = step === 'hub' || step === 'acompanhar' || step === 'escalar' || step === 'jogadores'

  return (
    <>
      <main className="invite-page">
        <div className={`invite-card ${showHubChrome ? 'invite-hub-card' : ''}`}>
          {data.campeonato?.logo_url ? (
            <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          ) : showHubChrome && minhasParticipacoes.length ? (
            <CheckCircle2 size={42} />
          ) : (
            <Users size={42} />
          )}

          <p className="eyebrow">
            {!inscricaoAberta
              ? 'Acompanhamento do grupo'
              : step === 'login'
                ? 'Entrada de equipes'
                : step === 'sem_equipe'
                  ? 'Perfil de equipe'
                  : step === 'confirmar_equipe'
                    ? 'Confirmar equipe'
                    : step === 'hub'
                      ? minhasParticipacoes.length > 1
                        ? `${minhasParticipacoes.length} lines inscritas`
                        : 'Equipe inscrita'
                      : 'Escolha o slot'}
          </p>
          <h1>{data.campeonato?.nome}</h1>
          <p>
            {data.grupo?.nome}
            {data.equipe ? ` · ${data.equipe.nome}` : ''}
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

          {!inscricaoAberta && data.status_mensagem ? (
            <p className="invite-section-copy" style={{ textAlign: 'center', marginTop: 6 }}>
              {data.status_mensagem} Você pode acompanhar o grupo abaixo.
            </p>
          ) : null}

          {/* ——— 1) LOGIN ——— */}
          {step === 'login' ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <LogIn size={22} />
              <p>
                Para inscrever uma equipe você precisa estar <strong>logado</strong>.
                Escolha como deseja entrar:
              </p>
              <SocialLogin profileType="equipe" returnTo={returnTo} />
              <a
                className="button secondary"
                href={buildLoginHref('equipe', returnTo)}
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
              >
                Entrar com e-mail e senha
              </a>
              <p className="invite-section-copy" style={{ textAlign: 'center', marginTop: 12 }}>
                Depois do login, se ainda não tiver perfil de <strong>equipe</strong>, o cadastro abre automaticamente.
              </p>
              {!inscricaoAberta ? (
                <button className="button secondary" type="button" onClick={() => setStep('acompanhar')} style={{ width: '100%' }}>
                  Só acompanhar o grupo (sem login)
                </button>
              ) : null}
            </div>
          ) : null}

          {/* ——— 2) SEM EQUIPE ——— */}
          {step === 'sem_equipe' ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <Shield size={22} />
              <p>
                Seu login está ativo, mas ainda <strong>não tem conta de equipe</strong>.
                Para se inscrever no campeonato é obrigatório ter uma equipe (pasta) com lines.
              </p>
              <a className="button invite-confirm" href={buildProfileCreationHref('equipe', returnTo)}>
                Criar perfil de equipe
              </a>
              <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                Usar outra conta
              </a>
            </div>
          ) : null}

          {/* ——— 3) CONFIRMAR EQUIPE ——— */}
          {step === 'confirmar_equipe' && data.equipe ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <div className="invite-current-team" style={{ width: '100%' }}>
                <small>Equipe logada</small>
                <strong>{data.equipe.nome}</strong>
                <span>{data.equipe.tag ? `Tag ${data.equipe.tag}` : 'Sem tag'}</span>
              </div>
              <p>
                Deseja inscrever <strong>esta conta de equipe</strong> no campeonato?
              </p>
              <button className="button invite-confirm" type="button" onClick={confirmarEstaEquipe}>
                Sim, usar {data.equipe.nome}
              </button>
              <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                Não, entrar com outra conta
              </a>
              <a className="button secondary" href={buildProfileCreationHref('equipe', returnTo)}>
                Criar / vincular outra equipe
              </a>
            </div>
          ) : null}

          {/* ——— 4) INSCRIÇÃO: escolher slot + line (só livres) ——— */}
          {step === 'inscricao' ? (
            <>
              <div className="invite-current-team" style={{ marginTop: 12, marginBottom: 10 }}>
                <small>Inscrevendo a equipe</small>
                <strong>{data.equipe?.nome}</strong>
                <span>
                  Toque em um slot livre, escolha a line e confirme.
                  {minhasParticipacoes.length
                    ? ` Você já tem ${minhasParticipacoes.length} line(s) neste grupo — use outra line livre se for nova vaga.`
                    : ''}
                </span>
              </div>
              <p className="invite-section-copy" style={{ textAlign: 'center', marginBottom: 8 }}>
                Só entram lines que <strong>ainda não estão</strong> no campeonato.
              </p>
              {renderSlots({ clickableWhenFree: true })}
              {minhasParticipacoes.length ? (
                <button className="button secondary" type="button" onClick={() => setStep('hub')} style={{ width: '100%', marginTop: 12 }}>
                  Já me inscrevi — ir ao acompanhamento
                </button>
              ) : null}
              <button
                className="button secondary"
                type="button"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => {
                  setEquipeConfirmada(false)
                  setStep('confirmar_equipe')
                }}
              >
                Trocar equipe
              </button>
            </>
          ) : null}

          {/* ——— 5) HUB pós-inscrição ——— */}
          {step === 'hub' ? (
            <>
              {minhasParticipacoes.length > 1 ? (
                <label className="field">
                  <span>Line inscrita</span>
                  <select value={selectedParticipacao?.id || ''} onChange={(e) => setSelectedParticipacaoId(e.target.value)}>
                    {minhasParticipacoes.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.nome_exibicao}
                        {part.slot_numero ? ` · slot ${part.slot_numero}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : selectedParticipacao ? (
                <div className="invite-current-team">
                  <small>Line confirmada</small>
                  <strong>{selectedParticipacao.nome_exibicao}</strong>
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
                {podeNovaInscricao ? (
                  <button className="invite-hub-option invite-hub-option-primary" type="button" onClick={() => setStep('inscricao')}>
                    <UserPlus size={20} />
                    <span>
                      <strong>Nova inscrição</strong>
                      <small>Mesma equipe, outra line em outro slot</small>
                    </span>
                  </button>
                ) : null}
                <button className="invite-hub-option" type="button" onClick={() => setStep('acompanhar')}>
                  <Users size={20} />
                  <span>
                    <strong>Acompanhar grupo</strong>
                    <small>Veja as equipes e slots do grupo</small>
                  </span>
                </button>
                {selectedParticipacao ? (
                  <>
                    <button className="invite-hub-option" type="button" onClick={() => setStep('escalar')}>
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
              </div>
            </>
          ) : null}

          {/* ——— ACOMPANHAR (também modo link esgotado) ——— */}
          {step === 'acompanhar' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Slots do grupo</h2>
                {minhasParticipacoes.length || canInscrever ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setStep(minhasParticipacoes.length ? 'hub' : 'inscricao')}
                  >
                    Voltar
                  </button>
                ) : null}
              </div>
              {!inscricaoAberta ? (
                <p className="invite-section-copy">Modo somente acompanhamento — novas inscrições por este link estão encerradas.</p>
              ) : null}
              {renderSlots({ clickableWhenFree: inscricaoAberta && equipeConfirmada })}
              {podeNovaInscricao ? (
                <button className="button invite-confirm" type="button" onClick={() => setStep('inscricao')} style={{ width: '100%', marginTop: 12 }}>
                  <UserPlus size={16} />
                  Nova inscrição
                </button>
              ) : null}
              {!data.autenticado && inscricaoAberta ? (
                <button className="button" type="button" onClick={() => setStep('login')} style={{ width: '100%', marginTop: 10 }}>
                  Entrar para se inscrever
                </button>
              ) : null}
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
                Gere um link de escalação para a line <strong>{selectedParticipacao?.nome_exibicao}</strong>.
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

      {slotModal ? (
        <div className="invite-modal-backdrop" onClick={() => !busy && setSlotModal(null)}>
          <section className="invite-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Inscrição no grupo</p>
                <h2>Slot {slotModal.slot_letra}</h2>
                <span>
                  Equipe <strong>{data.equipe?.nome}</strong>. Escolha a <strong>line</strong> que vai jogar neste assento.
                </span>
              </div>
              <button type="button" onClick={() => setSlotModal(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            {(data.equipes_esperadas || []).length ? (
              <label className="field">
                <span>Sua vaga de referência na lista do organizador</span>
                <select value={referenciaEquipe} onChange={(e) => setReferenciaEquipe(e.target.value)}>
                  <option value="">Selecione a referência combinada (ex.: TEAM SIX)</option>
                  {equipesDisponiveis.length === 0 ? (
                    <option value="" disabled>
                      Todas as referências já foram usadas
                    </option>
                  ) : (
                    equipesDisponiveis.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))
                  )}
                </select>
                <small style={{ display: 'block', marginTop: 6, color: '#667085' }}>
                  Não precisa ser o nome da sua conta — é a etiqueta da vaga que o admin combinou com você.
                </small>
              </label>
            ) : null}

            {/* Nunca listamos lines já no campeonato — só livres ou criar nova */}
            {linesDisponiveis.length ? (
              <label className="field">
                <span>Line livre (ainda não está no campeonato)</span>
                <select
                  value={lineId}
                  onChange={(e) => {
                    setLineId(e.target.value)
                    setNomeNovaLine('')
                  }}
                >
                  {linesDisponiveis.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.nome}
                    </option>
                  ))}
                  <option value="">+ Criar nova line para esta vaga</option>
                </select>
              </label>
            ) : (
              <div className="invite-lines-note">
                <small>Criar line</small>
                <p>
                  Todas as lines desta equipe já estão no campeonato (ou você ainda não tem line).
                  Crie uma <strong>nova line</strong> para esta vaga — lines já inscritas não aparecem de propósito.
                </p>
              </div>
            )}

            {!lineId ? (
              <label className="field">
                <span>Nome da nova line</span>
                <input
                  value={nomeNovaLine}
                  onChange={(e) => setNomeNovaLine(e.target.value)}
                  placeholder="Ex.: ALOE ELITE"
                  autoFocus={!linesDisponiveis.length}
                />
              </label>
            ) : null}

            {message ? <p className="invite-message">{message}</p> : null}

            <div className="invite-inline-actions">
              <button className="button secondary" type="button" disabled={busy} onClick={() => setSlotModal(null)}>
                Cancelar
              </button>
              <button className="button" type="button" disabled={busy} onClick={() => void confirmarInscricao()}>
                {busy ? 'Confirmando...' : `Confirmar no slot ${slotModal.slot_letra}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
