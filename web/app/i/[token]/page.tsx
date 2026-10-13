'use client'

import { Select as UiSelect } from '@/components/ui/Field'
import { useEffect, useState } from 'react'
import { Check, RefreshCw, Shield, Users } from 'lucide-react'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { getTokenFlowAccessToken, tokenFlowAuthHeaders, tokenFlowPath, TokenFlowAccessGate, TokenFlowCard, TokenFlowPage, TokenFlowStatus } from '@/features/token-flow'
import { Field } from '@/components/ui'

function safeToken(value: string) {
  return String(value || '').trim().toUpperCase()
}

const GUEST_KEY = 'dropzone_inscricao_guest'

export default function PublicInscricaoPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [data, setData] = useState<any>(null)
  const [tracking, setTracking] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [gate, setGate] = useState(true)
  const [guest, setGuest] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const returnTo = tokenFlowPath('inscricao', token)

  useEffect(() => {
    params.then((p) => setToken(safeToken(p.token)))
  }, [params])

  useEffect(() => {
    if (token) void loadData()
  }, [token])

  // Logado sem jogador → formulário de criação (padrão)
  useEffect(() => {
    if (loading || !data) return
    if (data.error) return
    if (!data.autenticado) return
    if (data.jogador) return
    window.location.replace(buildProfileCreationHref('jogador', returnTo))
  }, [loading, data?.autenticado, data?.jogador, data?.error, returnTo, token])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const accessToken = await getTokenFlowAccessToken()
      const hasSession = Boolean(accessToken)
      const isGuest = sessionStorage.getItem(`${GUEST_KEY}:${token}`) === '1'
      setGuest(isGuest && !hasSession)
      setGate(!hasSession && !isGuest)

      const res = await fetch(`/api/dropzone/public/inscricao/${token}`, {
        headers: accessToken ? tokenFlowAuthHeaders(accessToken) : undefined,
        cache: 'no-store',
      })
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

  function continueAsGuest() {
    sessionStorage.setItem(`${GUEST_KEY}:${token}`, '1')
    setGuest(true)
    setGate(false)
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
    setSubmitting(true)
    try {
      const accessToken = await getTokenFlowAccessToken()
      if (!accessToken) {
        setGate(true)
        throw new Error('Entre com uma conta de jogador para se inscrever.')
      }
      if (!data?.jogador) {
        window.location.assign(buildProfileCreationHref('jogador', returnTo))
        return
      }
      const res = await fetch(`/api/dropzone/public/inscricao/${token}`, {
        method: 'POST',
        headers: tokenFlowAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ equipe_id: selectedTeam }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao inscrever.')
      setMessage('Inscrição realizada com sucesso.')
      await loadData()
      await loadTracking()
    } catch (err: any) {
      setError(err?.message || 'Erro ao inscrever.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <DropzoneLoader label="Carregando inscrição" />

  if (!data && error) {
    return (
      <TokenFlowPage>
        <TokenFlowCard>
          <Shield size={38} />
          <h1>Link inválido</h1>
          <TokenFlowStatus tone="error">{error}</TokenFlowStatus>
        </TokenFlowCard>
      </TokenFlowPage>
    )
  }

  if (data?.autenticado && !data?.jogador) {
    return (
      <TokenFlowPage>
        <TokenFlowCard>
          <Users size={42} />
          <p className="eyebrow">Perfil de jogador</p>
          <h1>Criando seu perfil de jogo...</h1>
          <p>
            Esta inscrição exige um <strong>perfil de jogador</strong>. Abrindo o cadastro...
          </p>
          <a className="button invite-confirm" href={buildProfileCreationHref('jogador', returnTo)}>
            Criar jogador agora
          </a>
          <a className="button secondary" href={buildLoginHref('jogador', returnTo, true)}>
            Usar outro login
          </a>
        </TokenFlowCard>
      </TokenFlowPage>
    )
  }

  const canRegister = Boolean(data?.autenticado && data?.jogador)

  return (
    <>
      <main className="page public-page">
        <div className="shell public-shell">
          <section className="panel span-3 public-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Inscrição pública</p>
                <h2>{data?.campeonato?.nome || 'Carregando campeonato'}</h2>
                <span>
                  {data?.grupo?.nome || ''}
                  {guest ? ' · modo visitante' : ''}
                </span>
              </div>
              <Shield />
            </div>
            {error ? <div className="message error">{error}</div> : null}
            {message ? <div className="message">{message}</div> : null}

            {data ? (
              <div className="public-grid">
                <div className="panel-soft">
                  <h3>Fazer inscrição</h3>
                  {canRegister ? (
                    <>
                      <div className="invite-current-team" style={{ marginBottom: 12 }}>
                        <small>Inscrever como</small>
                        <strong>{data.jogador.nome || data.jogador.username}</strong>
                        <span>
                          {data.jogador.id_jogo ? `ID: ${data.jogador.id_jogo}` : 'Jogador'}
                        </span>
                      </div>
                      <p className="empty">Escolha a line/equipe do grupo para se inscrever.</p>
                      <Field label="Equipe do grupo">
                        <UiSelect
                          value={selectedTeam}
                          onChange={(e) => setSelectedTeam(e.target.value)}
                          disabled={!data.inscricao_aberta}
                        >
                          {(data.equipes || []).map((team: any) => (
                            <option key={team.id} value={team.id}>
                              {team.tag ? `[${team.tag}] ` : ''}
                              {team.nome} · {team.vagas_usadas}/{data.regras?.vagas_por_equipe || 6}
                            </option>
                          ))}
                        </UiSelect>
                      </Field>
                      <button
                        className="button"
                        disabled={!data.inscricao_aberta || !selectedTeam || submitting}
                        onClick={() => void submitRegistration()}
                      >
                        <Check size={16} /> {submitting ? 'Inscrevendo...' : 'Inscrever jogador'}
                      </button>
                      {!data.inscricao_aberta ? (
                        <p className="empty">As inscrições deste grupo estão encerradas ou ainda não abriram.</p>
                      ) : null}
                      <a className="button secondary" href={buildLoginHref('jogador', returnTo, true)}>
                        Usar outro jogador
                      </a>
                    </>
                  ) : (
                    <>
                      <p className="empty">
                        Você está no modo visitante: pode acompanhar inscrições, mas para se inscrever precisa de um{' '}
                        <strong>perfil de jogador</strong>.
                      </p>
                      <button className="button" type="button" onClick={() => setGate(true)}>
                        Entrar com conta de jogador
                      </button>
                    </>
                  )}
                </div>

                <div className="panel-soft">
                  <h3>Acompanhar inscrições</h3>
                  <p className="empty">Consulta pública para conferir lines e jogadores cadastrados.</p>
                  <button className="button secondary" type="button" onClick={() => void loadTracking()}>
                    <RefreshCw size={16} /> Acompanhar inscrições
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {tracking ? (
            <section className="panel span-3 public-card">
              <div className="section-head">
                <h2>Inscrições por equipe</h2>
                <Users />
              </div>
              <div className="public-grid">
                {tracking.equipes.map((team: any) => (
                  <div className="panel-soft" key={team.id}>
                    <h3>
                      {team.tag ? `[${team.tag}] ` : ''}
                      {team.nome}
                    </h3>
                    {team.jogadores.length === 0 ? <p className="empty">Nenhum jogador cadastrado.</p> : null}
                    {team.jogadores.map((player: any) => (
                      <div className="compact-row" key={player.id}>
                        <strong>{player.nick}</strong>
                        <span>
                          {player.id_jogo} · {player.funcao}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <TokenFlowAccessGate
        open={gate}
        onClose={continueAsGuest}
        profileType="jogador"
        returnTo={returnTo}
        eyebrow="Inscrição pública"
        title="Como deseja continuar?"
        description={<>Para se inscrever você precisa de um <strong>perfil de jogador</strong>. Entre com Google/Facebook/Discord — se ainda não tiver jogador, o cadastro abre em seguida. Sem login você só acompanha as inscrições.</>}
        allowGuest
        guestLabel="Continuar sem login"
        onGuest={continueAsGuest}
      />
    </>
  )
}
