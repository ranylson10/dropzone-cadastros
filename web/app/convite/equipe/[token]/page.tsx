'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Shield, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

type InvitePayload = {
  error?: string
  valido?: boolean
  aceito?: boolean
  autenticado?: boolean
  campeonato?: { id: string; nome: string; logo_url: string | null }
  slot?: { id: string; letra: string | null; numero: number | null; grupo_id?: string | null } | null
  grupo?: { id: string; nome: string } | null
  vaga?: { numero_vaga: number; letra?: string | null }
  convite?: {
    nome_equipe_reservada: string | null
    nome_line_reservada: string | null
    expira_em?: string | null
  }
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
  const [message, setMessage] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [sucesso, setSucesso] = useState<{ equipe: string; line: string; slot?: string } | null>(null)

  const linesDisponiveis = useMemo(() => {
    if (data?.lines_disponiveis?.length) return data.lines_disponiveis
    return (data?.lines || []).filter((line) => !line.ja_inscrita)
  }, [data?.lines, data?.lines_disponiveis])

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

      // Sem perfil de equipe: cadastro obrigatório (pasta → lines).
      if (payload.autenticado && !payload.equipe && !payload.error) {
        window.location.replace(buildProfileCreationHref('equipe', returnTo))
      }
    }
    void carregar()
  }, [token, returnTo])

  async function aceitar() {
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

    // Se digitou nome de line já inscrita, bloqueia.
    if (!lineId && nomeNovaLine.trim()) {
      const enrolled = (data.lines || []).find(
        (l) => l.ja_inscrita && l.nome.trim().toLowerCase() === nomeNovaLine.trim().toLowerCase(),
      )
      if (enrolled) {
        setMessage(`A line "${enrolled.nome}" já está neste campeonato. Crie outra line.`)
        return
      }
      const free = linesDisponiveis.find(
        (l) => l.nome.trim().toLowerCase() === nomeNovaLine.trim().toLowerCase(),
      )
      if (free) {
        setLineId(free.id)
      }
    }

    setLoading(true)
    setMessage('')
    const response = await fetch(`/api/convites/equipe/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        line_id: lineId || null,
        nome_line: lineId ? null : nomeNovaLine.trim(),
      }),
    })
    const payload = await response.json()
    setLoading(false)

    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível aceitar o convite.')
      return
    }

    setSucesso({
      equipe: payload.equipe?.nome || 'Equipe',
      line: payload.line?.nome || 'Line',
      slot: payload.slot?.letra || data.slot?.letra || undefined,
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

  const slotLabel = data.slot?.letra || data.vaga?.letra || (data.vaga?.numero_vaga ? String(data.vaga.numero_vaga).padStart(2, '0') : '-')

  if (sucesso) {
    return (
      <main className="invite-page">
        <div className="invite-card invite-success-card">
          <CheckCircle2 size={48} />
          <p className="eyebrow">Entrada confirmada</p>
          <h1>{data.campeonato?.nome}</h1>
          <p>
            <strong>{sucesso.line}</strong> entrou no slot <strong>{sucesso.slot || slotLabel}</strong> pela pasta{' '}
            <strong>{sucesso.equipe}</strong>.
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
    <main className="invite-page">
      <div className="invite-card">
        {data.campeonato?.logo_url ? (
          <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
        ) : (
          <Users size={42} />
        )}
        <p className="eyebrow">Convite de line no campeonato</p>
        <h1>{data.campeonato?.nome}</h1>
        {data.grupo?.nome ? <p>{data.grupo.nome}</p> : null}

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

        {data.valido ? (
          data.autenticado ? (
            data.equipe ? (
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

                <button className="button invite-confirm" onClick={aceitar}>
                  Confirmar line no slot {slotLabel}
                </button>
                <a className="button secondary" href={buildLoginHref('equipe', returnTo, true)}>
                  Usar outra equipe
                </a>
              </div>
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
            {data.aceito ? 'Convite aceito.' : 'Este convite expirou ou já foi utilizado.'}
          </div>
        )}

        {message ? <p className="invite-message">{message}</p> : null}
      </div>
    </main>
  )
}
