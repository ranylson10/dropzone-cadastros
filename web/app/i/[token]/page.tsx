'use client'

import { useEffect, useState } from 'react'
import { Check, RefreshCw, Shield, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

function safeToken(value: string) {
  return String(value || '').trim().toUpperCase()
}

export default function PublicInscricaoPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [data, setData] = useState<any>(null)
  const [tracking, setTracking] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setToken(safeToken(p.token)))
  }, [params])

  useEffect(() => {
    if (token) loadData()
  }, [token])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/dropzone/public/inscricao/${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar link.')
      setData(json)
      if (!selectedTeam && json.equipes?.[0]?.id) setSelectedTeam(json.equipes[0].id)
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar link.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTracking() {
    setError('')
    try {
      const res = await fetch(`/api/dropzone/public/inscricao/${token}/acompanhamento`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao acompanhar.')
      setTracking(json)
    } catch (err: any) {
      setError(err?.message || 'Erro ao acompanhar.')
    }
  }

  async function submitRegistration() {
    setError('')
    setMessage('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Entre ou crie uma conta de jogador primeiro. Depois volte para este link.')
      const res = await fetch(`/api/dropzone/public/inscricao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ equipe_id: selectedTeam }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao inscrever.')
      setMessage('Inscrição realizada com sucesso.')
      await loadData()
      await loadTracking()
    } catch (err: any) {
      setError(err?.message || 'Erro ao inscrever.')
    }
  }

  if (loading) return <DropzoneLoader label="Carregando inscrição" />

  return (
    <main className="page public-page">
      <div className="shell public-shell">
        <section className="panel span-3 public-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Inscrição pública</p>
              <h2>{data?.campeonato?.nome || 'Carregando campeonato'}</h2>
              <span>{data?.grupo?.nome || ''}</span>
            </div>
            <Shield />
          </div>
          {error ? <div className="message error">{error}</div> : null}
          {message ? <div className="message">{message}</div> : null}

          {data ? (
            <div className="public-grid">
              <div className="panel-soft">
                <h3>Fazer inscrição</h3>
                <p className="empty">Escolha uma equipe do grupo. Para inscrever, você precisa estar logado como jogador neste navegador.</p>
                <Field label="Equipe do grupo">
                  <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} disabled={!data.inscricao_aberta}>
                    {data.equipes.map((team: any) => (
                      <option key={team.id} value={team.id}>{team.tag ? `[${team.tag}] ` : ''}{team.nome} · {team.vagas_usadas}/{data.regras?.vagas_por_equipe || 6}</option>
                    ))}
                  </select>
                </Field>
                <button className="button" disabled={!data.inscricao_aberta || !selectedTeam} onClick={submitRegistration}><Check size={16} /> Inscrever jogador</button>
                {!data.inscricao_aberta ? <p className="empty">As inscrições deste grupo estão encerradas ou ainda não abriram.</p> : null}
              </div>

              <div className="panel-soft">
                <h3>Acompanhar inscrições</h3>
                <p className="empty">Consulta pública para líder ou manager conferir equipes e jogadores cadastrados.</p>
                <button className="button secondary" onClick={loadTracking}><RefreshCw size={16} /> Acompanhar inscrições</button>
              </div>
            </div>
          ) : null}
        </section>

        {tracking ? (
          <section className="panel span-3 public-card">
            <div className="section-head"><h2>Inscrições por equipe</h2><Users /></div>
            <div className="public-grid">
              {tracking.equipes.map((team: any) => (
                <div className="panel-soft" key={team.id}>
                  <h3>{team.tag ? `[${team.tag}] ` : ''}{team.nome}</h3>
                  {team.jogadores.length === 0 ? <p className="empty">Nenhum jogador cadastrado.</p> : null}
                  {team.jogadores.map((player: any) => (
                    <div className="compact-row" key={player.id}>
                      <strong>{player.nick}</strong>
                      <span>{player.id_jogo} · {player.funcao}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}
