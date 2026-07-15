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
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita: boolean }>
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

  const linesDisponiveis = useMemo(() => (data?.lines || []).filter((line) => !line.ja_inscrita), [data?.lines])
  const minhasParticipacoes = data?.minhas_participacoes || []
  const selectedParticipacao =
    minhasParticipacoes.find((item) => item.id === selectedParticipacaoId) || minhasParticipacoes[0] || null
  const canManage = Boolean(data?.autenticado && data?.equipe)
  const equipesDisponiveis = data?.equipes_esperadas_disponiveis || []

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

    const firstLine = (payload.lines || []).find((line: any) => !line.ja_inscrita)
    setLineId(firstLine?.id || '')
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
  }, [token])

  function continueAsGuest() {
    sessionStorage.setItem(`${GUEST_KEY}:${token}`, '1')
    setGuest(true)
    setGate(false)
  }

  function openSlot(vaga: Vaga) {
    if (vaga.ocupada) return
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
    const firstLine = linesDisponiveis[0]
    setLineId(firstLine?.id || '')
    setNomeNovaLine('')
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
    if (!lineId && !nomeNovaLine.trim()) return setMessage('Selecione uma line ou crie uma nova.')

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
        line_id: lineId || null,
        nome_line: lineId ? null : nomeNovaLine.trim(),
      }),
    })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(payload.error || 'Nao foi possivel entrar no grupo.')

    setSlotModal(null)
    setMessage(
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

          <p className="eyebrow">{showHub ? 'Equipe inscrita' : 'Entrada de equipes'}</p>
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
          </div>

          {!showHub ? (
            <>
              <p className="invite-section-copy" style={{ textAlign: 'center', marginBottom: 4 }}>
                {canManage
                  ? 'Toque no slot (letra) livre que preferir. Cada letra corresponde ao avatar da equipe na partida.'
                  : guest
                    ? 'Voce esta no modo visitante: pode ver o grupo, mas nao pode se inscrever nem escalar.'
                    : 'Entre com uma conta de equipe para escolher um slot e se inscrever.'}
              </p>

              <div className="lineup-slots public-lineup-slots invite-slot-grid">
                {(data.vagas || []).map((vaga) => {
                  const clickable = !vaga.ocupada && canManage
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
                  <p>Este login não possui perfil de <strong>equipe</strong>. Para entrar no grupo e escalar, crie ou vincule uma equipe.</p>
                  <a className="button" href={buildProfileCreationHref('equipe', returnTo)}>
                    Criar equipe com meu login atual
                  </a>
                  <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                    Usar outro login de equipe
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
                  <div className="lineup-slots public-lineup-slots">
                    {(data.vagas || []).map((vaga) => (
                      <div className={`lineup-slot ${vaga.ocupada ? 'occupied' : ''}`} key={vaga.index}>
                        <b>{vaga.slot_letra || vaga.index + 1}</b>
                        {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
                        <div>
                          <strong>
                            {vaga.ocupada
                              ? vaga.line_nome || vaga.referencia_equipe || 'Ocupado'
                              : `Slot ${vaga.slot_letra}`}
                          </strong>
                          <span>
                            {vaga.ocupada ? vaga.equipe_nome || 'Equipe' : 'Disponível'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  {(data.resumo_grupo?.livres || 0) > 0 ? (
                    <button className="button secondary" type="button" onClick={() => setView('entrada')}>
                      Inscrever outra line em outro slot
                    </button>
                  ) : null}
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
                <span>Escolha a equipe da lista e a line real que vai ocupar esta letra.</span>
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

            {linesDisponiveis.length ? (
              <label className="field">
                <span>Line real da sua equipe</span>
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
                  <option value="">Criar nova line</option>
                </select>
              </label>
            ) : null}

            {!lineId ? (
              <label className="field">
                <span>Nome da nova line</span>
                <input
                  value={nomeNovaLine}
                  onChange={(e) => setNomeNovaLine(e.target.value)}
                  placeholder="Ex.: UA ELITE"
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
              Entre com uma conta que tenha <strong>perfil de equipe</strong> para escolher um slot e se inscrever.
              Sem login você só visualiza o grupo.
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
