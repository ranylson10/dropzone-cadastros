'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Copy, Crown, Gamepad2, LogOut, RefreshCw, Send, Shield, Trophy, UserCog, Users } from 'lucide-react'
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

const typeDescriptions: Record<ProfileType, string> = {
  produtora: 'Cria campeonatos, organiza equipes, grupos, jogos e convites.',
  equipe: 'Aceita convite da produtora e gera tokens para escalar jogadores.',
  jogador: 'Acompanha campeonatos inscritos e entra por token da equipe.',
  manager: 'Ajuda a equipe a controlar inscricoes e tokens de jogadores.',
}

const profileIcons: Record<ProfileType, React.ReactNode> = {
  produtora: <Crown size={21} />,
  equipe: <Shield size={21} />,
  jogador: <Gamepad2 size={21} />,
  manager: <UserCog size={21} />,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function rowTitle(row?: DropZoneRow | null) {
  if (!row) return '-'
  if (row.name) return row.name
  if (row.username) return `@${row.username}`
  if (row.token) return row.token
  return row.entity_type
}

function dataText(row: DropZoneRow | undefined, key: string) {
  const value = row?.data?.[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function tokenText(token: string | null) {
  return token || 'sem-token'
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
  const [selectedChampId, setSelectedChampId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [teamInviteToken, setTeamInviteToken] = useState('')
  const [teamPanelToken, setTeamPanelToken] = useState('')
  const [teamPlayerChampId, setTeamPlayerChampId] = useState('')
  const [teamPlayerTeamId, setTeamPlayerTeamId] = useState('')
  const [playerToken, setPlayerToken] = useState('')
  const [player, setPlayer] = useState({
    nick: '',
    foto_url: '',
    id_jogo: '',
    funcao: 'support',
    localidade: '',
    senha: '',
  })

  const championships = useMemo(() => rows.filter((row) => row.entity_type === 'championship'), [rows])
  const teams = useMemo(() => rows.filter((row) => row.entity_type === 'team'), [rows])
  const links = useMemo(() => rows.filter((row) => row.entity_type === 'championship_team'), [rows])
  const groups = useMemo(() => rows.filter((row) => row.entity_type === 'group'), [rows])
  const games = useMemo(() => rows.filter((row) => row.entity_type === 'game'), [rows])
  const tokens = useMemo(() => rows.filter((row) => row.entity_type === 'invite_token'), [rows])
  const registrations = useMemo(() => rows.filter((row) => row.entity_type === 'player_registration'), [rows])

  const selectedChamp = championships.find((row) => row.id === selectedChampId) || championships[0]
  const selectedChampTeams = links
    .filter((link) => link.parent_id === selectedChamp?.id)
    .map((link) => teams.find((teamRow) => teamRow.id === link.ref_id))
    .filter(Boolean) as DropZoneRow[]

  const managedTeamIds = useMemo(() => {
    if (!account) return []
    const direct = teams.filter((row) => row.created_by === account.auth_user_id).map((row) => row.id)
    const linked = links.filter((row) => row.created_by === account.auth_user_id).map((row) => String(row.ref_id || ''))
    return Array.from(new Set([...direct, ...linked].filter(Boolean)))
  }, [account, teams, links])

  const managedTeams = teams.filter((row) => managedTeamIds.includes(row.id))
  const managedLinks = links.filter((row) => row.ref_id && managedTeamIds.includes(row.ref_id))
  const managedChampionships = championships.filter((row) => managedLinks.some((link) => link.parent_id === row.id))
  const playerInvite = tokens.find((row) => row.token?.toUpperCase() === playerToken.trim().toUpperCase() && row.data?.token_kind === 'player_invite')
  const myRegistrations = registrations.filter((row) => row.created_by === account?.auth_user_id)

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

  async function createRow(payload: Record<string, unknown>, success = 'Cadastro salvo na DropZone.') {
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
      setMessage(success)
      return json.row as DropZoneRow
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  async function copyToken(value: string | null) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setMessage(`Token copiado: ${value}`)
  }

  async function createChampionship() {
    if (!championship.nome.trim()) return setError('Informe o nome do campeonato.')
    await createRow({ entity_type: 'championship', name: championship.nome, data: championship }, 'Campeonato criado.')
    setChampionship({ nome: '', logo_url: '', premiacao: '', divisao_premiacao: '', regras_url: '' })
  }

  async function createTeam() {
    if (!team.nome.trim() || !team.tag.trim()) return setError('Informe nome e tag da equipe.')
    await createRow({ entity_type: 'team', name: team.nome, data: { ...team, owner_username: account?.username } }, 'Equipe criada.')
    setTeam({ nome: '', tag: '', logo_url: '', senha_dono: '' })
  }

  async function addTeamToChamp(championshipId = selectedChamp?.id, teamId = selectedTeamId) {
    const champ = championships.find((row) => row.id === championshipId)
    const teamRow = teams.find((row) => row.id === teamId)
    if (!champ || !teamRow) return setError('Selecione campeonato e equipe.')
    if (links.some((row) => row.parent_id === champ.id && row.ref_id === teamRow.id)) {
      return setError('Essa equipe ja esta nesse campeonato.')
    }
    await createRow({
      entity_type: 'championship_team',
      name: `${rowTitle(teamRow)} em ${rowTitle(champ)}`,
      parent_id: champ.id,
      ref_id: teamRow.id,
      data: {
        championship_id: champ.id,
        championship_name: champ.name,
        team_id: teamRow.id,
        team_name: teamRow.name,
        team_tag: dataText(teamRow, 'tag'),
      },
    }, 'Equipe adicionada ao campeonato.')
  }

  async function generateTeamInvite() {
    const champ = selectedChamp
    const teamRow = teams.find((row) => row.id === selectedTeamId)
    if (!champ || !teamRow) return setError('Selecione campeonato e equipe para gerar o convite.')
    await createRow({
      entity_type: 'invite_token',
      name: `Convite equipe ${rowTitle(teamRow)}`,
      parent_id: champ.id,
      ref_id: teamRow.id,
      generate_token: true,
      token_prefix: 'EQ',
      data: {
        token_kind: 'team_invite',
        championship_id: champ.id,
        championship_name: champ.name,
        team_id: teamRow.id,
        team_name: teamRow.name,
        team_tag: dataText(teamRow, 'tag'),
      },
    }, 'Token unico da equipe gerado.')
  }

  async function createGroup() {
    const champId = group.campeonato_id || selectedChamp?.id
    const champ = championships.find((row) => row.id === champId)
    if (!champ || !group.nome.trim()) return setError('Selecione o campeonato e informe o nome do grupo.')
    await createRow({
      entity_type: 'group',
      name: group.nome,
      parent_id: champ.id,
      data: {
        ...group,
        campeonato_id: champ.id,
        championship_name: champ.name,
      },
    }, 'Grupo criado no campeonato.')
    setGroup({ nome: '', campeonato_id: champ.id })
  }

  async function createGame() {
    const champId = game.campeonato_id || selectedChamp?.id
    const champ = championships.find((row) => row.id === champId)
    if (!champ || !game.nome.trim()) return setError('Selecione o campeonato e informe o nome do jogo.')
    await createRow({
      entity_type: 'game',
      name: game.nome,
      parent_id: champ.id,
      generate_token: true,
      token_prefix: 'JOGO',
      data: {
        ...game,
        campeonato_id: champ.id,
        championship_name: champ.name,
      },
    }, 'Jogo criado com token.')
    setGame({ nome: '', campeonato_id: champ.id, data_jogo: '' })
  }

  async function acceptTeamInvite() {
    const invite = tokens.find((row) => row.token?.toUpperCase() === teamPanelToken.trim().toUpperCase() && row.data?.token_kind === 'team_invite')
    if (!invite) return setError('Token de equipe nao encontrado.')
    await addTeamToChamp(String(invite.parent_id || ''), String(invite.ref_id || ''))
    setTeamPanelToken('')
  }

  async function generatePlayerInvite() {
    const champ = championships.find((row) => row.id === teamPlayerChampId)
    const teamRow = teams.find((row) => row.id === teamPlayerTeamId)
    if (!champ || !teamRow) return setError('Selecione campeonato e equipe.')
    await createRow({
      entity_type: 'invite_token',
      name: `Token jogador ${rowTitle(teamRow)}`,
      parent_id: champ.id,
      ref_id: teamRow.id,
      generate_token: true,
      token_prefix: 'JG',
      data: {
        token_kind: 'player_invite',
        championship_id: champ.id,
        championship_name: champ.name,
        team_id: teamRow.id,
        team_name: teamRow.name,
        team_tag: dataText(teamRow, 'tag'),
      },
    }, 'Token de jogador gerado para envio.')
  }

  async function registerPlayerByToken() {
    if (!playerInvite) return setError('Digite um token valido enviado pela equipe.')
    if (!player.nick.trim() || !player.id_jogo.trim()) return setError('Informe nick e ID de jogo.')
    await createRow({
      entity_type: 'player_registration',
      name: player.nick,
      parent_id: playerInvite.parent_id,
      ref_id: playerInvite.ref_id,
      data: {
        ...player,
        token: playerInvite.token,
        championship_id: playerInvite.parent_id,
        championship_name: playerInvite.data?.championship_name,
        team_id: playerInvite.ref_id,
        team_name: playerInvite.data?.team_name,
        team_tag: playerInvite.data?.team_tag,
        player_username: account?.username,
      },
    }, 'Jogador inscrito e escalado na equipe.')
    setPlayerToken('')
    setPlayer({ nick: '', foto_url: '', id_jogo: '', funcao: 'support', localidade: '', senha: '' })
  }

  return (
    <main className="page">
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">DZ</div>
            <div>
              <p className="eyebrow">DropZone</p>
              <h1>{account ? `Painel ${typeLabels[account.profile_type as ProfileType]}` : 'Cadastros'}</h1>
            </div>
          </div>
          {account ? (
            <div className="toolbar">
              <button className="button secondary" onClick={() => loadMeAndRows()} disabled={loading}>
                <RefreshCw size={16} /> Atualizar
              </button>
              <button className="button secondary" onClick={signOut}>
                <LogOut size={16} /> Sair
              </button>
            </div>
          ) : null}
        </div>

        {!account ? (
          <div className="login-layout">
            <section className="profile-picker">
              <p className="eyebrow">Escolha seu acesso</p>
              <h2>Tipo de usuario</h2>
              <div className="profile-cards">
                {PROFILE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`profile-card ${profileType === type ? 'active' : ''}`}
                    onClick={() => setProfileType(type)}
                  >
                    <span>{profileIcons[type]}</span>
                    <strong>{typeLabels[type]}</strong>
                    <small>{typeDescriptions[type]}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel auth-panel">
              <div className="tabs">
                <button className={`tab ${mode === 'entrar' ? 'active' : ''}`} onClick={() => setMode('entrar')}>Entrar</button>
                <button className={`tab ${mode === 'criar' ? 'active' : ''}`} onClick={() => setMode('criar')}>Criar conta</button>
              </div>
              <form onSubmit={handleAuth}>
                <div className="selected-profile">
                  <span>{profileIcons[profileType]}</span>
                  <div>
                    <strong>{typeLabels[profileType]}</strong>
                    <p>{typeDescriptions[profileType]}</p>
                  </div>
                </div>
                {mode === 'criar' ? (
                  <Field label="Nome exibido">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome publico do perfil" />
                  </Field>
                ) : null}
                <Field label="Arroba unico">
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@seuarroba" />
                </Field>
                <Field label="Senha">
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
                </Field>
                <button className="button wide" disabled={loading}>{mode === 'criar' ? 'Criar e entrar' : 'Entrar'}</button>
              </form>
              {message ? <div className="message">{message}</div> : null}
              {error ? <div className="message error">{error}</div> : null}
            </section>
          </div>
        ) : (
          <>
            <section className="account-strip">
              <div>
                <p className="eyebrow">Conta ativa</p>
                <strong>{account.name} <span>@{account.username}</span></strong>
              </div>
              <div className="metric"><b>{championships.length}</b><span>Campeonatos</span></div>
              <div className="metric"><b>{teams.length}</b><span>Equipes</span></div>
              <div className="metric"><b>{registrations.length}</b><span>Inscricoes</span></div>
            </section>

            {account.profile_type === 'produtora' ? (
              <ProdutoraPanel
                championships={championships}
                teams={teams}
                groups={groups}
                games={games}
                tokens={tokens}
                selectedChamp={selectedChamp}
                selectedChampTeams={selectedChampTeams}
                selectedChampId={selectedChampId}
                setSelectedChampId={setSelectedChampId}
                selectedTeamId={selectedTeamId}
                setSelectedTeamId={setSelectedTeamId}
                championship={championship}
                setChampionship={setChampionship}
                team={team}
                setTeam={setTeam}
                group={group}
                setGroup={setGroup}
                game={game}
                setGame={setGame}
                createChampionship={createChampionship}
                createTeam={createTeam}
                createGroup={createGroup}
                createGame={createGame}
                addTeamToChamp={() => addTeamToChamp()}
                generateTeamInvite={generateTeamInvite}
                copyToken={copyToken}
                loading={loading}
              />
            ) : null}

            {account.profile_type === 'equipe' || account.profile_type === 'manager' ? (
              <EquipePanel
                accountType={account.profile_type}
                teams={teams}
                managedTeams={managedTeams}
                managedChampionships={managedChampionships}
                managedLinks={managedLinks}
                tokens={tokens}
                team={team}
                setTeam={setTeam}
                createTeam={createTeam}
                teamPanelToken={teamPanelToken}
                setTeamPanelToken={setTeamPanelToken}
                acceptTeamInvite={acceptTeamInvite}
                teamPlayerChampId={teamPlayerChampId}
                setTeamPlayerChampId={setTeamPlayerChampId}
                teamPlayerTeamId={teamPlayerTeamId}
                setTeamPlayerTeamId={setTeamPlayerTeamId}
                generatePlayerInvite={generatePlayerInvite}
                copyToken={copyToken}
                loading={loading}
              />
            ) : null}

            {account.profile_type === 'jogador' ? (
              <JogadorPanel
                playerToken={playerToken}
                setPlayerToken={setPlayerToken}
                playerInvite={playerInvite}
                player={player}
                setPlayer={setPlayer}
                registerPlayerByToken={registerPlayerByToken}
                registrations={myRegistrations}
                loading={loading}
              />
            ) : null}

            {message ? <div className="message floating">{message}</div> : null}
            {error ? <div className="message error floating">{error}</div> : null}
          </>
        )}
      </div>
    </main>
  )
}

function ProdutoraPanel(props: {
  championships: DropZoneRow[]
  teams: DropZoneRow[]
  groups: DropZoneRow[]
  games: DropZoneRow[]
  tokens: DropZoneRow[]
  selectedChamp?: DropZoneRow
  selectedChampTeams: DropZoneRow[]
  selectedChampId: string
  setSelectedChampId: (value: string) => void
  selectedTeamId: string
  setSelectedTeamId: (value: string) => void
  championship: { nome: string; logo_url: string; premiacao: string; divisao_premiacao: string; regras_url: string }
  setChampionship: (value: any) => void
  team: { nome: string; tag: string; logo_url: string; senha_dono: string }
  setTeam: (value: any) => void
  group: { nome: string; campeonato_id: string }
  setGroup: (value: any) => void
  game: { nome: string; campeonato_id: string; data_jogo: string }
  setGame: (value: any) => void
  createChampionship: () => void
  createTeam: () => void
  createGroup: () => void
  createGame: () => void
  addTeamToChamp: () => void
  generateTeamInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
}) {
  const teamInvites = props.tokens.filter((row) => row.data?.token_kind === 'team_invite' && row.parent_id === props.selectedChamp?.id)
  const champGroups = props.groups.filter((row) => row.parent_id === props.selectedChamp?.id)
  const champGames = props.games.filter((row) => row.parent_id === props.selectedChamp?.id)

  return (
    <div className="dashboard">
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Produtora</p>
            <h2>Campeonatos</h2>
          </div>
          <Trophy />
        </div>
        <div className="list">
          {props.championships.length === 0 ? <p className="empty">Nenhum campeonato criado ainda.</p> : null}
          {props.championships.map((champ) => (
            <button
              key={champ.id}
              className={`list-item ${props.selectedChamp?.id === champ.id ? 'active' : ''}`}
              onClick={() => props.setSelectedChampId(champ.id)}
            >
              <strong>{rowTitle(champ)}</strong>
              <span>{dataText(champ, 'premiacao') || 'Premiacao nao informada'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel span-2">
        <div className="section-head">
          <div>
            <p className="eyebrow">Criar</p>
            <h2>Novo campeonato</h2>
          </div>
          <CalendarDays />
        </div>
        <div className="form-grid">
          <Field label="Nome"><input value={props.championship.nome} onChange={(e) => props.setChampionship({ ...props.championship, nome: e.target.value })} /></Field>
          <Field label="Logo URL"><input value={props.championship.logo_url} onChange={(e) => props.setChampionship({ ...props.championship, logo_url: e.target.value })} /></Field>
          <Field label="Premiacao"><input value={props.championship.premiacao} onChange={(e) => props.setChampionship({ ...props.championship, premiacao: e.target.value })} /></Field>
          <Field label="Link das regras"><input value={props.championship.regras_url} onChange={(e) => props.setChampionship({ ...props.championship, regras_url: e.target.value })} /></Field>
          <Field label="Divisao da premiacao"><textarea value={props.championship.divisao_premiacao} onChange={(e) => props.setChampionship({ ...props.championship, divisao_premiacao: e.target.value })} /></Field>
        </div>
        <button className="button" onClick={props.createChampionship} disabled={props.loading}>Salvar campeonato</button>
      </section>

      <section className="panel span-2">
        <div className="section-head">
          <div>
            <p className="eyebrow">Organizar</p>
            <h2>{rowTitle(props.selectedChamp)}</h2>
          </div>
          <Users />
        </div>
        <div className="mini-grid">
          <div className="panel-soft">
            <h3>Equipes no campeonato</h3>
            {props.selectedChampTeams.length === 0 ? <p className="empty">Adicione equipe ou gere convite unico.</p> : null}
            {props.selectedChampTeams.map((team) => (
              <div className="compact-row" key={team.id}>
                <strong>{dataText(team, 'tag') ? `[${dataText(team, 'tag')}] ` : ''}{rowTitle(team)}</strong>
              </div>
            ))}
          </div>
          <div className="panel-soft">
            <h3>Adicionar equipe</h3>
            <Field label="Equipe existente">
              <select value={props.selectedTeamId} onChange={(e) => props.setSelectedTeamId(e.target.value)}>
                <option value="">Selecione</option>
                {props.teams.map((team) => <option key={team.id} value={team.id}>{dataText(team, 'tag') ? `[${dataText(team, 'tag')}] ` : ''}{team.name}</option>)}
              </select>
            </Field>
            <div className="button-row">
              <button className="button secondary" onClick={props.addTeamToChamp}>Adicionar</button>
              <button className="button" onClick={props.generateTeamInvite}>Gerar token</button>
            </div>
          </div>
          <div className="panel-soft">
            <h3>Cadastrar equipe manual</h3>
            <Field label="Nome"><input value={props.team.nome} onChange={(e) => props.setTeam({ ...props.team, nome: e.target.value })} /></Field>
            <Field label="Tag"><input value={props.team.tag} onChange={(e) => props.setTeam({ ...props.team, tag: e.target.value.toUpperCase() })} /></Field>
            <Field label="Logo URL"><input value={props.team.logo_url} onChange={(e) => props.setTeam({ ...props.team, logo_url: e.target.value })} /></Field>
            <Field label="Senha do dono"><input value={props.team.senha_dono} onChange={(e) => props.setTeam({ ...props.team, senha_dono: e.target.value })} /></Field>
            <button className="button" onClick={props.createTeam}>Salvar equipe</button>
          </div>
          <div className="panel-soft">
            <h3>Tokens de equipe</h3>
            {teamInvites.length === 0 ? <p className="empty">Nenhum convite gerado.</p> : null}
            {teamInvites.map((token) => (
              <button key={token.id} className="token-card" onClick={() => props.copyToken(token.token)}>
                <span>{dataText(token, 'team_tag') || 'Equipe'}</span>
                <strong>{tokenText(token.token)}</strong>
                <Copy size={15} />
              </button>
            ))}
          </div>
          <div className="panel-soft">
            <h3>Grupos</h3>
            {champGroups.map((group) => (
              <div className="compact-row" key={group.id}><strong>{rowTitle(group)}</strong></div>
            ))}
            {champGroups.length === 0 ? <p className="empty">Nenhum grupo criado.</p> : null}
            <Field label="Novo grupo"><input value={props.group.nome} onChange={(e) => props.setGroup({ ...props.group, nome: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} placeholder="Grupo A" /></Field>
            <button className="button" onClick={props.createGroup}>Criar grupo</button>
          </div>
          <div className="panel-soft">
            <h3>Jogos e rodadas</h3>
            {champGames.map((game) => (
              <button className="token-card" key={game.id} onClick={() => props.copyToken(game.token)}>
                <span>{dataText(game, 'data_jogo') || 'Sem data'}</span>
                <strong>{rowTitle(game)}</strong>
                {game.token ? <small>{game.token}</small> : null}
              </button>
            ))}
            {champGames.length === 0 ? <p className="empty">Nenhum jogo criado.</p> : null}
            <Field label="Nome do jogo"><input value={props.game.nome} onChange={(e) => props.setGame({ ...props.game, nome: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} placeholder="Rodada 1" /></Field>
            <Field label="Data"><input type="date" value={props.game.data_jogo} onChange={(e) => props.setGame({ ...props.game, data_jogo: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} /></Field>
            <button className="button" onClick={props.createGame}>Criar jogo</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function EquipePanel(props: {
  accountType: string | null
  teams: DropZoneRow[]
  managedTeams: DropZoneRow[]
  managedChampionships: DropZoneRow[]
  managedLinks: DropZoneRow[]
  tokens: DropZoneRow[]
  team: { nome: string; tag: string; logo_url: string; senha_dono: string }
  setTeam: (value: any) => void
  createTeam: () => void
  teamPanelToken: string
  setTeamPanelToken: (value: string) => void
  acceptTeamInvite: () => void
  teamPlayerChampId: string
  setTeamPlayerChampId: (value: string) => void
  teamPlayerTeamId: string
  setTeamPlayerTeamId: (value: string) => void
  generatePlayerInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
}) {
  const playerInvites = props.tokens.filter((row) => row.data?.token_kind === 'player_invite' && row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id))

  return (
    <div className="dashboard">
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">{props.accountType === 'manager' ? 'Manager' : 'Equipe'}</p>
            <h2>Minhas equipes</h2>
          </div>
          <Shield />
        </div>
        {props.managedTeams.length === 0 ? <p className="empty">Crie uma equipe ou use um token enviado pela produtora.</p> : null}
        <div className="cards compact">
          {props.managedTeams.map((team) => (
            <div className="card" key={team.id}>
              <p>{dataText(team, 'tag') || 'TAG'}</p>
              <strong>{rowTitle(team)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Criar minha equipe</h2>
        <Field label="Nome"><input value={props.team.nome} onChange={(e) => props.setTeam({ ...props.team, nome: e.target.value })} /></Field>
        <Field label="Tag"><input value={props.team.tag} onChange={(e) => props.setTeam({ ...props.team, tag: e.target.value.toUpperCase() })} /></Field>
        <Field label="Logo URL"><input value={props.team.logo_url} onChange={(e) => props.setTeam({ ...props.team, logo_url: e.target.value })} /></Field>
        <Field label="Senha do dono"><input value={props.team.senha_dono} onChange={(e) => props.setTeam({ ...props.team, senha_dono: e.target.value })} /></Field>
        <button className="button" onClick={props.createTeam}>Salvar equipe</button>
      </section>

      <section className="panel">
        <h2>Entrar em campeonato</h2>
        <Field label="Token enviado pela produtora">
          <input value={props.teamPanelToken} onChange={(e) => props.setTeamPanelToken(e.target.value.toUpperCase())} placeholder="EQ-..." />
        </Field>
        <button className="button" onClick={props.acceptTeamInvite}>Aceitar convite</button>
      </section>

      <section className="panel span-2">
        <div className="section-head">
          <div>
            <p className="eyebrow">Escalacao</p>
            <h2>Gerar token para jogador</h2>
          </div>
          <Send />
        </div>
        <div className="form-grid">
          <Field label="Campeonato">
            <select value={props.teamPlayerChampId} onChange={(e) => props.setTeamPlayerChampId(e.target.value)}>
              <option value="">Selecione</option>
              {props.managedChampionships.map((champ) => <option key={champ.id} value={champ.id}>{champ.name}</option>)}
            </select>
          </Field>
          <Field label="Equipe">
            <select value={props.teamPlayerTeamId} onChange={(e) => props.setTeamPlayerTeamId(e.target.value)}>
              <option value="">Selecione</option>
              {props.managedTeams.map((team) => <option key={team.id} value={team.id}>{dataText(team, 'tag') ? `[${dataText(team, 'tag')}] ` : ''}{team.name}</option>)}
            </select>
          </Field>
        </div>
        <button className="button" onClick={props.generatePlayerInvite}>Gerar token do jogador</button>
        <div className="token-list">
          {playerInvites.map((token) => (
            <button key={token.id} className="token-card" onClick={() => props.copyToken(token.token)}>
              <span>{dataText(token, 'championship_name')}</span>
              <strong>{tokenText(token.token)}</strong>
              <Copy size={15} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function JogadorPanel(props: {
  playerToken: string
  setPlayerToken: (value: string) => void
  playerInvite?: DropZoneRow
  player: { nick: string; foto_url: string; id_jogo: string; funcao: string; localidade: string; senha: string }
  setPlayer: (value: any) => void
  registerPlayerByToken: () => void
  registrations: DropZoneRow[]
  loading: boolean
}) {
  return (
    <div className="dashboard">
      <section className="panel span-2">
        <div className="section-head">
          <div>
            <p className="eyebrow">Jogador</p>
            <h2>Entrar por token da equipe</h2>
          </div>
          <Gamepad2 />
        </div>
        <Field label="Token recebido">
          <input value={props.playerToken} onChange={(e) => props.setPlayerToken(e.target.value.toUpperCase())} placeholder="JG-..." />
        </Field>
        {props.playerInvite ? (
          <div className="invite-preview">
            <strong>{String(props.playerInvite.data?.championship_name || 'Campeonato')}</strong>
            <span>{String(props.playerInvite.data?.team_tag || '')} {String(props.playerInvite.data?.team_name || 'Equipe')}</span>
          </div>
        ) : null}
        <div className="form-grid">
          <Field label="Nick"><input value={props.player.nick} onChange={(e) => props.setPlayer({ ...props.player, nick: e.target.value })} /></Field>
          <Field label="ID de jogo"><input value={props.player.id_jogo} onChange={(e) => props.setPlayer({ ...props.player, id_jogo: e.target.value })} /></Field>
          <Field label="Foto URL"><input value={props.player.foto_url} onChange={(e) => props.setPlayer({ ...props.player, foto_url: e.target.value })} /></Field>
          <Field label="Funcao">
            <select value={props.player.funcao} onChange={(e) => props.setPlayer({ ...props.player, funcao: e.target.value })}>
              <option value="support">Support</option>
              <option value="rush">Rush</option>
              <option value="sniper">Sniper</option>
              <option value="bomber">Bomber</option>
            </select>
          </Field>
          <Field label="Localidade"><input value={props.player.localidade} onChange={(e) => props.setPlayer({ ...props.player, localidade: e.target.value })} /></Field>
          <Field label="Senha"><input type="password" value={props.player.senha} onChange={(e) => props.setPlayer({ ...props.player, senha: e.target.value })} /></Field>
        </div>
        <button className="button" onClick={props.registerPlayerByToken}>Inscrever e entrar escalado</button>
      </section>

      <section className="panel span-2">
        <h2>Campeonatos inscritos</h2>
        <div className="cards">
          {props.registrations.length === 0 ? <p className="empty">Voce ainda nao entrou em nenhum campeonato.</p> : null}
          {props.registrations.map((row) => (
            <div className="card" key={row.id}>
              <p>{String(row.data?.team_tag || 'Equipe')}</p>
              <strong>{String(row.data?.championship_name || 'Campeonato')}</strong>
              <span>{String(row.data?.team_name || '')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
