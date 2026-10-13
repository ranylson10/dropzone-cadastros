'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShieldCheck, Swords, Trophy } from 'lucide-react'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import {
  requireTokenFlowAccessToken,
  tokenFlowAuthHeaders,
  tokenFlowPath,
  TokenFlowCard,
  TokenFlowPage,
  TokenFlowStatus,
} from '@/features/token-flow'

export default function TeamRosterInvitePage() {
  const token = String(useParams().token || '').trim()
  const returnTo = tokenFlowPath('equipeEntrar', token)
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/equipes/convites-elenco/${encodeURIComponent(token)}`)
      .then(async (res) => { const json = await res.json(); if (!res.ok) throw new Error(json.error); setInvite(json) })
      .catch(() => setError('Não foi possível carregar este convite. Confira o link ou peça um novo convite à equipe.'))
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    setLoading(true); setError('')
    try {
      const accessToken = await requireTokenFlowAccessToken('jogador', returnTo)
      if (!accessToken) return
      const res = await fetch(`/api/equipes/convites-elenco/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: tokenFlowAuthHeaders(accessToken, { 'X-Profile-Type': 'jogador' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <DropzoneLoader label="Carregando convite" />
  if (!invite) return <TokenFlowPage><TokenFlowCard>
    <ShieldCheck size={38} />
    <h1>Convite indisponível</h1>
    <TokenFlowStatus tone="error">{error || 'Este convite não está disponível.'}</TokenFlowStatus>
    <a className="button secondary" href="/">Ir para o início</a>
  </TokenFlowCard></TokenFlowPage>
  const team = invite?.equipe
  return (
    <TokenFlowPage>
      <TokenFlowCard>
        {team?.logo_url ? <img className="invite-champ-logo" src={team.logo_url} alt=""/> : <ShieldCheck size={64}/>}
        <p className="eyebrow">Convite de jogador</p>
        <h1>{team?.nome || 'Equipe'}</h1>
        {invite?.line ? <div className="invite-destination"><Swords size={17}/><div><strong>{invite.line.nome}</strong><span>Você também será adicionado a esta line.</span></div></div> : null}
        {invite?.campeonato ? <div className="invite-destination"><Trophy size={17}/><div><strong>{invite.campeonato.nome}</strong><span>A formação será atualizada somente se houver vaga e a regra permitir.</span></div></div> : null}
        {result ? <TokenFlowStatus tone="success">
          <strong>Convite aceito.</strong>
          <span>Você entrou no elenco da equipe{result.line_added ? ' e na line' : ''}.</span>
          {invite?.campeonato ? <span>{result.formation_added ? 'Você também foi incluído na formação como reserva.' : result.formation_reason || 'A formação não foi alterada.'}</span> : null}
        </TokenFlowStatus> : <button className="button invite-confirm" onClick={accept}>Aceitar convite</button>}
        {error ? <TokenFlowStatus tone="error">{error}</TokenFlowStatus> : null}
      </TokenFlowCard>
    </TokenFlowPage>
  )
}
