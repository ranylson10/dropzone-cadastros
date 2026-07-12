'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, Shield, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'

type InvitePayload = {
  error?: string
  valido?: boolean
  aceito?: boolean
  autenticado?: boolean
  campeonato?: { id: string; nome: string; logo_url: string | null }
  vaga?: { numero_vaga: number }
  convite?: {
    nome_equipe_reservada: string | null
    nome_line_reservada: string | null
  }
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{
    id: string
    nome: string
    tag: string | null
    logo_url: string | null
    ja_inscrita: boolean
  }>
}

export default function ConviteEquipePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [data, setData] = useState<InvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [sucesso, setSucesso] = useState<{ equipe: string; line: string } | null>(null)

  const linesDisponiveis = useMemo(
    () => (data?.lines || []).filter((line) => !line.ja_inscrita),
    [data?.lines],
  )

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(`/api/convites/equipe/${encodeURIComponent(token)}`, {
        headers: sessionData.session
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
      })
      const payload = await response.json()
      setData(payload)
      const primeira = (payload.lines || []).find((line: any) => !line.ja_inscrita)
      setLineId(primeira?.id || '')
      setLoading(false)
    }
    void carregar()
  }, [token])

  async function aceitar() {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setMessage('Entre com sua conta ou crie uma equipe para continuar.')
      return
    }

    if (!lineId && !nomeNovaLine.trim()) {
      setMessage('Selecione uma line disponível ou crie uma nova.')
      return
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

    setSucesso({ equipe: payload.equipe?.nome || 'Equipe', line: payload.line?.nome || 'Line' })
    setData((current) => current ? { ...current, valido: false, aceito: true } : current)
  }

  if (loading) return <main className="invite-page"><Loader2 className="spin" /></main>

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

  if (sucesso) {
    return (
      <main className="invite-page">
        <div className="invite-card invite-success-card">
          <CheckCircle2 size={48} />
          <p className="eyebrow">Entrada confirmada</p>
          <h1>{data.campeonato?.nome}</h1>
          <p><strong>{sucesso.line}</strong> foi inscrita com a equipe <strong>{sucesso.equipe}</strong>.</p>
          <div className="invite-details">
            <span><strong>Vaga</strong>{String(data.vaga?.numero_vaga || '-').padStart(2, '0')}</span>
            <span><strong>Escalação</strong>Pendente</span>
          </div>
          <a className="button invite-confirm" href="/">Ir para o painel da equipe</a>
        </div>
      </main>
    )
  }

  return (
    <main className="invite-page">
      <div className="invite-card">
        {data.campeonato?.logo_url
          ? <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          : <Users size={42} />}
        <p className="eyebrow">Convite DropZone</p>
        <h1>{data.campeonato?.nome}</h1>

        <div className="invite-details">
          <span><strong>Vaga</strong>{String(data.vaga?.numero_vaga || '-').padStart(2, '0')}</span>
          <span><strong>Referência</strong>{data.convite?.nome_equipe_reservada || '-'}</span>
          <span><strong>Line informada</strong>{data.convite?.nome_line_reservada || '-'}</span>
          <span><strong>Validade</strong><Clock3 size={14} /> 24 horas</span>
        </div>

        {data.valido ? (
          data.autenticado ? (
            data.equipe ? (
              <div className="invite-team-confirmation">
                <div className="invite-current-team">
                  <small>Confirmar com a equipe vinculada</small>
                  <strong>{data.equipe.nome}</strong>
                  {data.equipe.tag ? <span>{data.equipe.tag}</span> : null}
                </div>

                {linesDisponiveis.length ? (
                  <label className="field">
                    <span>Escolha a line real que ocupará a vaga</span>
                    <select value={lineId} onChange={(event) => { setLineId(event.target.value); setNomeNovaLine('') }}>
                      {linesDisponiveis.map((line) => <option value={line.id} key={line.id}>{line.nome}</option>)}
                      <option value="">Criar nova line</option>
                    </select>
                  </label>
                ) : null}

                {!lineId ? (
                  <label className="field">
                    <span>Nome da nova line</span>
                    <input value={nomeNovaLine} onChange={(event) => setNomeNovaLine(event.target.value)} placeholder="Ex.: LOUD ELITE" />
                  </label>
                ) : null}

                {(data.lines || []).some((line) => line.ja_inscrita) ? (
                  <p className="invite-line-note">Lines já inscritas neste campeonato não podem ser usadas novamente.</p>
                ) : null}

                <button className="button invite-confirm" onClick={aceitar}>Confirmar entrada</button>
                <a className="button secondary" href={buildLoginHref('equipe', `/convite/equipe/${encodeURIComponent(token)}`, true)}>Usar outra equipe</a>
              </div>
            ) : (
              <div className="invite-auth-box">
                <p>Seu login está ativo, mas ainda não possui um perfil de equipe vinculado.</p>
                <a className="button" href={buildProfileCreationHref('equipe', `/convite/equipe/${encodeURIComponent(token)}`)}>Criar equipe com meu login atual</a>
                <a className="button secondary" href={buildLoginHref('equipe', `/convite/equipe/${encodeURIComponent(token)}`, true)}>Criar equipe com outro login</a>
              </div>
            )
          ) : (
            <div className="invite-auth-actions">
              <a className="button" href={buildLoginHref('equipe', `/convite/equipe/${encodeURIComponent(token)}`)}>Entrar para continuar</a>
              <p className="invite-auth-hint">Você será direcionado ao login central e voltará automaticamente para este convite.</p>
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
