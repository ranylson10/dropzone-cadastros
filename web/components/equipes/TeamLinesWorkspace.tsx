'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { LineRosterManager } from './LineRosterManager'

export function TeamLinesWorkspace({ equipeId }: { equipeId: string }) {
  const [token, setToken] = useState('')
  const [lines, setLines] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [allowed, setAllowed] = useState(false)

  async function load(accessToken: string) {
    const response = await fetch(`/api/equipes/${equipeId}/lines`, { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } })
    if (!response.ok) return
    const payload = await response.json().catch(() => ({}))
    setLines(payload.lines || [])
    setAllowed(true)
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || ''
      if (!accessToken) return
      setToken(accessToken)
      void load(accessToken)
    })
  }, [equipeId])

  if (!allowed || !token) return null

  return <section className="team-lines-site-workspace">
    <div className="team-lines-site-head"><div><strong>Gerenciar lines e formações</strong><span>As alterações feitas aqui também aparecem na Lili.</span></div></div>
    {!selected ? <div className="team-lines-site-grid">{lines.map((line) => <button type="button" key={line.id} onClick={() => setSelected(line)}><span>{line.logo_url ? <img src={line.logo_url} alt=""/> : String(line.tag || line.nome || 'L').slice(0, 2)}</span><div><strong>{line.nome}</strong><small>{line.campeonatos?.length || 0} campeonato(s)</small></div><ChevronRightIcon/></button>)}</div> : <LineRosterManager accessToken={token} equipeId={equipeId} line={selected} onBack={() => setSelected(null)} onChanged={() => void load(token)}/>} 
  </section>
}

function ChevronRightIcon() { return <span aria-hidden="true">›</span> }
