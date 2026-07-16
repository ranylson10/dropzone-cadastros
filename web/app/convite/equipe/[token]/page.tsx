'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CheckCircle2, LogIn, Shield, Users, UserPlus, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

type SlotVaga = {
  index: number
  slot_id: string
  slot_numero: number
  slot_letra: string
  ocupada: boolean
  equipe_nome: string | null
  line_nome: string | null
  logo_url: string | null
  jogadores?: Array<{
    id: string
    nick: string
    foto_url?: string | null
    id_jogo?: string | null
    funcao?: string | null
  }>
  quantidade_jogadores?: number
}

type InvitePayload = {
  error?: string
  valido?: boolean
  autenticado?: boolean
  modo?: 'inscricao' | 'acompanhamento'
  inscricao_aberta?: boolean
  status_mensagem?: string | null
  campeonato?: { id: string; nome: string; logo_url: string | null }
  tema?: {
    cor_principal?: string | null
    cor_secundaria?: string | null
    cor_texto_clara?: string | null
    cor_texto_escura?: string | null
  } | null
  slot?: { id: string; letra: string | null; numero: number | null; grupo_id?: string | null } | null
  grupo?: { id: string; nome: string } | null
  vagas?: SlotVaga[]
  resumo_grupo?: { total: number; ocupadas: number; livres: number } | null
  vaga?: { numero_vaga: number; letra?: string | null }
  convite?: {
    nome_equipe_reservada: string | null
    nome_line_reservada: string | null
    expira_em?: string | null
    grupo_id?: string | null
    slot_id?: string | null
  }
  modelo?: { assento?: 'slot' | 'grupo' | null; auto_slot?: boolean }
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita?: boolean }>
  lines_disponiveis?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita?: boolean }>
}

type Step = 'acompanhar' | 'login' | 'sem_equipe' | 'confirmar_equipe' | 'escolher_line' | 'sucesso'

const SESSION_WAS_LOGGED_KEY = 'dz_invite_eq_was_logged'
const SESSION_JUST_LOGIN_KEY = 'dz_invite_eq_just_login'

export default function ConviteEquipePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const returnTo = `/convite/equipe/${encodeURIComponent(token)}`

  const [data, setData] = useState<InvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<Step>('acompanhar')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [detailVaga, setDetailVaga] = useState<SlotVaga | null>(null)
  const [sucesso, setSucesso] = useState<{ line: string; slot?: string } | null>(null)

  const linesDisponiveis = useMemo(() => {
    if (data?.lines_disponiveis?.length) return data.lines_disponiveis
    return (data?.lines || []).filter((line) => !line.ja_inscrita)
  }, [data?.lines, data?.lines_disponiveis])

  const themeStyle = useMemo(() => {
    const t = data?.tema || {}
    return {
      ['--dz-primary' as string]: t.cor_principal || '#ff4655',
      ['--dz-secondary' as string]: t.cor_secundaria || '#17191d',
      ['--dz-text-on-dark' as string]: t.cor_texto_clara || '#ffffff',
      ['--dz-text-on-light' as string]: t.cor_texto_escura || '#17191d',
    } as CSSProperties
  }, [data?.tema])

  const inscricaoAberta = data?.inscricao_aberta !== false && data?.valido !== false && data?.modo !== 'acompanhamento'
  const hasGroupBoard = Boolean(data?.vagas?.length)

  function markSessionContext(hasSession: boolean) {
    try {
      const key = `${SESSION_WAS_LOGGED_KEY}:${token}`
      const justKey = `${SESSION_JUST_LOGIN_KEY}:${token}`
      if (!hasSession) {
        sessionStorage.setItem(key, '0')
        sessionStorage.removeItem(justKey)
        return { wasLogged: false, justLoggedIn: false }
      }
      const prev = sessionStorage.getItem(key)
      const justLoggedIn = prev === '0' || sessionStorage.getItem(justKey) === '1'
      if (justLoggedIn) sessionStorage.setItem(justKey, '1')
      sessionStorage.setItem(key, '1')
      return { wasLogged: !justLoggedIn, justLoggedIn }
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

  function resolveStep(
    payload: InvitePayload,
    opts: { wasLogged: boolean; justLoggedIn: boolean },
  ): Step {
    const open = payload.inscricao_aberta !== false && payload.valido !== false && payload.modo !== 'acompanhamento'
    if (!open) return 'acompanhar'
    if (!payload.autenticado) return 'login'
    if (!payload.equipe) return 'sem_equipe'
    if (opts.justLoggedIn) return 'escolher_line'
    if (opts.wasLogged) return 'confirmar_equipe'
    return 'escolher_line'
  }

  async function carregar(opts?: { forceStep?: Step }) {
    setLoading(true)
    setMessage('')
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionCtx = markSessionContext(Boolean(sessionData.session))

    const response = await fetch(`/api/convites/equipe/${encodeURIComponent(token)}`, {
      headers: sessionData.session
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined,
      cache: 'no-store',
    })
    const payload: InvitePayload = await response.json()
    setData(payload)

    if (!response.ok && payload.error && !payload.campeonato) {
      setLoading(false)
      return
    }

    const livres = payload.lines_disponiveis || (payload.lines || []).filter((l: any) => !l.ja_inscrita)
    setLineId(livres[0]?.id || '')
    setNomeNovaLine('')
    setStep(opts?.forceStep || resolveStep(payload, sessionCtx))
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
  }, [token])

  function startInscricao() {
    setMessage('')
    if (!data) return
    if (!inscricaoAberta) {
      setMessage(data.status_mensagem || 'Este convite não aceita novas inscrições.')
      setStep('acompanhar')
      return
    }
    if (!data.autenticado) {
      setStep('login')
      return
    }
    if (!data.equipe) {
      setStep('sem_equipe')
      return
    }
    try {
      const wasLogged = sessionStorage.getItem(`${SESSION_WAS_LOGGED_KEY}:${token}`) === '1'
      const justLoggedIn = sessionStorage.getItem(`${SESSION_JUST_LOGIN_KEY}:${token}`) === '1'
      setStep(justLoggedIn || !wasLogged ? 'escolher_line' : 'confirmar_equipe')
    } catch {
      setStep('escolher_line')
    }
  }

  async function aceitar() {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setStep('login')
      return setMessage('Entre com uma conta de equipe para continuar.')
    }
    if (!data?.equipe) {
      window.location.assign(buildProfileCreationHref('equipe', returnTo))
      return
    }
    if (!lineId && !nomeNovaLine.trim()) {
      return setMessage('Selecione uma line livre ou crie uma nova line.')
    }

    let resolvedLineId = lineId || null
    let resolvedNome = lineId ? null : nomeNovaLine.trim()
    if (!resolvedLineId && resolvedNome) {
      const free = linesDisponiveis.find(
        (l) => l.nome.trim().toLowerCase() === resolvedNome!.toLowerCase(),
      )
      if (free) {
        resolvedLineId = free.id
        resolvedNome = null
      }
    }

    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/convites/equipe/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        line_id: resolvedLineId,
        nome_line: resolvedNome,
        // auto-slot no servidor se grupo sem slot fixo
        slot_id: data.slot?.id || null,
      }),
    })
    const payload = await response.json()
    setBusy(false)

    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível aceitar o convite.')
      return
    }

    clearJustLoginFlag()
    setSucesso({
      line: payload.line?.nome || resolvedNome || 'Line',
      slot: payload.slot?.letra || payload.slot_letra || data.slot?.letra || undefined,
    })
    setStep('sucesso')
    await carregar({ forceStep: 'sucesso' })
  }

  if (loading) return <DropzoneLoader label="Carregando convite" />

  if (!data || (data.error && !data.campeonato)) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Convite indisponível</h1>
          <p>{data?.error || 'Não foi possível carregar este convite.'}</p>
          <a className="button invite-confirm" href="/">
            Ir para o início
          </a>
        </div>
      </main>
    )
  }

  const slotLabel =
    data.slot?.letra ||
    data.vaga?.letra ||
    (data.vaga?.numero_vaga ? String(data.vaga.numero_vaga).padStart(2, '0') : null)

  const eyebrow =
    step === 'login'
      ? 'Convite de inscrição'
      : step === 'sem_equipe'
        ? 'Perfil de equipe'
        : step === 'confirmar_equipe'
          ? 'Confirmar equipe'
          : step === 'escolher_line'
            ? 'Escolher line'
            : step === 'sucesso'
              ? 'Entrada confirmada'
              : !inscricaoAberta
                ? 'Acompanhamento'
                : 'Acompanhamento'

  return (
    <>
      <main className="invite-page champ-theme" style={themeStyle}>
        <div className={`invite-card ${step === 'acompanhar' || step === 'sucesso' ? 'invite-hub-card' : ''}`}>
          {data.campeonato?.logo_url ? (
            <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          ) : step === 'sucesso' ? (
            <CheckCircle2 size={42} />
          ) : (
            <Users size={42} />
          )}

          <p className="eyebrow">{eyebrow}</p>
          <h1>{data.campeonato?.nome}</h1>
          {data.grupo?.nome ? <p>{data.grupo.nome}</p> : null}

          {data.resumo_grupo ? (
            <div className="invite-mini-stats">
              <span>
                <strong>{data.resumo_grupo.ocupadas}</strong> ocupadas
              </span>
              <span>
                <strong>{data.resumo_grupo.livres}</strong> livres
              </span>
              <span>
                <strong>{data.resumo_grupo.total}</strong> slots
              </span>
            </div>
          ) : slotLabel ? (
            <div className="invite-details">
              <span>
                <strong>Slot</strong>
                {slotLabel}
              </span>
            </div>
          ) : null}

          {!inscricaoAberta && data.status_mensagem && step === 'acompanhar' ? (
            <p className="invite-section-copy" style={{ textAlign: 'center', marginTop: 6 }}>
              {data.status_mensagem}
            </p>
          ) : null}

          {step === 'login' ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <LogIn size={22} />
              <p>
                {inscricaoAberta ? (
                  <>
                    Para se inscrever, <strong>faça login</strong> com a conta da equipe. Ou continue só
                    acompanhando.
                  </>
                ) : (
                  <>Este convite não aceita novas inscrições. Você pode acompanhar o grupo abaixo.</>
                )}
              </p>
              {inscricaoAberta ? (
                <>
                  <SocialLogin profileType="equipe" returnTo={returnTo} />
                  <a
                    className="button secondary"
                    href={buildLoginHref('equipe', returnTo)}
                    style={{ width: '100%', marginTop: 8, placeContent: 'center' }}
                  >
                    Entrar com e-mail e senha
                  </a>
                </>
              ) : null}
              <button
                className="button secondary"
                type="button"
                onClick={() => setStep('acompanhar')}
                style={{ width: '100%', marginTop: 8 }}
              >
                Só acompanhar
              </button>
            </div>
          ) : null}

          {step === 'sem_equipe' ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <Shield size={22} />
              <p>
                Seu login está ativo, mas ainda <strong>não tem conta de equipe</strong>. Crie o perfil para
                continuar.
              </p>
              <a className="button invite-confirm" href={buildProfileCreationHref('equipe', returnTo)}>
                Criar perfil de equipe
              </a>
              <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                Usar outra conta
              </a>
            </div>
          ) : null}

          {step === 'confirmar_equipe' && data.equipe ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <div className="invite-current-team" style={{ width: '100%' }}>
                <small>Equipe logada</small>
                <strong>{data.equipe.nome}</strong>
                <span>{data.equipe.tag ? `Tag ${data.equipe.tag}` : 'Sem tag'}</span>
              </div>
              <p>
                Usar a equipe <strong>{data.equipe.nome}</strong>?
              </p>
              <button className="button invite-confirm" type="button" onClick={() => setStep('escolher_line')}>
                Usar {data.equipe.nome}
              </button>
              <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                Trocar de equipe (outro login)
              </a>
            </div>
          ) : null}

          {step === 'escolher_line' ? (
            <div className="invite-section" style={{ marginTop: 12 }}>
              <div className="invite-current-team" style={{ marginBottom: 12 }}>
                <small>Inscrevendo com</small>
                <strong>{data.equipe?.nome}</strong>
                <span>
                  {slotLabel
                    ? `Slot ${slotLabel} — escolha a line.`
                    : 'O slot livre será atribuído automaticamente.'}
                </span>
              </div>

              {linesDisponiveis.length ? (
                <label className="field">
                  <span>Line livre</span>
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
                    <option value="">+ Criar nova line</option>
                  </select>
                </label>
              ) : (
                <div className="invite-lines-note">
                  <small>Criar line</small>
                  <p>Crie uma nova line — ela será usada nesta inscrição automaticamente.</p>
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

              <button
                className="button invite-confirm"
                type="button"
                disabled={busy}
                onClick={() => void aceitar()}
                style={{ width: '100%', marginTop: 12 }}
              >
                {busy ? 'Confirmando...' : 'Confirmar inscrição'}
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

          {step === 'sucesso' && sucesso ? (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <CheckCircle2 size={40} />
              <p>
                <strong>{sucesso.line}</strong> inscrita
                {sucesso.slot ? (
                  <>
                    {' '}
                    no slot <strong>{sucesso.slot}</strong>
                  </>
                ) : null}
                .
              </p>
              <button className="button invite-confirm" type="button" onClick={() => setStep('acompanhar')}>
                Ver grupo
              </button>
              <a className="button secondary" href="/">
                Ir para o painel
              </a>
            </div>
          ) : null}

          {step === 'acompanhar' ? (
            <div className="invite-section">
              {hasGroupBoard ? (
                <>
                  <p className="invite-section-copy">
                    Toque em uma equipe inscrita para ver a line e os jogadores.
                  </p>
                  <div className="lineup-slots public-lineup-slots invite-slot-grid">
                    {(data.vagas || []).map((vaga) => (
                      <button
                        type="button"
                        key={vaga.slot_id || vaga.index}
                        className={`lineup-slot invite-slot-button ${vaga.ocupada ? 'occupied' : 'free'} ${vaga.ocupada ? 'clickable' : ''}`}
                        onClick={() => vaga.ocupada && setDetailVaga(vaga)}
                        disabled={!vaga.ocupada}
                      >
                        <b>{vaga.slot_letra}</b>
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
                </>
              ) : (
                <p className="invite-section-copy" style={{ textAlign: 'center' }}>
                  {inscricaoAberta
                    ? 'Use o botão abaixo para inscrever sua equipe neste convite.'
                    : data.status_mensagem || 'Convite encerrado.'}
                </p>
              )}

              {inscricaoAberta ? (
                <button
                  className="button invite-confirm"
                  type="button"
                  onClick={startInscricao}
                  style={{ width: '100%', marginTop: 16 }}
                >
                  <UserPlus size={16} />
                  Escalar minha equipe
                </button>
              ) : null}
            </div>
          ) : null}

          {message ? <p className="invite-message">{message}</p> : null}
        </div>
      </main>

      {detailVaga ? (
        <div className="invite-modal-backdrop" onClick={() => setDetailVaga(null)}>
          <section className="invite-modal" onClick={(e) => e.stopPropagation()}>
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
