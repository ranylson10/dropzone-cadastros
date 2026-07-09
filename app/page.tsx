'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { LogOut, RefreshCw, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { PROFILE_TYPES, type DropZoneRow, type ProfileType } from '@/lib/types'
import { authEmail, cleanUsername } from '@/lib/validation'

type AuthMode = 'entrar' | 'criar'

const typeLabels: Record<ProfileType, string> = {
  produtora: 'Produtora',
  equipe: 'Equipe',
  jogador: 'Jogador',
  manager: 'Manager',
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function rowTitle(row: DropZoneRow) {
  if (row.name) return row.name
  if (row.username) return `@${row.username}`
  if (row.token) return row.token
  return row.entity_type
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>('entrar')
  const [profileType, setProfileType] = useState<ProfileType>('produtora')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [account, setAccount] = useState<DropZoneRow | null>(null)
  const [rows, setRows] = useState<DropZoneRow[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [championship, setChampionship] = useState({
    nome: '',
    logo_url: '',
    premiacao: '',
    divisao_premiacao: '',
    regras_url: '',
  })
  const [team, setTeam] = useState({
    nome: '',
    tag: '',
    logo_url: '',
    senha_dono: '',
  })
  const [group, setGroup] = useState({ nome: '', campeonato_id: '' })
  const [game, setGame] = useState({ nome: '', campeonato_id: '', data_jogo: '' })
  const [player, setPlayer] = useState({
    jogo_id: '',
    equipe_id: '',
    nick: '',
    foto_url: '',
    id_jogo: '',
    funcao: 'support',
    localidade: '',
  })

  const championships = useMemo(() => rows.filter((row) => row.entity_type === 'championship'), [rows])
  const teams = useMemo(() => rows.filter((row) => row.entity_type === 'team'), [rows])
  const games = useMemo(() => rows.filter((row) => row.entity_type === 'game'), [rows])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadMeAndRows(data.session.access_token)
    })
  }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function loadMeAndRows(token?: string) {
    const accessToken = token || await getToken()
    if (!accessToken) return

    const meRes = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const meJson = await meRes.json()
    if (!meRes.ok) throw new Error(meJson.error || 'Sessao invalida.')
    setAccount(meJson.account)

    const rowsRes = await fetch('/api/dropzone', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const rowsJson = await rowsRes.json()
    if (!rowsRes.ok) throw new Error(rowsJson.error || 'Erro ao listar dados.')
    setRows(rowsJson.rows || [])
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const clean = cleanUsername(username)
      if (mode === 'criar') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_type: profileType,
            username: clean,
            name,
            password,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erro ao cadastrar.')
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: authEmail(profileType, clean),
        password,
      })
      if (loginError || !data.session) throw new Error(loginError?.message || 'Login invalido.')

      await loadMeAndRows(data.session.access_token)
      setMessage('Login realizado.')
    } catch (err: any) {
      setError(err?.message || 'Falha na autenticacao.')
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAccount(null)
    setRows([])
    setMessage('')
    setError('')
  }

  async function createRow(payload: Record<string, unknown>) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch('/api/dropzone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar.')
      await loadMeAndRows(token)
      setMessage('Cadastro salvo na DropZone.')
      return json.row as DropZoneRow
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const isProdutora = account?.profile_type === 'produtora'

  return (
    <main className="page">
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">DZ</div>
            <div>
              <p className="eyebrow">DropZone</p>
              <h1>Cadastros</h1>
            </div>
          </div>
          {account ? (
            <button className="button secondary" onClick={signOut}>
              <LogOut size={16} /> Sair
            </button>
          ) : null}
        </div>

        <div className="grid">
          <section className="panel">
            {!account ? (
              <>
                <div className="tabs">
                  <button className={`tab ${mode === 'entrar' ? 'active' : ''}`} onClick={() => setMode('entrar')}>Entrar</button>
                  <button className={`tab ${mode === 'criar' ? 'active' : ''}`} onClick={() => setMode('criar')}>Criar conta</button>
                </div>
                <form onSubmit={handleAuth}>
                  <Field label="Tipo de perfil">
                    <select value={profileType} onChange={(e) => setProfileType(e.target.value as ProfileType)}>
                      {PROFILE_TYPES.map((type) => (
                        <option key={type} value={type}>{typeLabels[type]}</option>
                      ))}
                    </select>
                  </Field>
                  {mode === 'criar' ? (
                    <Field label="Nome exibido">
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da produtora, equipe ou jogador" />
                    </Field>
                  ) : null}
                  <Field label="Arroba unico">
                    <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@seuarroba" />
                  </Field>
                  <Field label="Senha">
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
                  </Field>
                  <button className="button" disabled={loading}>{mode === 'criar' ? 'Criar e entrar' : 'Entrar'}</button>
                </form>
              </>
            ) : (
              <>
                <p className="eyebrow">Conta ativa</p>
                <h2>{typeLabels[account.profile_type as ProfileType] || account.profile_type}</h2>
                <div className="panel-soft">
                  <strong>{account.name}</strong>
                  <p>@{account.username}</p>
                </div>
                <button className="button secondary" style={{ marginTop: 12 }} onClick={() => loadMeAndRows()} disabled={loading}>
                  <RefreshCw size={16} /> Atualizar dados
                </button>
              </>
            )}

            {message ? <div className="message">{message}</div> : null}
            {error ? <div className="message error">{error}</div> : null}
          </section>

          <section className="panel">
            {!account ? (
              <div className="panel-soft">
                <h2>Fluxo pronto</h2>
                <p>Crie uma conta do tipo produtora para cadastrar campeonatos e controlar equipes, grupos, jogos e links de inscricao.</p>
              </div>
            ) : (
              <div className="split">
                {isProdutora ? (
                  <>
                    <div className="panel-soft">
                      <h2>Novo campeonato</h2>
                      <Field label="Nome"><input value={championship.nome} onChange={(e) => setChampionship({ ...championship, nome: e.target.value })} /></Field>
                      <Field label="Logo URL"><input value={championship.logo_url} onChange={(e) => setChampionship({ ...championship, logo_url: e.target.value })} /></Field>
                      <Field label="Premiacao"><input value={championship.premiacao} onChange={(e) => setChampionship({ ...championship, premiacao: e.target.value })} /></Field>
                      <Field label="Divisao da premiacao"><textarea value={championship.divisao_premiacao} onChange={(e) => setChampionship({ ...championship, divisao_premiacao: e.target.value })} /></Field>
                      <Field label="Link das regras"><input value={championship.regras_url} onChange={(e) => setChampionship({ ...championship, regras_url: e.target.value })} /></Field>
                      <button className="button" onClick={() => createRow({ entity_type: 'championship', name: championship.nome, data: championship })}>Salvar campeonato</button>
                    </div>

                    <div className="panel-soft">
                      <h2>Nova equipe</h2>
                      <Field label="Nome"><input value={team.nome} onChange={(e) => setTeam({ ...team, nome: e.target.value })} /></Field>
                      <Field label="Tag"><input value={team.tag} onChange={(e) => setTeam({ ...team, tag: e.target.value.toUpperCase() })} /></Field>
                      <Field label="Logo URL"><input value={team.logo_url} onChange={(e) => setTeam({ ...team, logo_url: e.target.value })} /></Field>
                      <Field label="Senha do dono"><input value={team.senha_dono} onChange={(e) => setTeam({ ...team, senha_dono: e.target.value })} /></Field>
                      <button className="button" onClick={() => createRow({ entity_type: 'team', name: team.nome, data: team })}>Salvar equipe</button>
                    </div>

                    <div className="panel-soft">
                      <h2>Grupo</h2>
                      <Field label="Campeonato">
                        <select value={group.campeonato_id} onChange={(e) => setGroup({ ...group, campeonato_id: e.target.value })}>
                          <option value="">Selecione</option>
                          {championships.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Nome do grupo"><input value={group.nome} onChange={(e) => setGroup({ ...group, nome: e.target.value })} placeholder="Grupo A" /></Field>
                      <button className="button" onClick={() => createRow({ entity_type: 'group', name: group.nome, parent_id: group.campeonato_id, data: group })}>Criar grupo</button>
                    </div>

                    <div className="panel-soft">
                      <h2>Jogo e link</h2>
                      <Field label="Campeonato">
                        <select value={game.campeonato_id} onChange={(e) => setGame({ ...game, campeonato_id: e.target.value })}>
                          <option value="">Selecione</option>
                          {championships.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Nome do jogo"><input value={game.nome} onChange={(e) => setGame({ ...game, nome: e.target.value })} placeholder="Rodada 1" /></Field>
                      <Field label="Data"><input type="date" value={game.data_jogo} onChange={(e) => setGame({ ...game, data_jogo: e.target.value })} /></Field>
                      <button className="button" onClick={() => createRow({ entity_type: 'game', name: game.nome, parent_id: game.campeonato_id, data: game, generate_token: true, token_prefix: 'JOGO' })}>
                        Gerar jogo/link
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="panel-soft">
                    <h2>Inscricao de jogador</h2>
                    <Field label="Jogo">
                      <select value={player.jogo_id} onChange={(e) => setPlayer({ ...player, jogo_id: e.target.value })}>
                        <option value="">Selecione</option>
                        {games.map((row) => <option key={row.id} value={row.id}>{row.name} {row.token ? `- ${row.token}` : ''}</option>)}
                      </select>
                    </Field>
                    <Field label="Equipe">
                      <select value={player.equipe_id} onChange={(e) => setPlayer({ ...player, equipe_id: e.target.value })}>
                        <option value="">Selecione</option>
                        {teams.map((row) => <option key={row.id} value={row.id}>{row.data?.tag ? `[${String(row.data.tag)}] ` : ''}{row.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Nick"><input value={player.nick} onChange={(e) => setPlayer({ ...player, nick: e.target.value })} /></Field>
                    <Field label="Foto URL"><input value={player.foto_url} onChange={(e) => setPlayer({ ...player, foto_url: e.target.value })} /></Field>
                    <Field label="ID de jogo"><input value={player.id_jogo} onChange={(e) => setPlayer({ ...player, id_jogo: e.target.value })} /></Field>
                    <Field label="Funcao">
                      <select value={player.funcao} onChange={(e) => setPlayer({ ...player, funcao: e.target.value })}>
                        <option value="support">Support</option>
                        <option value="rush">Rush</option>
                        <option value="sniper">Sniper</option>
                        <option value="bomber">Bomber</option>
                      </select>
                    </Field>
                    <Field label="Localidade"><input value={player.localidade} onChange={(e) => setPlayer({ ...player, localidade: e.target.value })} /></Field>
                    <button className="button" onClick={() => createRow({ entity_type: 'player_registration', name: player.nick, parent_id: player.jogo_id, ref_id: player.equipe_id, data: player })}>
                      <Send size={16} /> Enviar inscricao
                    </button>
                  </div>
                )}

                <div className="panel-soft">
                  <h2>Registros na DropZone</h2>
                  <div className="cards">
                    {rows.map((row) => (
                      <div className="card" key={row.id}>
                        <p>{row.entity_type}</p>
                        <strong>{rowTitle(row)}</strong>
                        {row.token ? <p>Token: {row.token}</p> : null}
                        {row.entity_type === 'team' && row.data?.tag ? <p>Tag automatica: {String(row.data.tag)}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
