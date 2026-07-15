'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Shield, Users } from 'lucide-react'
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
}

type InvitePayload = {
  error?: string
  valido?: boolean
  aceito?: boolean
  autenticado?: boolean
  campeonato?: { id: string; nome: string; logo_url: string | null }
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
  modelo?: { assento?: 'slot' | 'grupo' | 'vaga_legado' | null }
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{
    id: string
    nome: string
    tag: string | null
    logo_url: string | null
    ja_inscrita: boolean
  }>
  lines_disponiveis?: Array<{
    id: string
    nome: string
    tag: string | null
    logo_url: string | null
    ja_inscrita?: boolean
  }>
}

export default function ConviteEquipePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const returnTo = `/convite/equipe/${encodeURIComponent(token)}`
  const [data, setData] = useState<InvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [slotModal, setSlotModal] = useState<SlotVaga | null>(null)
  const [sucesso, setSucesso] = useState<{ equipe: string; line: string; slot?: string; grupo?: string } | null>(null)

  const linesDisponiveis = useMemo(() => {
    if (data?.lines_disponiveis?.length) return data.lines_disponiveis
    return (data?.lines || []).filter((line) => !line.ja_inscrita)
  }, [data?.lines, data?.lines_disponiveis])

  const modoGrupo = data?.modelo?.assento === 'grupo'

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(`/api/convites/equipe/${encodeURIComponent(token)}`, {
        headers: sessionData.session
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
        cache: 'no-store',
      })
      const payload = await response.json()
      setData(payload)
      const livres = payload.lines_disponiveis || (payload.lines || []).filter((line: any) => !line.ja_inscrita)
      setLineId(livres[0]?.id || '')
      setLoading(false)

      if (payload.autenticado && !payload.equipe && !payload.error) {
        window.location.replace(buildProfileCreationHref('equipe', returnTo))
      }
    }
    void carregar()
  }, [token, returnTo])

  function openSlot(vaga: SlotVaga) {
    if (vaga.ocupada) return
    if (!data?.autenticado) {
      setMessage('Entre com uma conta de equipe para escolher um slot.')
      return
    }
    if (!data.equipe) {
      window.location.assign(buildProfileCreationHref('equipe', returnTo))
      return
    }
    setSlotModal(vaga)
    if (linesDisponiveis[0]) {
      setLineId(linesDisponiveis[0].id)
      setNomeNovaLine('')
    } else {
      setLineId('')
      setNomeNovaLine('')
    }
    setMessage('')
  }

  async function aceitar(opts?: { slotId?: string | null; slotLetra?: string | null }) {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setMessage('Entre com uma conta de equipe para continuar.')
      return
    }
    if (!data?.equipe) {
      window.location.assign(buildProfileCreationHref('equipe', returnTo))
      return
    }
    if (!lineId && !nomeNovaLine.trim()) {
      setMessage('Selecione uma line livre ou crie uma nova line para este slot.')
      return
    }

    let resolvedLineId = lineId || null
    let resolvedNome = lineId ? null : nomeNovaLine.trim()
    if (!resolvedLineId && resolvedNome) {
      const enrolled = (data.lines || []).find(
        (l) => l.ja_inscrita && l.nome.trim().toLowerCase() === resolvedNome!.toLowerCase(),
      )
      if (enrolled) {
        setMessage(`A line "${enrolled.nome}" já está neste campeonato. Crie outra line.`)
        return
      }
      const free = linesDisponiveis.find((l) => l.nome.trim().toLowerCase() === resolvedNome!.toLowerCase())
      if (free) {
        resolvedLineId = free.id
        resolvedNome = null
      }
    }

    if (modoGrupo && !opts?.slotId && !data.slot?.id) {
      setMessage('Escolha um slot livre do grupo.')
      return
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
        slot_id: opts?.slotId || data.slot?.id || null,
      }),
    })
    const payload = await response.json()
    setBusy(false)

    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível aceitar o convite.')
      return
    }

    setSlotModal(null)
    setSucesso({
      equipe: payload.equipe?.nome || 'Equipe',
      line: payload.line?.nome || 'Line',
      slot: payload.slot?.letra || opts?.slotLetra || data.slot?.letra || undefined,
      grupo: payload.grupo?.nome || data.grupo?.nome || undefined,
    })
    setData((current) => (current ? { ...current, valido: false, aceito: true } : current))
  }

  if (loading) return <DropzoneLoader label="Carregando convite" />

  if (!data || data.error) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Convite inválido</h1>
          <p>{data?.error || 'Não foi possível carregar este convite.'}</p>
        </div>
      </main>
    )
  }

  const slotLabel =
    data.slot?.letra || data.vaga?.letra || (data.vaga?.numero_vaga ? String(data.vaga.numero_vaga).padStart(2, '0') : '-')

  if (sucesso) {
    return (
      <main className="invite-page">
        <div className="invite-card invite-success-card">
          <CheckCircle2 size={48} />
          <p className="eyebrow">Entrada confirmada</p>
          <h1>{data.campeonato?.nome}</h1>
          <p>
            <strong>{sucesso.line}</strong> entrou no slot <strong>{sucesso.slot || slotLabel}</strong>
            {sucesso.grupo ? (
              <>
                {' '}
                do <strong>{sucesso.grupo}</strong>
              </>
            ) : null}{' '}
            pela pasta <strong>{sucesso.equipe}</strong>.
          </p>
          <div className="invite-details">
            <span>
              <strong>Slot</strong>
              {sucesso.slot || slotLabel}
            </span>
            <span>
              <strong>Line</strong>
              {sucesso.line}
            </span>
          </div>
          <a className="button invite-confirm" href="/">
            Ir para o painel da equipe
          </a>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="invite-page">
        <div className={`invite-card ${modoGrupo ? 'invite-hub-card' : ''}`}>
          {data.campeonato?.logo_url ? (
            <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          ) : (
            <Users size={42} />
          )}
          <p className="eyebrow">{modoGrupo ? 'Convite de grupo' : 'Convite de line no campeonato'}</p>
          <h1>{data.campeonato?.nome}</h1>
          {data.grupo?.nome ? <p>{data.grupo.nome}</p> : null}

          {modoGrupo ? (
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
          ) : (
            <div className="invite-details">
              <span>
                <strong>Slot</strong>
                {slotLabel}
              </span>
              <span>
                <strong>Referência</strong>
                {data.convite?.nome_equipe_reservada || '-'}
              </span>
              <span>
                <strong>Line informada</strong>
                {data.convite?.nome_line_reservada || '-'}
              </span>
              <span>
                <strong>Validade</strong>
                <Clock3 size={14} /> 24 horas
              </span>
            </div>
          )}

          {data.valido ? (
            data.autenticado ? (
              data.equipe ? (
                modoGrupo ? (
                  <>
                    <div className="invite-current-team">
                      <small>Sua pasta</small>
                      <strong>{data.equipe.nome}</strong>
                      <span>Toque no slot livre para confirmar a line e entrar no grupo.</span>
                    </div>
                    <p className="invite-section-copy" style={{ textAlign: 'center', marginBottom: 4 }}>
                      Referência: {data.convite?.nome_equipe_reservada || '—'} ·{' '}
                      {data.convite?.nome_line_reservada || 'line'}
                    </p>
                    <div className="lineup-slots public-lineup-slots invite-slot-grid">
                      {(data.vagas || []).map((vaga) => {
                        const clickable = !vaga.ocupada
                        return (
                          <button
                            type="button"
                            key={vaga.slot_id}
                            className={`lineup-slot invite-slot-button ${vaga.ocupada ? 'occupied' : 'free'} ${clickable ? 'clickable' : ''}`}
                            onClick={() => openSlot(vaga)}
                            disabled={vaga.ocupada || busy}
                          >
                            <b>{vaga.slot_letra}</b>
                            {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
                            <div>
                              <strong>
                                {vaga.ocupada
                                  ? vaga.line_nome || vaga.equipe_nome || 'Ocupado'
                                  : `Slot ${vaga.slot_letra}`}
                              </strong>
                              <span>{vaga.ocupada ? vaga.equipe_nome || 'Equipe' : 'Toque para entrar'}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="invite-team-confirmation">
                    <div className="invite-current-team">
                      <small>Pasta (equipe)</small>
                      <strong>{data.equipe.nome}</strong>
                      {data.equipe.tag ? <span>{data.equipe.tag}</span> : null}
                    </div>

                    <p className="invite-section-copy" style={{ textAlign: 'left' }}>
                      A <strong>line</strong> é quem joga e pontua. Só aparecem lines ainda livres neste campeonato.
                    </p>

                    {linesDisponiveis.length ? (
                      <label className="field">
                        <span>Line livre para o slot {slotLabel}</span>
                        <select
                          value={lineId}
                          onChange={(event) => {
                            setLineId(event.target.value)
                            setNomeNovaLine('')
                          }}
                        >
                          {linesDisponiveis.map((line) => (
                            <option value={line.id} key={line.id}>
                              {line.nome}
                            </option>
                          ))}
                          <option value="">+ Criar nova line para este slot</option>
                        </select>
                      </label>
                    ) : (
                      <p className="invite-line-note">
                        Todas as lines desta pasta já estão no campeonato. Crie uma nova line abaixo.
                      </p>
                    )}

                    {!lineId ? (
                      <label className="field">
                        <span>Nome da nova line (herda logo da pasta)</span>
                        <input
                          value={nomeNovaLine}
                          onChange={(event) => setNomeNovaLine(event.target.value)}
                          placeholder="Ex.: ALOE ELITE"
                        />
                      </label>
                    ) : null}

                    {(data.lines || []).some((line) => line.ja_inscrita) ? (
                      <p className="invite-line-note">
                        Já no campeonato:{' '}
                        {(data.lines || [])
                          .filter((l) => l.ja_inscrita)
                          .map((l) => l.nome)
                          .join(', ')}
                      </p>
                    ) : null}

                    <button className="button invite-confirm" disabled={busy} onClick={() => void aceitar()}>
                      Confirmar line no slot {slotLabel}
                    </button>
                    <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                      Usar outra equipe
                    </a>
                  </div>
                )
              ) : (
                <div className="invite-auth-box">
                  <p>Redirecionando para criar o perfil de equipe (pasta das lines)...</p>
                  <a className="button" href={buildProfileCreationHref('equipe', returnTo)}>
                    Criar equipe agora
                  </a>
                </div>
              )
            ) : (
              <div className="invite-auth-actions">
                <p style={{ marginBottom: 12, color: '#667085', fontSize: 13 }}>
                  Entre com conta de <strong>equipe</strong>. Se ainda não tiver perfil, o cadastro abre em seguida.
                </p>
                <SocialLogin profileType="equipe" returnTo={returnTo} />
              </div>
            )
          ) : (
            <div className="invite-expired">
              <CheckCircle2 size={20} />
              {data.aceito ? 'Convite aceito.' : 'Este convite expirou, já foi utilizado ou o grupo está cheio.'}
            </div>
          )}

          {message ? <p className="invite-message">{message}</p> : null}
        </div>
      </main>

      {slotModal ? (
        <div className="invite-modal-backdrop" onClick={() => !busy && setSlotModal(null)}>
          <section className="invite-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Confirmar entrada</p>
                <h2>Slot {slotModal.slot_letra}</h2>
                <span>
                  {data.grupo?.nome || 'Grupo'} · cada vaga precisa de uma <strong>line diferente</strong>.
                </span>
              </div>
              <button type="button" onClick={() => setSlotModal(null)} aria-label="Fechar">
                ×
              </button>
            </header>

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
                  <option value="">+ Criar nova line para este slot</option>
                </select>
              </label>
            ) : (
              <div className="invite-lines-note">
                <small>Nenhuma line livre</small>
                <p>Crie uma nova line abaixo — ela será inscrita neste slot do grupo.</p>
              </div>
            )}

            {!lineId ? (
              <label className="field">
                <span>Nome da nova line</span>
                <input
                  value={nomeNovaLine}
                  onChange={(e) => setNomeNovaLine(e.target.value)}
                  placeholder="Ex.: ALOE ELITE"
                />
              </label>
            ) : null}

            {message ? <p className="invite-message">{message}</p> : null}

            <div className="invite-inline-actions">
              <button className="button secondary" type="button" disabled={busy} onClick={() => setSlotModal(null)}>
                Cancelar
              </button>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() =>
                  void aceitar({ slotId: slotModal.slot_id, slotLetra: slotModal.slot_letra })
                }
              >
                {busy ? 'Confirmando...' : `Confirmar no slot ${slotModal.slot_letra}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
