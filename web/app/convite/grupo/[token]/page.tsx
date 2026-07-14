'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Shield, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

type GroupInvitePayload = {
  error?: string
  autenticado?: boolean
  campeonato?: { id: string; nome: string; logo_url: string | null }
  grupo?: { id: string; nome: string }
  vagas?: Array<{ index: number; nome: string; slot_letra: string | null; ocupada: boolean; equipe_nome: string | null; line_nome: string | null; logo_url: string | null }>
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita: boolean }>
}

export default function ConviteGrupoPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [data, setData] = useState<GroupInvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [vagaIndex, setVagaIndex] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [sucesso, setSucesso] = useState<{ equipe: string; line: string; referencia: string } | null>(null)

  const linesDisponiveis = useMemo(() => (data?.lines || []).filter((line) => !line.ja_inscrita), [data?.lines])
  const vagasLivres = useMemo(() => (data?.vagas || []).filter((vaga) => !vaga.ocupada), [data?.vagas])

  async function carregar() {
    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
    })
    const payload = await response.json()
    setData(payload)
    const primeiraVaga = (payload.vagas || []).find((vaga: any) => !vaga.ocupada)
    const primeiraLine = (payload.lines || []).find((line: any) => !line.ja_inscrita)
    setVagaIndex(primeiraVaga ? String(primeiraVaga.index) : '')
    setLineId(primeiraLine?.id || '')
    setLoading(false)
  }

  useEffect(() => { void carregar() }, [token])

  async function confirmar() {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return setMessage('Entre com sua conta de equipe para continuar.')
    if (vagaIndex === '') return setMessage('Selecione qual vaga esperada sua equipe vai ocupar.')
    if (!lineId && !nomeNovaLine.trim()) return setMessage('Selecione uma line disponivel ou crie uma nova.')

    setLoading(true)
    setMessage('')
    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
      body: JSON.stringify({ vaga_index: Number(vagaIndex), line_id: lineId || null, nome_line: lineId ? null : nomeNovaLine.trim() }),
    })
    const payload = await response.json()
    setLoading(false)
    if (!response.ok) return setMessage(payload.error || 'Nao foi possivel entrar no grupo.')
    setSucesso({ equipe: payload.equipe?.nome || 'Equipe', line: payload.line?.nome || 'Line', referencia: payload.referencia || 'Vaga' })
    await carregar()
  }

  if (loading) return <DropzoneLoader label="Carregando link de equipes" />

  if (!data || data.error) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Link inválido</h1>
          <p>{data?.error || 'Não foi possível carregar este link.'}</p>
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
          <p><strong>{sucesso.line}</strong> entrou como <strong>{sucesso.referencia}</strong> pela equipe <strong>{sucesso.equipe}</strong>.</p>
          <a className="button invite-confirm" href="/">Ir para o painel da equipe</a>
        </div>
      </main>
    )
  }

  return (
    <main className="invite-page">
      <div className="invite-card">
        {data.campeonato?.logo_url ? <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" /> : <Users size={42} />}
        <p className="eyebrow">Entrada de equipes</p>
        <h1>{data.campeonato?.nome}</h1>
        <p>{data.grupo?.nome}</p>

        <div className="lineup-slots public-lineup-slots">
          {(data.vagas || []).map((vaga) => (
            <div className={`lineup-slot ${vaga.ocupada ? 'occupied' : ''}`} key={vaga.index}>
              <b>{vaga.slot_letra || vaga.index + 1}</b>
              {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
              <div><strong>{vaga.nome}</strong><span>{vaga.ocupada ? `${vaga.line_nome || 'Line'} · ${vaga.equipe_nome || 'Equipe'}` : 'Disponível'}</span></div>
            </div>
          ))}
        </div>

        {data.autenticado ? (
          data.equipe ? (
            <div className="invite-team-confirmation">
              <div className="invite-current-team">
                <small>Confirmar com a equipe vinculada</small>
                <strong>{data.equipe.nome}</strong>
                {data.equipe.tag ? <span>{data.equipe.tag}</span> : null}
              </div>

              <label className="field">
                <span>Escolha a vaga esperada</span>
                <select value={vagaIndex} onChange={(event) => setVagaIndex(event.target.value)}>
                  {vagasLivres.map((vaga) => <option value={vaga.index} key={vaga.index}>{vaga.nome}</option>)}
                </select>
              </label>

              {linesDisponiveis.length ? (
                <label className="field">
                  <span>Escolha a line real</span>
                  <select value={lineId} onChange={(event) => { setLineId(event.target.value); setNomeNovaLine('') }}>
                    {linesDisponiveis.map((line) => <option value={line.id} key={line.id}>{line.nome}</option>)}
                    <option value="">Criar nova line</option>
                  </select>
                </label>
              ) : null}

              {!lineId ? (
                <label className="field">
                  <span>Nome da nova line</span>
                  <input value={nomeNovaLine} onChange={(event) => setNomeNovaLine(event.target.value)} placeholder="Ex.: OS MATADORES" />
                </label>
              ) : null}

              <button className="button invite-confirm" onClick={confirmar} disabled={!vagasLivres.length}>Confirmar entrada</button>
              <a className="button secondary" href={buildLoginHref('equipe', `/convite/grupo/${encodeURIComponent(token)}`, true)}>Usar outra equipe</a>
            </div>
          ) : (
            <div className="invite-auth-box">
              <p>Seu login está ativo, mas ainda não possui um perfil de equipe vinculado.</p>
              <a className="button" href={buildProfileCreationHref('equipe', `/convite/grupo/${encodeURIComponent(token)}`)}>Criar equipe com meu login atual</a>
              <a className="button secondary" href={buildLoginHref('equipe', `/convite/grupo/${encodeURIComponent(token)}`, true)}>Criar equipe com outro login</a>
            </div>
          )
        ) : (
          <div className="invite-auth-actions">
            <SocialLogin profileType="equipe" returnTo={`/convite/grupo/${encodeURIComponent(token)}`} />
          </div>
        )}

        {message ? <p className="invite-message">{message}</p> : null}
      </div>
    </main>
  )
}
