'use client'

import { useEffect, useMemo, useState } from 'react'
import {
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

type ViewMode = 'entrada' | 'hub' | 'acompanhar' | 'escalar' | 'jogadores'

const GUEST_KEY = 'dropzone_grupo_guest'

export default function ConviteGrupoPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const returnTo = `/convite/grupo/${encodeURIComponent(token)}`

  const [data, setData] = useState<GroupInvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [gate, setGate] = useState(true)
  const [guest, setGuest] = useState(false)
  const [view, setView] = useState<ViewMode>('entrada')
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('')
  const [generated, setGenerated] = useState<{ link: string; texto: string } | null>(null)

  // Modal de inscrição por slot (letra)
  const [slotModal, setSlotModal] = useState<Vaga | null>(null)
  const [referenciaEquipe, setReferenciaEquipe] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')

  // 1 line = 1 vaga no campeonato. So mostra lines ainda livres.
  const linesDisponiveis = useMemo(() => {
    if (data?.lines_disponiveis?.length) return data.lines_disponiveis
    return (data?.lines || []).filter((line) => !line.ja_inscrita)
  }, [data?.lines, data?.lines_disponiveis])
  const linesInscritas = data?.lines_inscritas || []
  const minhasParticipacoes = data?.minhas_participacoes || []
  const selectedParticipacao =
    minhasParticipacoes.find((item) => item.id === selectedParticipacaoId) || minhasParticipacoes[0] || null
  const canManage = Boolean(data?.autenticado && data?.equipe)
  const equipesDisponiveis = data?.equipes_esperadas_disponiveis || []
  // Mesma pasta (equipe) pode ter várias vagas no grupo — 1 line por vaga.
  const slotsLivres = Number(data?.resumo_grupo?.livres || 0)
  const podeNovaInscricao = canManage && slotsLivres > 0

  function irParaNovaInscricao() {
    setMessage('')
    setSlotModal(null)
    setView('entrada')
  }

  async function carregar(opts?: { preferHub?: boolean }) {
    setLoading(true)
    setMessage('')
    const { data: sessionData } = await supabase.auth.getSession()
    const hasSession = Boolean(sessionData.session)
    const isGuest = sessionStorage.getItem(`${GUEST_KEY}:${token}`) === '1'
    setGuest(isGuest && !hasSession)
    setGate(!hasSession && !isGuest)

    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
      cache: 'no-store',
    })
    const payload = await response.json()
    setData(payload)

    const parts: Participacao[] = payload.minhas_participacoes || []
    if (parts[0]?.id) setSelectedParticipacaoId(parts[0].id)

    if (opts?.preferHub || (payload.inscrita && hasSession)) setView('hub')
    else setView('entrada')

    const freeLines =
      payload.lines_disponiveis ||
      (payload.lines || []).filter((line: any) => !line.ja_inscrita)
    setLineId(freeLines[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
  }, [token])

  // Login social sem perfil de equipe: manda direto para o formulario de criacao.
  // Sem equipe nao existe line; sem line nao entra no campeonato.
  useEffect(() => {
    if (loading || !data) return
    if (data.error) return
    if (!data.autenticado) return
    if (data.equipe) return
    const href = buildProfileCreationHref('equipe', returnTo)
    window.location.replace(href)
  }, [loading, data?.autenticado, data?.equipe, data?.error, returnTo, token])

  function continueAsGuest() {
    sessionStorage.setItem(`${GUEST_KEY}:${token}`, '1')
    setGuest(true)
    setGate(false)
  }

  function openSlot(vaga: Vaga) {
    if (vaga.ocupada) return
    if (data?.resumo_link && data.resumo_link.restantes <= 0) {
      setMessage('Este link esgotou as vagas. Peça um novo link ao organizador.')
      return
    }
    if (!data?.autenticado) {
      setGate(true)
      setMessage('Entre com uma conta de equipe para escolher um slot e se inscrever.')
      return
    }
    if (!data.equipe) {
      setMessage('Esta página é exclusiva para perfil de equipe. Crie ou vincule uma equipe para continuar.')
      return
    }
    setSlotModal(vaga)
    setReferenciaEquipe(equipesDisponiveis[0] || '')
    // Se nao ha line livre, forca criacao de nova line para esta vaga.
    if (linesDisponiveis[0]) {
      setLineId(linesDisponiveis[0].id)
      setNomeNovaLine('')
    } else {
      setLineId('')
      setNomeNovaLine('')
    }
    setMessage('')
  }

  async function confirmarInscricao() {
    if (!slotModal?.slot_id) return setMessage('Slot invalido.')
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setGate(true)
      return setMessage('Entre com sua conta de equipe para continuar.')
    }
    if (!data?.equipe) return setMessage('E necessario um perfil de equipe para se inscrever.')
    if ((data.equipes_esperadas || []).length && !referenciaEquipe.trim()) {
      return setMessage('Selecione qual equipe da lista voce esta representando.')
    }
    if (!lineId && !nomeNovaLine.trim()) {
      return setMessage('Selecione uma line livre ou crie uma nova line para esta vaga.')
    }

    // Cada vaga exige uma line diferente. So reutiliza se a line ainda estiver livre no campeonato.
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
            `A line "${enrolled.nome}" ja esta neste campeonato. Cada vaga precisa de outra line — crie uma nova (ex.: ${enrolled.nome} 2).`,
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
    if (!response.ok) return setMessage(payload.error || 'Nao foi possivel entrar no grupo.')

    setSlotModal(null)
    setMessage(
      payload.mensagem ||
        `${payload.line?.nome || 'Line'} entrou no slot ${payload.slot_letra || ''} como ${payload.referencia || 'equipe'}.`,
    )
    await carregar({ preferHub: true })
  }

  async function gerarLinkEscalacao() {
    if (!selectedParticipacao) return setMessage('Nenhuma line inscrita neste grupo.')
    if (!canManage) return setMessage('Somente o lider da equipe pode gerar link de escalacao.')
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
      if (!response.ok) throw new Error(json.error || 'Erro ao gerar link de escalacao.')
      setGenerated({
        link: String(json.public_url || `${window.location.origin}/escala/${json.token}`),
        texto: String(json.texto || json.public_url || ''),
      })
      await carregar({ preferHub: true })
      setView('escalar')
      setMessage('Link de escalacao gerado.')
    } catch (error: any) {
      setMessage(error?.message || 'Erro ao gerar link de escalacao.')
    } finally {
      setBusy(false)
    }
  }

  async function copiar(texto: string, okMessage = 'Copiado.') {
    try {
      await navigator.clipboard.writeText(texto)
      setMessage(okMessage)
    } catch {
      setMessage('Nao foi possivel copiar automaticamente.')
    }
  }

  if (loading) return <DropzoneLoader label="Carregando link de equipes" />

  if (!data || data.error) {
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

  const showHub = canManage && minhasParticipacoes.length > 0 && (view === 'hub' || view === 'acompanhar' || view === 'escalar' || view === 'jogadores')

  return (
    <>
      <main className="invite-page">
        <div className={`invite-card ${showHub ? 'invite-hub-card' : ''}`}>
          {data.campeonato?.logo_url ? (
            <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          ) : showHub ? (
            <CheckCircle2 size={42} />
          ) : (
            <Users size={42} />
          )}

          <p className="eyebrow">
            {showHub
              ? minhasParticipacoes.length > 1
                ? `${minhasParticipacoes.length} lines inscritas`
                : 'Equipe inscrita'
              : canManage && minhasParticipacoes.length
                ? 'Nova inscrição no grupo'
                : 'Entrada de equipes'}
          </p>
          <h1>{data.campeonato?.nome}</h1>
          <p>
            {data.grupo?.nome}
            {data.equipe ? ` · ${data.equipe.nome}` : guest ? ' · modo visitante' : ''}
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
          {data.resumo_link ? (
            <p className="invite-section-copy" style={{ textAlign: 'center', marginTop: 4 }}>
              {data.resumo_link.restantes <= 0
                ? 'Este link esgotou as vagas configuradas pelo organizador.'
                : data.resumo_link.limite_vagas === 1
                  ? 'Este link aceita 1 equipe e encerra após a inscrição.'
                  : `Este link aceita mais ${data.resumo_link.restantes} equipe(s) de ${data.resumo_link.limite_vagas}.`}
            </p>
          ) : null}

          {!showHub ? (
            <>
              <p className="invite-section-copy" style={{ textAlign: 'center', marginBottom: 4 }}>
                {canManage
                  ? minhasParticipacoes.length
                    ? `Sua equipe já tem ${minhasParticipacoes.length} line(s) neste grupo. Toque em outro slot livre para uma nova vaga (precisa de outra line).`
                    : 'Toque no slot (letra) livre que preferir. Cada letra corresponde ao avatar da equipe na partida.'
                  : guest
                    ? 'Voce esta no modo visitante: pode ver o grupo, mas nao pode se inscrever nem escalar.'
                    : 'Entre com uma conta de equipe para escolher um slot e se inscrever.'}
              </p>

              {canManage && minhasParticipacoes.length ? (
                <div className="invite-lines-note" style={{ marginBottom: 12 }}>
                  <small>Já inscritas neste grupo</small>
                  <p>
                    {minhasParticipacoes
                      .map(
                        (part) =>
                          `${part.nome_exibicao}${part.slot_numero ? ` (slot ${part.slot_numero})` : ''}`,
                      )
                      .join(' · ')}
                  </p>
                </div>
              ) : null}

              <div className="lineup-slots public-lineup-slots invite-slot-grid">
                {(data.vagas || []).map((vaga) => {
                  const linkAindaTemVaga = (data.resumo_link?.restantes ?? 1) > 0
                  const clickable = !vaga.ocupada && canManage && linkAindaTemVaga
                  return (
                    <button
                      type="button"
                      key={vaga.slot_id || vaga.index}
                      className={`lineup-slot invite-slot-button ${vaga.ocupada ? 'occupied' : 'free'} ${clickable ? 'clickable' : ''}`}
                      onClick={() => openSlot(vaga)}
                      disabled={vaga.ocupada || !canManage}
                      title={
                        vaga.ocupada
                          ? 'Slot ocupado'
                          : canManage
                            ? `Escolher slot ${vaga.slot_letra}`
                            : 'Somente perfil de equipe pode escolher slot'
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
                            : canManage
                              ? 'Toque para escolher'
                              : 'Disponível'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {data.autenticado && !data.equipe ? (
                <div className="invite-auth-box">
                  <p>
                    Este login ainda não tem perfil de <strong>equipe</strong>. Sem equipe não dá para criar line nem
                    entrar no campeonato. Abrindo o cadastro de equipe...
                  </p>
                  <a className="button" href={buildProfileCreationHref('equipe', returnTo)}>
                    Criar equipe agora
                  </a>
                  <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                    Usar outro login
                  </a>
                </div>
              ) : null}

              {canManage && minhasParticipacoes.length ? (
                <button className="button invite-confirm" type="button" onClick={() => setView('hub')}>
                  Abrir opções da minha inscrição
                </button>
              ) : null}

              {guest || !data.autenticado ? (
                <button className="button secondary" type="button" onClick={() => setGate(true)} style={{ width: '100%', marginTop: 10 }}>
                  Entrar com conta de equipe
                </button>
              ) : null}
            </>
          ) : null}

          {showHub ? (
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
              ) : null}

              {view === 'hub' ? (
                <div className="invite-hub-actions">
                  {podeNovaInscricao ? (
                    <button className="invite-hub-option invite-hub-option-primary" type="button" onClick={irParaNovaInscricao}>
                      <UserPlus size={20} />
                      <span>
                        <strong>Nova inscrição</strong>
                        <small>
                          Mesma equipe, outra line em outro slot ({slotsLivres} livre{slotsLivres === 1 ? '' : 's'})
                        </small>
                      </span>
                    </button>
                  ) : null}
                  <button className="invite-hub-option" type="button" onClick={() => setView('acompanhar')}>
                    <Users size={20} />
                    <span>
                      <strong>Acompanhar grupo</strong>
                      <small>Veja as equipes e slots do grupo</small>
                    </span>
                  </button>
                  <button className="invite-hub-option" type="button" onClick={() => setView('escalar')}>
                    <Link2 size={20} />
                    <span>
                      <strong>Escalar elenco</strong>
                      <small>Gere o link de escalação para os jogadores</small>
                    </span>
                  </button>
                  <button className="invite-hub-option" type="button" onClick={() => setView('jogadores')}>
                    <ListChecks size={20} />
                    <span>
                      <strong>Jogadores inscritos</strong>
                      <small>Acompanhe quem já confirmou na escalação</small>
                    </span>
                  </button>
                </div>
              ) : null}

              {view === 'acompanhar' ? (
                <div className="invite-section">
                  <div className="invite-section-head">
                    <h2>Slots do grupo</h2>
                    <button className="button secondary" type="button" onClick={() => setView('hub')}>
                      Voltar
                    </button>
                  </div>
                  {podeNovaInscricao ? (
                    <p className="invite-section-copy">
                      Toque em um slot <strong>livre</strong> para inscrever outra line da sua equipe.
                    </p>
                  ) : null}
                  <div className="lineup-slots public-lineup-slots invite-slot-grid">
                    {(data.vagas || []).map((vaga) => {
                      const clickable = !vaga.ocupada && podeNovaInscricao
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
                                ? `Nova inscrição no slot ${vaga.slot_letra}`
                                : `Slot ${vaga.slot_letra}`
                          }
                        >
                          <b>{vaga.slot_letra || vaga.index + 1}</b>
                          {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
                          <div>
                            <strong>
                              {vaga.ocupada
                                ? vaga.line_nome || vaga.referencia_equipe || 'Ocupado'
                                : `Slot ${vaga.slot_letra}`}
                            </strong>
                            <span>
                              {vaga.ocupada
                                ? vaga.equipe_nome || 'Equipe'
                                : clickable
                                  ? 'Toque para nova inscrição'
                                  : 'Disponível'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {podeNovaInscricao ? (
                    <button className="button invite-confirm" type="button" onClick={irParaNovaInscricao} style={{ width: '100%', marginTop: 12 }}>
                      <UserPlus size={16} />
                      Nova inscrição (escolher outro slot)
                    </button>
                  ) : null}
                </div>
              ) : null}

              {view === 'escalar' ? (
                <div className="invite-section">
                  <div className="invite-section-head">
                    <h2>Escalar elenco</h2>
                    <button className="button secondary" type="button" onClick={() => setView('hub')}>
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
                        <a
                          className="button secondary"
                          href={selectedParticipacao.link_escalacao.public_path}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir
                        </a>
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
                        <button className="button secondary" type="button" onClick={() => copiar(generated.texto, 'Mensagem copiada.')}>
                          Copiar mensagem
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

              {view === 'jogadores' ? (
                <div className="invite-section">
                  <div className="invite-section-head">
                    <h2>Jogadores inscritos</h2>
                    <button className="button secondary" type="button" onClick={() => setView('hub')}>
                      Voltar
                    </button>
                  </div>
                  <p className="invite-section-copy">
                    {selectedParticipacao?.quantidade_jogadores || 0} de {selectedParticipacao?.limite_jogadores || 6}{' '}
                    vagas na line <strong>{selectedParticipacao?.nome_exibicao}</strong>.
                  </p>
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
                  <div className="invite-inline-actions">
                    <button className="button" type="button" onClick={() => setView('escalar')}>
                      Ir para escalação
                    </button>
                    <button className="button secondary" type="button" onClick={() => void carregar({ preferHub: true })}>
                      Atualizar
                    </button>
                  </div>
                </div>
              ) : null}

              {view === 'hub' ? (
                <div className="invite-footer-links">
                  <a className="button secondary" href="/">
                    Painel da equipe
                  </a>
                </div>
              ) : null}
            </>
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
                  Cada vaga do campeonato precisa de uma <strong>line diferente</strong> (para pontuar certo).
                  Aqui só aparecem lines que ainda não estão no campeonato.
                </span>
              </div>
              <button type="button" onClick={() => setSlotModal(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            {(data.equipes_esperadas || []).length ? (
              <label className="field">
                <span>Qual equipe da lista é a sua?</span>
                <select value={referenciaEquipe} onChange={(e) => setReferenciaEquipe(e.target.value)}>
                  {equipesDisponiveis.length === 0 ? (
                    <option value="">Nenhuma referência disponível</option>
                  ) : (
                    equipesDisponiveis.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : null}

            {linesInscritas.length ? (
              <div className="invite-lines-note">
                <small>Já inscritas neste campeonato (não podem ser reutilizadas)</small>
                <p>{linesInscritas.map((line) => line.nome).join(' · ')}</p>
              </div>
            ) : null}

            {linesDisponiveis.length ? (
              <label className="field">
                <span>Line livre da sua equipe</span>
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
                <small>Nenhuma line livre</small>
                <p>
                  Todas as lines da sua equipe já estão neste campeonato.
                  Crie uma nova line abaixo — ela será inscrita automaticamente neste slot.
                </p>
              </div>
            )}

            {!lineId ? (
              <label className="field">
                <span>Nome da nova line (será criada e inscrita neste slot)</span>
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

      {gate ? (
        <div className="vacancies-access-gate">
          <section>
            <button className="gate-close" type="button" onClick={continueAsGuest} aria-label="Fechar">
              <X size={18} />
            </button>
            {data.campeonato?.logo_url ? (
              <img src={data.campeonato.logo_url} alt="" style={{ width: 62, height: 62, objectFit: 'contain' }} />
            ) : (
              <img src="/dropzone-icon.png" alt="" />
            )}
            <p className="eyebrow">Entrada de equipes</p>
            <h2>Como deseja continuar?</h2>
            <p>
              Para se inscrever você precisa de um <strong>perfil de equipe</strong>. Entre com Google/Facebook/Discord
              — se ainda não tiver equipe, o cadastro abre em seguida. Sem login você só visualiza o grupo.
            </p>
            <SocialLogin profileType="equipe" returnTo={returnTo} />
            <button className="continue-guest" type="button" onClick={continueAsGuest}>
              Continuar sem login
            </button>
            <a
              className="button secondary"
              href={buildLoginHref('equipe', returnTo)}
              style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
            >
              Entrar com login e senha
            </a>
          </section>
        </div>
      ) : null}
    </>
  )
}
