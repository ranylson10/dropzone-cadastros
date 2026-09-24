'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, LogIn, ShieldCheck, Users } from 'lucide-react'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { buildLoginHref } from '@/features/auth/auth-return'
import { supabase } from '@/lib/supabase-browser'
import './reivindicacao-equipe.css'

export default function ReivindicarEquipePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [destinoId, setDestinoId] = useState('')

  const returnTo = token ? `/equipe/reivindicar/${encodeURIComponent(token)}` : '/'
  const switchAccountHref = buildLoginHref(null, returnTo, true)
  const createAccountHref = `${switchAccountHref}&mode=criar`

  useEffect(() => {
    params.then((value) => setToken(decodeURIComponent(String(value.token || '').trim())))
  }, [params])

  useEffect(() => {
    if (token) void load()
  }, [token])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(`/api/equipes/reivindicacao/${encodeURIComponent(token)}`, {
        headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o convite.')
      setData(payload)
      if (!destinoId && payload.equipes_usuario?.[0]?.id) setDestinoId(payload.equipes_usuario[0].id)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível carregar o convite.')
    } finally {
      setLoading(false)
    }
  }

  const hasTeam = Boolean(data?.equipes_usuario?.length)
  const ownedTeam = data?.equipes_usuario?.[0] || null
  const lineNames = useMemo(() => (data?.lines || []).map((line: any) => line.nome).filter(Boolean), [data?.lines])

  async function submit(modo: 'assumir' | 'incorporar') {
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Entre com sua conta para continuar.')
      if (modo === 'incorporar' && !destinoId) throw new Error('Escolha a equipe que receberá o histórico desta equipe.')

      const response = await fetch(`/api/equipes/reivindicacao/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ modo, equipe_destino_id: modo === 'incorporar' ? destinoId : null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a reivindicação.')

      setSuccess(modo === 'assumir'
        ? 'Equipe vinculada à sua conta. O histórico competitivo foi preservado.'
        : 'Histórico incorporado à sua equipe. Lines, campeonatos e estatísticas foram preservados.')
      await load()
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível concluir a reivindicação.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="invite-page"><div className="invite-card"><Loader2 className="spin" size={34} /><h1>Carregando equipe...</h1></div></main>
  }

  if (!data) {
    return <main className="invite-page"><div className="invite-card"><ShieldCheck size={38} /><h1>Link indisponível</h1><p>{error || 'Não foi possível localizar esta equipe.'}</p></div></main>
  }

  if (!data.valido) {
    return <main className="invite-page"><div className="invite-card"><ShieldCheck size={38} /><p className="eyebrow">Reivindicação de equipe</p><h1>{data.equipe?.nome}</h1><p>Este link já foi utilizado, cancelado ou a equipe já possui responsável.</p>{success ? <div className="message">{success}</div> : null}</div></main>
  }

  return (
    <main className="invite-page">
      <div className="invite-card historical-team-claim-card">
        <ShieldCheck size={40} />
        <p className="eyebrow">Equipe histórica DropZone</p>
        <h1>{data.equipe?.nome}</h1>
        <p>
          Esta equipe foi cadastrada por uma produtora para preservar resultados de campeonatos anteriores.
          Reivindique o perfil sem perder o histórico competitivo.
        </p>

        <div className="historical-team-claim-summary">
          <span><small>Tag</small><strong>{data.equipe?.tag || '-'}</strong></span>
          <span><small>Lines</small><strong>{data.lines?.length || 0}</strong></span>
          <span><small>Participações</small><strong>{data.participacoes || 0}</strong></span>
        </div>

        {lineNames.length ? <p className="historical-team-lines">Lines: <strong>{lineNames.join(', ')}</strong></p> : null}
        {error ? <div className="message error">{error}</div> : null}
        {success ? <div className="message">{success}</div> : null}

        {!data.autenticado ? (
          <div className="historical-team-login">
            <h2>Entre para continuar</h2>
            <p>O sistema verificará se sua conta já possui uma equipe antes de concluir.</p>
            <SocialLogin returnTo={returnTo} />
            <a className="button secondary" href={buildLoginHref(null, returnTo, true)}><LogIn size={16} /> Usar outro login</a>
          </div>
        ) : !hasTeam ? (
          <div className="historical-team-action">
            <h2>Assumir esta equipe</h2>
            <p>Ela será vinculada ao seu login exatamente como está, incluindo suas lines, jogadores e todo o histórico existente.</p>
            <button className="button" type="button" disabled={submitting} onClick={() => void submit('assumir')}>
              {submitting ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Assumir equipe
            </button>
          </div>
        ) : (
          <div className="historical-team-action">
            <h2>Este login já possui uma equipe</h2>
            <div className="historical-team-owned-team">
              <span className="historical-team-owned-logo">
                {ownedTeam?.logo_url ? <img src={ownedTeam.logo_url} alt="" /> : <Users size={22} />}
              </span>
              <span><small>Equipe vinculada a este login</small><strong>{ownedTeam?.tag ? `[${ownedTeam.tag}] ` : ''}{ownedTeam?.nome}</strong></span>
            </div>
            <p>
              Ao continuar, <strong>{data.equipe?.nome}</strong> será incorporada a <strong>{ownedTeam?.nome}</strong>.
              Lines, jogadores, campeonatos e estatísticas serão preservados, e a equipe provisória desaparecerá.
            </p>
            <button className="button" type="button" disabled={submitting || !destinoId} onClick={() => void submit('incorporar')}>
              {submitting ? <Loader2 className="spin" size={16} /> : <Users size={16} />} Incorporar em {ownedTeam?.nome}
            </button>
            <div className="historical-team-account-alternative">
              <strong>Quer manter esta equipe separada?</strong>
              <span>Use outro login que ainda não possua uma equipe.</span>
              <div>
                <a className="button secondary" href={switchAccountHref}>Entrar com outro login</a>
                <a className="button secondary" href={createAccountHref}>Criar novo login</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
