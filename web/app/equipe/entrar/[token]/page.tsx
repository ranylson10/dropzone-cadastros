'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { authHeaders } from '@/features/dropzone/utils'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

export default function TeamRosterInvitePage() {
  const token = String(useParams().token || '')
  const [team, setTeam] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [done, setDone] = useState(false)
  useEffect(() => { fetch(`/api/equipes/convites-elenco/${encodeURIComponent(token)}`).then(async (res) => { const json = await res.json(); if (!res.ok) throw new Error(json.error); setTeam(json.equipe) }).catch((err) => setError(err.message)).finally(() => setLoading(false)) }, [token])
  async function accept() {
    setLoading(true); setError('')
    try { const { data } = await supabase.auth.getSession(); if (!data.session) { window.location.href = `/?perfil=jogador&returnTo=${encodeURIComponent(`/equipe/entrar/${token}`)}`; return }; const res = await fetch(`/api/equipes/convites-elenco/${encodeURIComponent(token)}`, { method: 'POST', headers: authHeaders(data.session.access_token, 'jogador') }); const json = await res.json(); if (!res.ok) throw new Error(json.error); setDone(true) } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }
  if (loading) return <DropzoneLoader label="Carregando convite" />
  return <main className="invite-page"><section className="invite-card">{team?.logo_url ? <img className="invite-champ-logo" src={team.logo_url} alt=""/> : <ShieldCheck size={64}/>}<p className="eyebrow">Convite de equipe</p><h1>{team?.nome || 'Equipe'}</h1>{done ? <div className="invite-message">Você agora faz parte desta equipe.</div> : <button className="button invite-confirm" onClick={accept}>Entrar na equipe</button>}{error ? <div className="message error">{error}</div> : null}</section></main>
}
