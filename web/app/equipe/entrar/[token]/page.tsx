'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShieldCheck, Swords, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { authHeaders } from '@/features/dropzone/utils'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { buildLoginHref } from '@/features/auth/auth-return'

export default function TeamRosterInvitePage() {
  const token = String(useParams().token || '')
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/equipes/convites-elenco/${encodeURIComponent(token)}`)
      .then(async (res) => { const json = await res.json(); if (!res.ok) throw new Error(json.error); setInvite(json) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    setLoading(true); setError('')
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        window.location.href = buildLoginHref('jogador', `/equipe/entrar/${encodeURIComponent(token)}`)
        return
      }
      const res = await fetch(`/api/equipes/convites-elenco/${encodeURIComponent(token)}`, { method: 'POST', headers: authHeaders(data.session.access_token, 'jogador') })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <DropzoneLoader label="Carregando convite" />
  const team = invite?.equipe
  return <main className="invite-page"><section className="invite-card">
    {team?.logo_url ? <img className="invite-champ-logo" src={team.logo_url} alt=""/> : <ShieldCheck size={64}/>} 
    <p className="eyebrow">Convite de jogador</p>
    <h1>{team?.nome || 'Equipe'}</h1>
    {invite?.line ? <div className="invite-destination"><Swords size={17}/><div><strong>{invite.line.nome}</strong><span>Você também será adicionado a esta line.</span></div></div> : null}
    {invite?.campeonato ? <div className="invite-destination"><Trophy size={17}/><div><strong>{invite.campeonato.nome}</strong><span>A formação será atualizada somente se houver vaga e a regra permitir.</span></div></div> : null}
    {result ? <div className="invite-message">
      <strong>Convite aceito.</strong>
      <span>Você entrou no elenco da equipe{result.line_added ? ' e na line' : ''}.</span>
      {invite?.campeonato ? <span>{result.formation_added ? 'Você também foi incluído na formação como reserva.' : result.formation_reason || 'A formação não foi alterada.'}</span> : null}
    </div> : <button className="button invite-confirm" onClick={accept}>Aceitar convite</button>}
    {error ? <div className="message error">{error}</div> : null}
  </section></main>
}
