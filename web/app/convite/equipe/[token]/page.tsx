'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, Shield, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

export default function ConviteEquipePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [logged, setLogged] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/convites/equipe/${encodeURIComponent(token)}`).then((r) => r.json()),
      supabase.auth.getSession(),
    ]).then(([payload, session]) => { setData(payload); setLogged(Boolean(session.data.session)); setLoading(false) })
  }, [token])

  async function aceitar() {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) { setMessage('Entre com sua conta de equipe e abra este link novamente.'); return }
    setLoading(true)
    const response = await fetch(`/api/convites/equipe/${encodeURIComponent(token)}`, { method: 'POST', headers: { Authorization: `Bearer ${session.session.access_token}` } })
    const payload = await response.json()
    setLoading(false)
    setMessage(response.ok ? 'Entrada confirmada com sucesso.' : payload.error || 'Não foi possível aceitar.')
    if (response.ok) setData((current: any) => ({ ...current, valido: false, aceito: true }))
  }

  if (loading) return <main className="invite-page"><Loader2 className="spin"/></main>
  if (!data || data.error) return <main className="invite-page"><div className="invite-card"><Shield size={38}/><h1>Convite inválido</h1><p>{data?.error || 'Não foi possível carregar este convite.'}</p></div></main>

  return <main className="invite-page"><div className="invite-card">
    {data.campeonato?.logo_url ? <img className="invite-champ-logo" src={data.campeonato.logo_url} alt=""/> : <Users size={42}/>}<p className="eyebrow">Convite DropZone</p><h1>{data.campeonato?.nome}</h1>
    <div className="invite-details"><span><strong>Vaga</strong>{String(data.vaga?.numero_vaga || '-').padStart(2, '0')}</span><span><strong>Equipe</strong>{data.convite?.nome_equipe_reservada}</span><span><strong>Line</strong>{data.convite?.nome_line_reservada}</span><span><strong>Validade</strong><Clock3 size={14}/> 24 horas</span></div>
    {data.valido ? <>{logged ? <button className="button invite-confirm" onClick={aceitar}>Confirmar entrada</button> : <div className="invite-auth-actions"><a className="button" href={`/?convite=${encodeURIComponent(token)}`}>Entrar</a><a className="button secondary" href={`/?convite=${encodeURIComponent(token)}&cadastro=equipe`}>Cadastrar equipe</a></div>}</> : <div className="invite-expired"><CheckCircle2 size={20}/>{data.aceito ? 'Convite aceito.' : 'Este convite expirou ou já foi utilizado.'}</div>}
    {message ? <p className="invite-message">{message}</p> : null}
  </div></main>
}
