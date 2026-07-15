'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { PROFILE_TYPES, type DropZoneRow, type ProfileType } from '@/lib/types'
import { cleanUsername, getPasswordIssue } from '@/lib/validation'
import { Field, LocationSearch, UploadField } from './components/form-fields'
import { profileIcons } from './components/profile-icons'
import { EquipePanel } from './panels/equipe/EquipePanel'
import { JogadorPanel } from './panels/jogador/JogadorPanel'
import { ManagerPanel } from './panels/manager/ManagerPanel'
import { ProdutoraPanel } from './panels/produtora/ProdutoraPanel'
import type { CampeonatoFormValue } from '@/components/forms/campeonato'
import { AppHeader } from '@/components/layout/AppHeader'
import { authHeaders, dataText, loginSuggestion, mediaForProfile, rowTitle } from './utils'
import { safeInternalPath } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

type AuthMode = 'entrar' | 'criar' | 'recuperar'
const AUTH_RESEND_COOLDOWN_SECONDS = 60

const emptyChampionship = {
  nome: '',
  tipo: 'copa',
  logo_url: '',
  banner_url: '',
  premiacao: '',
  valor_inscricao: '',
  descricao_premiacao: '',
  divisao_premiacao: '',
  regras_url: '',
  numero_vagas: '',
  formato: '',
  plataforma: '',
  servidor: '',
  tipo_premiacao: '',
  tem_trofeu: false,
  tem_live: false,
  vagas_por_equipe: '',
  jogadores_por_vaga: '',
  permite_jogador_multiplas_equipes: false,
  permite_troca_jogadores: false,
  data_limite_trocas: '',
  data_limite_inscricao: '',
  aceita_novas_inscricoes_equipes: true,
  contatos_whatsapp: [],
}

const typeLabels: Record<ProfileType, string> = {
  produtora: 'Produtora',
  equipe: 'Equipe',
  jogador: 'Jogador',
  manager: 'Manager',
}

const typeDescriptions: Record<ProfileType, string> = {
  produtora: 'Painel de campeonatos e gestao geral.',
  equipe: 'Acesso do lider para montar elenco e entrar em eventos.',
  jogador: 'Cadastro competitivo e inscricoes em partidas.',
  manager: 'Ajudante com convite unico para operar o painel.',
}

const TEAM_INVITE_TYPES = new Set(['convite_equipe_campeonato', 'team_invite'])
const PLAYER_INVITE_TYPES = new Set(['convite_jogador_campeonato', 'convite_jogador_equipe', 'player_invite'])
const PANEL_CACHE_TTL_MS = 5 * 60 * 1000

type PanelSnapshot = {
  account: DropZoneRow
  accounts: DropZoneRow[]
  rows: DropZoneRow[]
  savedAt: number
}

export function DropZoneHome() {
  const [mode, setMode] = useState<AuthMode>('entrar')
  const [profileType, setProfileType] = useState<ProfileType>('produtora')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [registerData, setRegisterData] = useState({
    tag: '',
    id_jogo: '',
    funcao: 'support',
    pais: '',
    estado: '',
    cidade: '',
    token_convite: '',
    senha_convite: '',
  })
  const [activeAuthType, setActiveAuthType] = useState<ProfileType | null>(null)
  const [recentProfiles, setRecentProfiles] = useState<any[]>([])
  const [account, setAccount] = useState<DropZoneRow | null>(null)
  const [accounts, setAccounts] = useState<DropZoneRow[]>([])
  const [linkingProfile, setLinkingProfile] = useState(false)
  const [rows, setRows] = useState<DropZoneRow[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingCreate, setPendingCreate] = useState<string | null>(null)
  const createLockRef = useRef(false)
  const [accessLoadingType, setAccessLoadingType] = useState<ProfileType | null>(null)
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null)
  const [queryReady, setQueryReady] = useState(false)
  const [inviteReturnTo, setInviteReturnTo] = useState('')

  const [championship, setChampionship] = useState(emptyChampionship)
  const [team, setTeam] = useState({
    nome: '',
    tag: '',
    logo_url: '',
    senha_dono: '',
  })
  const [phase, setPhase] = useState({ nome: '', campeonato_id: '', ordem: '1' })
  const [group, setGroup] = useState({ nome: 'Grupo A', campeonato_id: '', fase_id: '', slots: '12', whatsapp_url: '' })
  const [slotAssignment, setSlotAssignment] = useState({ slot_id: '', fase_id: '', grupo_id: '', equipe_id: '', line_id: '', campeonato_equipe_id: '', slot_numero: '1' })
  const [game, setGame] = useState({ nome: '', campeonato_id: '', fase_id: '', data_jogo: '', horario: '', numero_partidas: '6', mapas: Array(6).fill('') as string[], grupos_ids: [] as string[] })
  const [registrationLink, setRegistrationLink] = useState({ tipo: 'jogadores', grupo_id: '', vagas_por_equipe: '6', abre_em: '', encerra_em: '', permite_substituicao: false, max_substituicoes_por_equipe: '0', substituicao_encerra_em: '', descricao: '', nomes_equipes: '' })
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
  const teamLines = useMemo(() => rows.filter((row) => row.entity_type === 'team_line'), [rows])
  const links = useMemo(() => rows.filter((row) => row.entity_type === 'championship_team'), [rows])
  const phases = useMemo(() => rows.filter((row) => row.entity_type === 'phase'), [rows])
  const groups = useMemo(() => rows.filter((row) => row.entity_type === 'group'), [rows])
  const groupSlots = useMemo(() => rows.filter((row) => row.entity_type === 'group_slot'), [rows])
  const games = useMemo(() => rows.filter((row) => row.entity_type === 'game'), [rows])
  const tokens = useMemo(() => rows.filter((row) => row.entity_type === 'invite_token'), [rows])
  const registrations = useMemo(() => rows.filter((row) => row.entity_type === 'player_registration'), [rows])
  const playerTeams = useMemo(() => rows.filter((row) => row.entity_type === 'player_team'), [rows])
  const registrationLinks = useMemo(() => rows.filter((row) => row.entity_type === 'registration_link'), [rows])
  const lineupRules = useMemo(() => rows.filter((row) => row.entity_type === 'lineup_rule'), [rows])

  const selectedChamp = championships.find((row) => row.id === selectedChampId) || championships[0]
  const selectedChampTeams = links
    .filter((link) => link.parent_id === selectedChamp?.id)
    .flatMap((link) => {
      const team = teams.find((teamRow) => teamRow.id === link.ref_id)
      if (!team) return []
      const enrolledLineId = String(link.data?.line_id || '')
      const candidateLines = enrolledLineId
        ? [teamLines.find((line) => line.id === enrolledLineId) || null]
        : teamLines.filter((line) => line.ref_id === team.id)
      const linesToShow = candidateLines.length ? candidateLines : [null]
      return linesToShow.map((line) => ({
        ...link,
        id: line ? `${link.id}:${line.id}` : link.id,
        name: line ? rowTitle(line) : String(link.data?.nome_exibicao || rowTitle(team)),
        ref_id: team.id,
        data: {
          ...link.data,
          campeonato_equipe_id: link.id,
          line_id: line?.id || enrolledLineId || '',
          line_name: line ? rowTitle(line) : String(link.data?.nome_exibicao || ''),
          team_name: rowTitle(team),
          tag: dataText(line || team, 'tag'),
          logo_url: dataText(line || team, 'logo_url'),
        },
      } as DropZoneRow))
    })

  const managedTeamIds = useMemo(() => {
    if (!account) return []
    const directProfile = account.profile_type === 'equipe' ? [account.id] : []
    const direct = teams.filter((row) => row.created_by === account.auth_user_id || row.id === account.id).map((row) => row.id)
    const linked = links.filter((row) => row.created_by === account.auth_user_id).map((row) => String(row.ref_id || ''))
    return Array.from(new Set([...directProfile, ...direct, ...linked].filter(Boolean)))
  }, [account, teams, links])

  const managedTeams = teams.filter((row) => managedTeamIds.includes(row.id))
  const managedLinks = links.filter((row) => row.ref_id && managedTeamIds.includes(row.ref_id))
  const managedChampionships = championships.filter((row) => managedLinks.some((link) => link.parent_id === row.id))
  const playerInvite = tokens.find((row) => row.token?.toUpperCase() === playerToken.trim().toUpperCase() && PLAYER_INVITE_TYPES.has(String(row.data?.token_kind || '')))
  const myRegistrations = registrations.filter((row) => row.created_by === account?.auth_user_id)
  const recentProfileByType = useMemo(() => Object.fromEntries(recentProfiles.map((profile) => [profile.profile_type, profile])) as Partial<Record<ProfileType, any>>, [recentProfiles])
  const passwordIssue = getPasswordIssue(password)
  const resendBlocked = loading || resendCooldown > 0
  const resendLabel = resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar código'

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setTimeout(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  useEffect(() => {
    if (!selectedChamp) return
    setGroup((current) => ({
      ...current,
      campeonato_id: selectedChamp.id,
      nome: dataText(selectedChamp, 'tipo') === 'diario'
        ? (current.nome.match(/^([01]\d|2[0-3])h$/) ? current.nome : '19h')
        : (current.nome.startsWith('Grupo ') ? current.nome : 'Grupo A'),
    }))
  }, [selectedChamp?.id, selectedChamp?.data?.tipo])

  async function chooseAccess(type: ProfileType, recent?: any) {
    clearRegisterForm(type)
    setProfileType(type)
    setError('')
    setMessage('')

    const { data } = await supabase.auth.getSession()

    if (data.session) {
      setLoading(true)
      setAccessLoadingType(type)
      try {
        if (recent) {
          const cachedRows = readPanelCache(recent.id)
          setAccount(recent)
          setRows(cachedRows)
          setActiveAuthType(null)
          setLinkingProfile(false)
          await loadMeAndRows(data.session.access_token, type)
          return
        }

        const availableAccounts = accounts.length
          ? accounts
          : await loadAccountsOnly(data.session.access_token)
        const existing = availableAccounts.find((item) => item.profile_type === type)

        if (existing) {
          await loadMeAndRows(data.session.access_token, type)
          setActiveAuthType(null)
          setLinkingProfile(false)
          return
        }

        prepareGoogleProfile(data.session.user, type)
        return
      } catch (cause: any) {
        setError(cause?.message || 'Não foi possível abrir este perfil.')
        return
      } finally {
        setLoading(false)
        setAccessLoadingType(null)
      }
    }

    if (recent) {
      const media = mediaForProfile(recent)
      setUsername(recent.username || '')
      setName(recent.name || '')
      setMediaUrl(media)
    }
    setMode('entrar')
    setLinkingProfile(false)
    setActiveAuthType(type)
  }

  useEffect(() => {
    async function initialize() {
      const params = new URLSearchParams(window.location.search)
      const convite = String(params.get('convite') || '').trim()
      const escala = String(params.get('escala') || '').trim()
      const requestedReturnTo = safeInternalPath(params.get('returnTo'), '')
      const requestedLogin = String(params.get('login') || '').trim()
      const requestedRegister = String(params.get('cadastro') || '').trim()
      const forcedProfileType: ProfileType | null =
        requestedLogin === 'equipe' || requestedRegister === 'equipe'
          ? 'equipe'
          : requestedLogin === 'jogador' || requestedRegister === 'jogador'
            ? 'jogador'
            : null
      const forcedType = Boolean(forcedProfileType)
      const wantsCreate = Boolean(forcedProfileType && requestedRegister === forcedProfileType)
      const wantsLinked = params.get('vincular') === '1'
      const wantsNewAccount = params.get('nova_conta') === '1'
      const wantsSwitchAccount = params.get('trocar_conta') === '1'

      const saved = localStorage.getItem('dropzone_recent_profiles')
      let hasRecentLogin = false
      if (saved) {
        const parsed = JSON.parse(saved)
        hasRecentLogin = Array.isArray(parsed) && parsed.length > 0
        setRecentProfiles(parsed)
      }

      const resolvedReturnTo = requestedReturnTo || (convite
        ? `/convite/equipe/${encodeURIComponent(convite)}`
        : escala
          ? `/escala/${encodeURIComponent(escala)}`
          : '')
      if (resolvedReturnTo) setInviteReturnTo(resolvedReturnTo)

      if (forcedType && forcedProfileType) {
        setProfileType(forcedProfileType)
        setActiveAuthType(forcedProfileType)
        clearRegisterForm(forcedProfileType)

        if (wantsSwitchAccount || wantsNewAccount) {
          await supabase.auth.signOut()
          setAccount(null)
          setAccounts([])
          setRows([])
          setLinkingProfile(false)
          setMode('entrar')
          setQueryReady(true)
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data.session) {
          // Login social / vinculo: se nao tem o perfil exigido (ex. equipe no convite de grupo),
          // abre o formulario de criacao em vez de mandar de volta sem perfil.
          const availableAccounts = await loadAccountsOnly(data.session.access_token).catch(() => [] as DropZoneRow[])
          const existing = availableAccounts.find((item) => item.profile_type === forcedProfileType)

          if (existing && !wantsCreate) {
            try {
              await loadMeAndRows(data.session.access_token, forcedProfileType)
              if (resolvedReturnTo) {
                window.location.assign(resolvedReturnTo)
                return
              }
            } catch (cause: any) {
              setError(cause?.message || 'Não foi possível carregar o painel deste perfil.')
            }
            setQueryReady(true)
            return
          }

          if (existing && wantsCreate) {
            // Ja tem o perfil: volta ao fluxo de origem (convite/grupo).
            if (resolvedReturnTo) {
              window.location.assign(resolvedReturnTo)
              return
            }
            try {
              await loadMeAndRows(data.session.access_token, forcedProfileType)
            } catch (cause: any) {
              setError(cause?.message || 'Não foi possível carregar o painel deste perfil.')
            }
            setQueryReady(true)
            return
          }

          // Sem perfil do tipo exigido: formulario de criacao vinculado ao login atual.
          prepareGoogleProfile(data.session.user, forcedProfileType)
          setQueryReady(true)
          return
        }

        setLinkingProfile(false)
        setMode('entrar')
        setQueryReady(true)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        try {
          const storedType = localStorage.getItem('dropzone_active_profile_type') as ProfileType | null
          const cachedSnapshot = readPanelSnapshot(storedType)
          if (cachedSnapshot) {
            setAccount(cachedSnapshot.account)
            setAccounts(cachedSnapshot.accounts)
            setRows(cachedSnapshot.rows)
            setQueryReady(true)
          }
          await loadMeAndRows(data.session.access_token, storedType)
        } catch {
          setAccount(null)
          setAccounts([])
          setRows([])
        }
      } else if (!hasRecentLogin) {
        window.location.replace(`/login?returnTo=${encodeURIComponent(resolvedReturnTo || '/')}`)
        return
      }
      setQueryReady(true)
    }

    void initialize()
  }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  function saveRecentProfile(profile: any) {
    const next = [profile, ...recentProfiles.filter((item) => item.id !== profile.id)].slice(0, 4)
    setRecentProfiles(next)
    localStorage.setItem('dropzone_recent_profiles', JSON.stringify(next))
  }

  function saveRecentProfiles(profiles: DropZoneRow[]) {
    const byType = new Map<ProfileType, DropZoneRow>()
    for (const profile of profiles) {
      if (profile.profile_type && !byType.has(profile.profile_type)) byType.set(profile.profile_type, profile)
    }
    const next = PROFILE_TYPES.map((type) => byType.get(type)).filter(Boolean) as DropZoneRow[]
    setRecentProfiles(next)
    localStorage.setItem('dropzone_recent_profiles', JSON.stringify(next))
  }

  function readPanelCache(accountId: string) {
    try {
      const cached = localStorage.getItem(`dropzone_panel_cache_${accountId}`)
      return cached ? JSON.parse(cached) as DropZoneRow[] : []
    } catch {
      return []
    }
  }

  function readPanelSnapshot(profileType?: ProfileType | null) {
    try {
      const key = profileType ? `dropzone_panel_snapshot_${profileType}` : 'dropzone_panel_snapshot_last'
      const cached = localStorage.getItem(key)
      if (!cached) return null
      const snapshot = JSON.parse(cached) as PanelSnapshot
      if (!snapshot?.account || !Array.isArray(snapshot.rows)) return null
      if (Date.now() - Number(snapshot.savedAt || 0) > PANEL_CACHE_TTL_MS) return null
      return snapshot
    } catch {
      return null
    }
  }

  function savePanelSnapshot(nextAccount: DropZoneRow, nextAccounts: DropZoneRow[], nextRows: DropZoneRow[]) {
    try {
      const basicTypes = new Set(['championship', 'team', 'team_line', 'championship_team'])
      const basicRows = nextRows.filter((row) => basicTypes.has(row.entity_type)).slice(0, 300)
      localStorage.setItem(`dropzone_panel_cache_${nextAccount.id}`, JSON.stringify(basicRows))
      const snapshot: PanelSnapshot = {
        account: nextAccount,
        accounts: nextAccounts,
        rows: basicRows,
        savedAt: Date.now(),
      }
      localStorage.setItem('dropzone_panel_snapshot_last', JSON.stringify(snapshot))
      localStorage.setItem(`dropzone_panel_snapshot_${nextAccount.profile_type}`, JSON.stringify(snapshot))
    } catch {
      // O painel continua funcionando normalmente quando o navegador limita o cache.
    }
  }

  async function uploadPublicFile(file: File, bucket: string) {
    setLoading(true)
    setError('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'))
        reader.readAsDataURL(file)
      })
      const token = await getToken()

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, account?.profile_type) },
        body: JSON.stringify({
          bucket,
          file_name: file.name || `${bucket}.png`,
          content_type: 'image/png',
          data_url: dataUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar arquivo.')
      setMessage('Arquivo enviado.')
      return String(json.url || '')
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar arquivo.')
      return ''
    } finally {
      setLoading(false)
    }
  }

  function updateRegisterData(key: string, value: string) {
    setRegisterData((current) => ({ ...current, [key]: value }))
  }

  function updateName(value: string) {
    const currentSuggestion = loginSuggestion(name)
    setName(value)
    if (mode === 'criar' && (!username.trim() || username === currentSuggestion)) {
      setUsername(loginSuggestion(value))
    }
  }

  function selectLocation(location: { pais: string; estado: string; cidade: string }) {
    setRegisterData((current) => ({ ...current, ...location }))
  }

  function resetVerificationState() {
    setVerificationCode('')
    setCodeSent(false)
    setResendCooldown(0)
  }

  function clearRegisterForm(nextType?: ProfileType) {
    setName('')
    setEmail('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    resetVerificationState()
    setMediaUrl('')
    setRegisterData({
      tag: '',
      id_jogo: '',
      funcao: 'support',
      pais: '',
      estado: '',
      cidade: '',
      token_convite: '',
      senha_convite: '',
    })
    if (nextType) setProfileType(nextType)
  }

  function prepareGoogleProfile(user: { email?: string | null; user_metadata?: Record<string, any> }, nextType: ProfileType) {
    clearRegisterForm(nextType)
    const googleName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim()
    const googleAvatar = String(user.user_metadata?.avatar_url || user.user_metadata?.picture || '').trim()
    setEmail(String(user.email || '').trim())
    setName(googleName)
    setUsername(loginSuggestion(googleName))
    setMediaUrl(googleAvatar)
    setMode('criar')
    setActiveAuthType(nextType)
    setLinkingProfile(true)
  }

  async function loadAccountsOnly(accessToken: string) {
    const meRes = await fetch('/api/me', {
      headers: authHeaders(accessToken),
    })
    const meJson = await meRes.json()
    if (!meRes.ok) throw new Error(meJson.error || 'Sessão inválida.')
    const loadedAccounts = (meJson.accounts || [meJson.account]).filter(Boolean) as DropZoneRow[]
    setAccounts(loadedAccounts)
    saveRecentProfiles(loadedAccounts)
    return loadedAccounts
  }

  async function loadMeAndRows(token?: string, preferredType?: ProfileType | null) {
    const accessToken = token || await getToken()
    if (!accessToken) throw new Error('Sessão não encontrada.')
    const storedType = preferredType || (localStorage.getItem('dropzone_active_profile_type') as ProfileType | null)

    const meRes = await fetch('/api/me', {
      headers: authHeaders(accessToken, storedType),
    })
    const meJson = await meRes.json()
    if (!meRes.ok) throw new Error(meJson.error || 'Sessão inválida.')

    const selectedAccount = meJson.account as DropZoneRow
    const loadedAccounts = (meJson.accounts || [selectedAccount]).filter(Boolean) as DropZoneRow[]
    if (preferredType && selectedAccount?.profile_type !== preferredType) {
      throw new Error(`Perfil de ${typeLabels[preferredType].toLowerCase()} ainda não existe nesta conta.`)
    }

    // Mostra imediatamente o perfil escolhido e os últimos dados conhecidos.
    setAccounts(loadedAccounts)
    setAccount(selectedAccount)
    setRows(readPanelCache(selectedAccount.id))
    setActiveAuthType(null)
    setLinkingProfile(false)
    localStorage.setItem('dropzone_active_profile_type', String(selectedAccount.profile_type || ''))

    const rowsRes = await fetch('/api/dropzone', {
      headers: authHeaders(accessToken, selectedAccount.profile_type),
    })
    const rowsJson = await rowsRes.json()
    if (!rowsRes.ok) throw new Error(rowsJson.error || 'Erro ao listar dados.')

    // Atualiza a interface somente quando conta e dados estiverem prontos,
    // evitando piscar a seleção de perfil ou um painel incompleto.
    setRows(rowsJson.rows || [])
    savePanelSnapshot(selectedAccount, loadedAccounts, rowsJson.rows || [])
    saveRecentProfiles(loadedAccounts)
  }

  async function switchLinkedAccount(nextAccount: DropZoneRow) {
    if (nextAccount.id === account?.id) return
    setLoading(true)
    setAccessLoadingType(nextAccount.profile_type as ProfileType)
    setSwitchingAccountId(nextAccount.id)
    setError('')
    try {
      localStorage.setItem('dropzone_active_profile_type', String(nextAccount.profile_type || ''))
      setAccount(nextAccount)
      setRows(readPanelCache(nextAccount.id))
      setMessage(`Trocando para ${typeLabels[nextAccount.profile_type as ProfileType].toLowerCase()}...`)
      await loadMeAndRows(undefined, nextAccount.profile_type as ProfileType)
      setMessage('')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível trocar de perfil.')
    } finally {
      setLoading(false)
      setAccessLoadingType(null)
      setSwitchingAccountId(null)
    }
  }

  function startLinkedProfile(preferredType?: ProfileType) {
    const used = new Set(accounts.map((item) => item.profile_type))
    if (preferredType && used.has(preferredType)) {
      setError(`Este login já possui um perfil de ${typeLabels[preferredType].toLowerCase()}.`)
      return
    }
    const available = preferredType || PROFILE_TYPES.find((type) => !used.has(type))
    if (!available) {
      setError('Este login já possui um perfil de cada tipo disponível.')
      return
    }
    clearRegisterForm(available)
    setMode('criar')
    setActiveAuthType(available)
    setLinkingProfile(true)
  }

  async function requestVerificationCode(purpose: 'register' | 'reset_password') {
    if (resendCooldown > 0) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const clean = cleanUsername(username)
      const res = await fetch('/api/auth/verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          profile_type: profileType,
          username: purpose === 'register' ? clean : undefined,
          email,
          resend: codeSent,
          password: purpose === 'register' ? password : undefined,
          confirm_password: purpose === 'register' ? confirmPassword : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar o código.')
      setCodeSent(true)
      setResendCooldown(AUTH_RESEND_COOLDOWN_SECONDS)
      setMessage(`Código enviado para ${json.email_hint}. Digite os 6 números recebidos.`)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o código.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const clean = cleanUsername(username)

      if (mode === 'recuperar') {
        const res = await fetch('/api/auth/verification/confirm-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            code: verificationCode,
            password,
            confirm_password: confirmPassword,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Não foi possível redefinir a senha.')
        setMode('entrar')
        setPassword('')
        setConfirmPassword('')
        resetVerificationState()
        setMessage('Senha alterada. Entre com a nova senha.')
        return
      }

      const endpoint = mode === 'criar' ? '/api/auth/register' : '/api/auth/login'
      const token = linkingProfile ? await getToken() : ''
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? authHeaders(token, profileType) : {}) },
        body: JSON.stringify({
          profile_type: profileType,
          username: clean,
          login: clean,
          name,
          email,
          media_url: mediaUrl,
          password,
          confirm_password: confirmPassword,
          verification_code: verificationCode,
          details: registerData,
          link_existing: linkingProfile,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || (mode === 'criar' ? 'Erro ao cadastrar.' : 'Login inválido.'))

      if (linkingProfile && json.linked) {
        // Mantém o formulário em "Criando perfil..." até o painel completo
        // do novo tipo estar carregado. Só então troca a tela.
        await loadMeAndRows(token, profileType)
        setLinkingProfile(false)
        setActiveAuthType(null)
        if (inviteReturnTo) {
          window.location.assign(inviteReturnTo)
          return
        }
        setMessage('Perfil criado com sucesso.')
        return
      }

      const session = json.session
      if (!session?.access_token) throw new Error('Sessão inválida.')

      try {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
      } catch {
        // O token retornado pela API ainda permite carregar o painel.
      }

      await loadMeAndRows(session.access_token, inviteReturnTo ? profileType : undefined)
      setActiveAuthType(null)
      if (inviteReturnTo) {
        window.location.assign(inviteReturnTo)
        return
      }
      setMessage('Login realizado.')
    } catch (err: any) {
      setError(err?.message || 'Falha na autenticação.')
    } finally {
      setLoading(false)
    }
  }


  async function signOut() {
    await supabase.auth.signOut()
    setAccount(null)
    setAccounts([])
    setLinkingProfile(false)
    setRows([])
    setMessage('')
    setError('')
  }

  async function createRow(payload: Record<string, unknown>, success = 'Cadastro salvo na DropZone.') {
    if (createLockRef.current) return undefined
    createLockRef.current = true
    const action = String(payload.entity_type || 'create')
    setPendingCreate(action)
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch('/api/dropzone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token, account?.profile_type),
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar.')
      if (json.row?.entity_type === 'group_slot') {
        setRows((current) => current.some((row) => row.id === json.row.id)
          ? current.map((row) => row.id === json.row.id ? json.row : row)
          : [json.row, ...current])
      } else {
        await loadMeAndRows(token)
      }
      setMessage(success)
      return json.row as DropZoneRow
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar.')
    } finally {
      createLockRef.current = false
      setPendingCreate(null)
      setLoading(false)
    }
  }

  async function updateStructure(entityType: 'phase' | 'group' | 'group_slot' | 'registration_link', id: string, data: Record<string, unknown>) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch('/api/dropzone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, account?.profile_type) },
        body: JSON.stringify({ entity_type: entityType, id, data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao editar.')
      await loadMeAndRows(token)
      setMessage('Estrutura atualizada.')
    } catch (err: any) {
      setError(err?.message || 'Erro ao editar.')
    } finally { setLoading(false) }
  }

  async function deleteStructure(entityType: 'phase' | 'group' | 'group_slot' | 'registration_link', id: string) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch('/api/dropzone', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, account?.profile_type) },
        body: JSON.stringify({ entity_type: entityType, id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir.')
      await loadMeAndRows(token)
      setMessage(entityType === 'phase' ? 'Fase excluida.' : entityType === 'registration_link' ? 'Link excluido.' : 'Grupo excluido.')
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir.')
    } finally { setLoading(false) }
  }

  async function copyToken(value: string | null) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setMessage(`Token copiado: ${value}`)
  }

  async function createChampionship() {
    if (!championship.nome.trim()) {
      setError('Informe o nome do campeonato.')
      return false
    }
    const created = await createRow({ entity_type: 'championship', name: championship.nome, data: championship }, 'Campeonato criado.')
    if (!created) return false
    setChampionship(emptyChampionship)
    return true
  }

  async function updateChampionship(id: string, data: CampeonatoFormValue) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch('/api/dropzone', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token, account?.profile_type),
        },
        body: JSON.stringify({
          entity_type: 'championship',
          id,
          data,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao editar campeonato.')
      setRows((current) => current.map((row) =>
        row.id === id && row.entity_type === 'championship' ? json.row : row
      ))
      setMessage('Campeonato atualizado.')
      return json.row as DropZoneRow
    } catch (err: any) {
      setError(err?.message || 'Erro ao editar campeonato.')
      return undefined
    } finally {
      setLoading(false)
    }
  }

  async function deleteChampionship(id: string) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch('/api/dropzone', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token, account?.profile_type),
        },
        body: JSON.stringify({
          entity_type: 'championship',
          id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir campeonato.')
      setRows((current) => current.filter((row) =>
        !(row.id === id && row.entity_type === 'championship')
      ))
      setSelectedChampId('')
      setMessage('Campeonato excluído.')
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir campeonato.')
    } finally {
      setLoading(false)
    }
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
    if (!champ) return setError('Selecione campeonato para gerar o convite.')
    const row = await createRow({
      entity_type: 'invite_token',
      name: teamRow ? `Convite equipe ${rowTitle(teamRow)}` : `Convite aberto ${rowTitle(champ)}`,
      parent_id: champ.id,
      ref_id: teamRow?.id || null,
      generate_token: true,
      token_prefix: 'EQ',
      data: {
        championship_id: champ.id,
        championship_name: champ.name,
        team_id: teamRow?.id || null,
        team_name: teamRow?.name || null,
        team_tag: teamRow ? dataText(teamRow, 'tag') : null,
        token_kind: 'convite_equipe_campeonato',
      },
    }, 'Token de convite para equipe gerado.')
    if (row?.token) await copyToken(row.token)
  }

  async function createPhase() {
    const champId = phase.campeonato_id || selectedChamp?.id
    const champ = championships.find((row) => row.id === champId)
    if (!champ || !phase.nome.trim()) {
      setError('Selecione o campeonato e informe o nome da fase.')
      return false
    }
    const created = await createRow({
      entity_type: 'phase',
      name: phase.nome,
      parent_id: champ.id,
      data: {
        ...phase,
        campeonato_id: champ.id,
        ordem: Number(phase.ordem || 1),
      },
    }, 'Fase criada.')
    if (!created) return false
    setPhase({ nome: '', campeonato_id: champ.id, ordem: String(Number(phase.ordem || 1) + 1) })
    return true
  }

  async function assignTeamToSlot() {
    const champ = selectedChamp
    if (!champ) return setError('Selecione um campeonato.')
    if (!slotAssignment.grupo_id || !slotAssignment.equipe_id || !slotAssignment.slot_numero) return setError('Selecione grupo, line/equipe e slot.')
    await createRow({
      entity_type: 'group_slot',
      name: `Slot ${slotAssignment.slot_numero}`,
      parent_id: champ.id,
      ref_id: slotAssignment.equipe_id,
      data: {
        campeonato_id: champ.id,
        slot_id: slotAssignment.slot_id || null,
        fase_id: slotAssignment.fase_id || null,
        grupo_id: slotAssignment.grupo_id,
        equipe_id: slotAssignment.equipe_id,
        line_id: slotAssignment.line_id || null,
        campeonato_equipe_id: slotAssignment.campeonato_equipe_id || null,
        slot_numero: Number(slotAssignment.slot_numero),
      },
    }, 'Equipe colocada no slot.')
    setSlotAssignment((current) => ({ ...current, slot_id: '', equipe_id: '', line_id: '', campeonato_equipe_id: '', slot_numero: String(Number(current.slot_numero || 1) + 1) }))
  }

  async function createGroup() {
    const champId = group.campeonato_id || selectedChamp?.id
    const champ = championships.find((row) => row.id === champId)
    if (!champ || !group.nome.trim()) {
      setError('Selecione o campeonato e informe o nome do grupo.')
      return false
    }
    const created = await createRow({
      entity_type: 'group',
      name: group.nome,
      parent_id: champ.id,
      data: {
        ...group,
        campeonato_id: champ.id,
        fase_id: group.fase_id || null,
        championship_name: champ.name,
      },
    }, 'Grupo criado no campeonato.')
    if (!created) return false
    setGroup({ nome: dataText(champ, 'tipo') === 'diario' ? '19h' : 'Grupo A', campeonato_id: champ.id, fase_id: group.fase_id, slots: '12', whatsapp_url: '' })
    return true
  }

  async function createGame(): Promise<boolean> {
    if (createLockRef.current) return false
    const champId = game.campeonato_id || selectedChamp?.id
    const champ = championships.find((row) => row.id === champId)
    if (!champ || !game.nome.trim()) { setError('Selecione o campeonato e informe o nome do jogo.'); return false }
    if (!game.fase_id) { setError('Selecione a fase do jogo.'); return false }
    const totalQuedas = Number(game.numero_partidas || 0)
    if (!Number.isInteger(totalQuedas) || totalQuedas < 1) { setError('Informe uma quantidade válida de quedas.'); return false }
    if (game.grupos_ids.length < 1) { setError('Selecione pelo menos um grupo participante.'); return false }
    const mapas = game.mapas.slice(0, totalQuedas)
    if (mapas.length !== totalQuedas || mapas.some((codigo) => !codigo)) {
      setError('Selecione um mapa para cada queda.')
      return false
    }

    createLockRef.current = true
    setPendingCreate('game')
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/campeonatos/${champ.id}/jogos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token, account?.profile_type),
        },
        body: JSON.stringify({
          fase_id: game.fase_id,
          nome: game.nome.trim(),
          data_jogo: game.data_jogo || null,
          horario: game.horario || null,
          numero_partidas: totalQuedas,
          grupos_ids: game.grupos_ids,
          quedas: mapas.map((mapa_codigo, index) => ({ numero: index + 1, mapa_codigo })),
          intervalo_quedas_minutos: 25,
          multiplicador_abates_ultima_queda: 1,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar jogo.')
      await loadMeAndRows(token)
      setGame({ nome: '', campeonato_id: champ.id, fase_id: game.fase_id, data_jogo: '', horario: '', numero_partidas: '6', mapas: Array(6).fill(''), grupos_ids: [] })
      setMessage('Jogo criado com sucesso.')
      return true
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar jogo.')
      return false
    } finally {
      createLockRef.current = false
      setPendingCreate(null)
      setLoading(false)
    }
  }

  async function updateGame(gameId: string): Promise<boolean> {
    if (createLockRef.current) return false
    const champId = game.campeonato_id || selectedChamp?.id
    const champ = championships.find((row) => row.id === champId)
    if (!champ || !game.nome.trim()) { setError('Selecione o campeonato e informe o nome do jogo.'); return false }
    if (!game.fase_id) { setError('Selecione a fase do jogo.'); return false }
    const totalQuedas = Number(game.numero_partidas || 0)
    if (!Number.isInteger(totalQuedas) || totalQuedas < 1) { setError('Informe uma quantidade válida de quedas.'); return false }
    if (game.grupos_ids.length < 1) { setError('Selecione pelo menos um grupo participante.'); return false }
    const mapas = game.mapas.slice(0, totalQuedas)
    if (mapas.length !== totalQuedas || mapas.some((codigo) => !codigo)) { setError('Selecione um mapa para cada queda.'); return false }

    createLockRef.current = true
    setPendingCreate('game_update')
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/campeonatos/${champ.id}/jogos/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, account?.profile_type) },
        body: JSON.stringify({
          fase_id: game.fase_id,
          nome: game.nome.trim(),
          data_jogo: game.data_jogo || null,
          horario: game.horario || null,
          numero_partidas: totalQuedas,
          grupos_ids: game.grupos_ids,
          quedas: mapas.map((mapa_codigo, index) => ({ numero: index + 1, mapa_codigo })),
          intervalo_quedas_minutos: 25,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao atualizar jogo.')
      await loadMeAndRows(token)
      setMessage('Jogo atualizado com sucesso.')
      return true
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar jogo.')
      return false
    } finally {
      createLockRef.current = false
      setPendingCreate(null)
      setLoading(false)
    }
  }

  async function deleteGame(gameId: string): Promise<boolean> {
    const champ = selectedChamp
    if (!champ) { setError('Selecione um campeonato.'); return false }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/campeonatos/${champ.id}/jogos/${gameId}`, {
        method: 'DELETE',
        headers: authHeaders(token, account?.profile_type),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir jogo.')
      await loadMeAndRows(token)
      setMessage('Jogo excluído com sucesso.')
      return true
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir jogo.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function createRegistrationLink() {
    const champ = selectedChamp
    if (!champ) return setError('Selecione um campeonato.')
    if (!registrationLink.grupo_id) return setError('Selecione o grupo do link.')
    const isTeamGroupLink = registrationLink.tipo === 'equipes'
    const expectedTeams = registrationLink.nomes_equipes.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)
    if (isTeamGroupLink && expectedTeams.length === 0) return setError('Informe pelo menos uma vaga esperada para o grupo.')
    const row = await createRow({
      entity_type: 'registration_link',
      name: isTeamGroupLink ? `Entrada de equipes ${rowTitle(champ)}` : `Inscricao ${rowTitle(champ)}`,
      parent_id: champ.id,
      generate_token: true,
      data: {
        championship_id: champ.id,
        group_id: registrationLink.grupo_id,
        ...registrationLink,
        tipo: isTeamGroupLink ? 'inscricao_equipes_grupo' : 'inscricao',
        expected_teams: expectedTeams,
      },
    }, isTeamGroupLink ? 'Link de entrada de equipes criado.' : 'Link publico de inscricao criado.')
    if (row?.token) await copyToken(`${window.location.origin}/${isTeamGroupLink ? 'convite/grupo' : 'i'}/${row.token}`)
  }

  async function acceptTeamInvite() {
    const invite = tokens.find((row) => row.token?.toUpperCase() === teamPanelToken.trim().toUpperCase() && TEAM_INVITE_TYPES.has(String(row.data?.token_kind || '')) && !row.data?.usado)
    if (!invite) return setError('Token de equipe nao encontrado ou ja utilizado.')
    await createRow({
      entity_type: 'championship_team',
      token: teamPanelToken.trim().toUpperCase(),
      parent_id: invite.parent_id,
      ref_id: invite.ref_id || managedTeams[0]?.id || account?.id,
      data: { token: teamPanelToken.trim().toUpperCase() },
    }, 'Convite aceito. Token marcado como usado.')
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
        championship_id: champ.id,
        championship_name: champ.name,
        team_id: teamRow.id,
        team_name: teamRow.name,
        team_tag: dataText(teamRow, 'tag'),
        token_kind: 'convite_jogador_campeonato',
      },
    }, 'Token de jogador gerado para envio.')
  }

  async function registerPlayerByToken() {
    const cleanToken = playerToken.trim().toUpperCase()
    if (!cleanToken) return setError('Digite o token enviado pela equipe.')
    if (!player.nick.trim() || !player.id_jogo.trim()) return setError('Informe nick e ID de jogo.')
    await createRow({
      entity_type: 'player_registration',
      name: player.nick,
      parent_id: playerInvite?.parent_id,
      ref_id: playerInvite?.ref_id,
      token: cleanToken,
      data: {
        ...player,
        token: cleanToken,
        championship_id: playerInvite?.parent_id,
        championship_name: playerInvite?.data?.championship_name,
        team_id: playerInvite?.ref_id,
        team_name: playerInvite?.data?.team_name,
        team_tag: playerInvite?.data?.team_tag,
        player_username: account?.username,
      },
    }, 'Jogador inscrito e escalado na equipe.')
    setPlayerToken('')
    setPlayer({ nick: '', foto_url: '', id_jogo: '', funcao: 'support', localidade: '', senha: '' })
  }

  if (!queryReady) {
    return <DropzoneLoader label="Carregando acesso" />
  }

  const navItems = account ? [
    { label: 'Início', href: '#painel-inicio' },
    { label: 'Campeonatos', href: '/campeonatos' },
    { label: 'Equipes', href: '/equipes' },
    { label: 'Jogadores', href: '/jogadores' },
    { label: 'Managers', href: '/managers' },
    { label: 'Produtoras', href: '/produtoras' },
  ] : []

  return (
    <>
      {account && !linkingProfile ? (
        <AppHeader
          navItems={navItems}
          activeLabel="Início"
          profileName={account.name || account.username || 'Conta DropZone'}
          profileSubtitle={`${typeLabels[account.profile_type as ProfileType]} · @${account.username}`}
          profileImage={mediaForProfile(account)}
          accounts={accounts}
          activeAccountId={account.id}
          switchingAccountId={switchingAccountId || undefined}
          onSwitchAccount={switchLinkedAccount}
          onCreateLinkedProfile={startLinkedProfile}
          onSignOut={signOut}
        />
      ) : null}
      <main className={`page ${account && !linkingProfile ? 'page-authenticated' : ''}`} id="painel-inicio">
        <div className="shell">
        {!account || linkingProfile ? (
          <section className="login-stage login-stage-bg">
            <div className={`phone-shell login-free-shell ${activeAuthType ? 'auth-page' : 'select-page'}`}>
              {!activeAuthType ? (
                <>
                  <div className="login-layout-header">
                    <p className="eyebrow">Escolha seu acesso</p>
                    <h2>Quem vai entrar?</h2>
                  </div>

                  <div className="login-workspace cards-only">
                    <div className="login-cards-panel">
                      <div className="profile-grid">
                        {PROFILE_TYPES.map((type) => {
                          const recent = recentProfileByType[type]
                          const media = mediaForProfile(recent)
                          return (
                            <button
                              key={type}
                              type="button"
                              className={`profile-card gamer-card ${recent ? 'has-recent' : ''} ${accessLoadingType === type ? 'is-loading' : ''}`}
                              disabled={Boolean(accessLoadingType)}
                              onClick={() => chooseAccess(type, recent)}
                            >
                              <div className="card-icon-frame">
                                {media ? <img src={media} alt="" /> : <span>{profileIcons[type]}</span>}
                              </div>
                              <div className="card-copy">
                                <div className="card-topline">{recent ? 'Acesso recente' : 'Novo acesso'}</div>
                                <strong>{typeLabels[type]}</strong>
                                {recent ? (
                                  <>
                                    <b className="recent-name">{recent.name}</b>
                                    <small>@{recent.username}{recent.public_id ? ` · ID ${recent.public_id}` : ''}</small>
                                  </>
                                ) : (
                                  <small>Acessar ou criar com Google, Facebook ou Discord</small>
                                )}
                              </div>
                              {accessLoadingType === type ? <span className="profile-card-loading"><Loader2 className="spin" size={20} /> Abrindo painel</span> : null}
                              <i className="card-corner" />
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        className="other-account-button"
                        onClick={async () => {
                          await signOut()
                          clearRegisterForm('produtora')
                          setMode('entrar')
                          setActiveAuthType('produtora')
                        }}
                      >
                        Usar outra conta
                      </button>
                    </div>
                  </div>
                </>
              ) : (
              <section className="auth-inline-panel auth-light-panel">
                <div className="auth-inline-head auth-light-head">
                  <div className="auth-site-mark">
                    <img src="/dropzone-icon.png" alt="DropZone" />
                    <div>
                      <span>DropZone</span>
                      <strong>{typeLabels[profileType]}</strong>
                    </div>
                  </div>
                  <button type="button" className="close-auth inline-close" onClick={() => { setActiveAuthType(null); setLinkingProfile(false) }} aria-label="Fechar">
                    <X size={18} />
                  </button>
                </div>

                {linkingProfile ? (
                  <div className="linked-profile-type-picker">
                    <span>Escolha o tipo de perfil que será criado:</span>
                    {PROFILE_TYPES.map((type) => {
                      const disabled = accounts.some((item) => item.profile_type === type)
                      return (
                        <button
                          key={type}
                          type="button"
                          disabled={disabled}
                          className={profileType === type ? 'active' : ''}
                          onClick={() => {
                            const currentEmail = email
                            const currentName = name
                            const currentMedia = mediaUrl
                            clearRegisterForm(type)
                            setEmail(currentEmail)
                            setName(currentName)
                            setUsername(loginSuggestion(currentName))
                            setMediaUrl(currentMedia)
                            setMode('criar')
                          }}
                        >
                          {typeLabels[type]} {disabled ? '— já existe' : ''}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {!linkingProfile ? (
                  <div className="google-only-auth">
                    <div className="google-only-copy">
                      <strong>Entre com sua conta</strong>
                      <p>Google, Facebook ou Discord confirmam sua identidade. Depois, caso ainda não exista um perfil DropZone, você preencherá os dados de {typeLabels[profileType].toLowerCase()}.</p>
                    </div>
                    <SocialLogin profileType={profileType} returnTo={inviteReturnTo || '/'} />
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="auth-inline-form compact-auth-form">
                    <div className="google-confirmed-note">
                      <strong>Conta confirmada</strong>
                      <span>{email}</span>
                      <small>Complete os dados abaixo para criar seu perfil DropZone.</small>
                    </div>

                    <div className="register-compact-grid">
                      <UploadField
                        label={profileType === 'equipe' || profileType === 'produtora' ? 'Logo' : 'Foto'}
                        value={mediaUrl}
                        bucket={profileType}
                        onChange={setMediaUrl}
                        onUpload={uploadPublicFile}
                      />

                      <div className="register-main-fields">
                        <div className="mini-grid tight-grid">
                          <Field label={profileType === 'equipe' ? 'Nome da equipe' : profileType === 'jogador' ? 'Nick' : profileType === 'manager' ? 'Nome do manager' : 'Nome da produtora'}>
                            <input value={name} onChange={(e) => updateName(e.target.value)} placeholder={profileType === 'jogador' ? 'Nick do jogador' : 'Nome público'} />
                          </Field>

                          {profileType === 'equipe' ? (
                            <Field label="Tag">
                              <input value={registerData.tag} onChange={(e) => updateRegisterData('tag', e.target.value.toUpperCase())} placeholder="6B" />
                            </Field>
                          ) : null}

                          {profileType === 'jogador' ? (
                            <>
                              <Field label="ID de jogo">
                                <input value={registerData.id_jogo} onChange={(e) => updateRegisterData('id_jogo', e.target.value)} placeholder="ID Free Fire" />
                              </Field>
                              <Field label="Função">
                                <select value={registerData.funcao} onChange={(e) => updateRegisterData('funcao', e.target.value)}>
                                  <option value="support">Support</option>
                                  <option value="rush">Rush</option>
                                  <option value="sniper">Sniper</option>
                                  <option value="bomber">Bomber</option>
                                </select>
                              </Field>
                            </>
                          ) : null}
                        </div>

                        <LocationSearch value={registerData} onSelect={selectLocation} />
                      </div>
                    </div>

                    <div className="auth-actions-row">
                      <button className="button" disabled={loading || !name.trim() || !username.trim()}>
                        {loading ? 'Criando perfil...' : `Criar perfil de ${typeLabels[profileType].toLowerCase()}`}
                      </button>
                      <button type="button" className="button secondary" onClick={signOut}>Usar outra conta</button>
                    </div>
                  </form>
                )}
                {message ? <div className="message floating">{message}</div> : null}
                {error ? <div className="message error floating">{error}</div> : null}
              </section>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="account-strip">
              <div>
                <p className="eyebrow">Conta ativa</p>
                <strong>{account.name} <span>@{account.username}{account.public_id ? ` · ID ${account.public_id}` : ''}</span></strong>
              </div>
              <div className="metric"><b>{championships.length}</b><span>Campeonatos</span></div>
              <div className="metric"><b>{teams.length}</b><span>Equipes</span></div>
              <div className="metric"><b>{registrations.length}</b><span>Inscricoes</span></div>
            </section>

            {accessLoadingType ? (
              <div className="panel-refresh-status" role="status" aria-live="polite">
                <Loader2 className="spin" size={16} /> Atualizando dados de {typeLabels[accessLoadingType].toLowerCase()}...
              </div>
            ) : null}

            {account.profile_type === 'produtora' ? (
              <ProdutoraPanel
                championships={championships}
                teams={teams}
                phases={phases}
                groups={groups}
                groupSlots={groupSlots}
                games={games}
                tokens={tokens}
                registrationLinks={registrationLinks}
                lineupRules={lineupRules}
                registrationLink={registrationLink}
                setRegistrationLink={setRegistrationLink}
                createRegistrationLink={createRegistrationLink}
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
                phase={phase}
                setPhase={setPhase}
                group={group}
                setGroup={setGroup}
                slotAssignment={slotAssignment}
                setSlotAssignment={setSlotAssignment}
                game={game}
                setGame={setGame}
                createChampionship={createChampionship}
                updateChampionship={updateChampionship}
                deleteChampionship={deleteChampionship}
                updateStructure={updateStructure}
                deleteStructure={deleteStructure}
                createTeam={createTeam}
                createPhase={createPhase}
                createGroup={createGroup}
                assignTeamToSlot={assignTeamToSlot}
                createGame={createGame}
                updateGame={updateGame}
                deleteGame={deleteGame}
                addTeamToChamp={() => addTeamToChamp()}
                generateTeamInvite={generateTeamInvite}
                copyToken={copyToken}
                loading={loading}
                pendingCreate={pendingCreate}
                uploadPublicFile={uploadPublicFile}
              />
            ) : null}

            {account.profile_type === 'equipe' ? (
              <EquipePanel
                accountType={account.profile_type}
                teams={teams}
                managedTeams={managedTeams}
                managedChampionships={managedChampionships}
                managedLinks={managedLinks}
                tokens={tokens}
                registrations={registrations}
                playerTeams={playerTeams}
                teamLines={teamLines}
                lineupRules={lineupRules}
                team={team}
                setTeam={setTeam}
                createTeam={createTeam}
                teamPlayerChampId={teamPlayerChampId}
                setTeamPlayerChampId={setTeamPlayerChampId}
                teamPlayerTeamId={teamPlayerTeamId}
                setTeamPlayerTeamId={setTeamPlayerTeamId}
                generatePlayerInvite={generatePlayerInvite}
                copyToken={copyToken}
                loading={loading}
                uploadPublicFile={uploadPublicFile}
              />
            ) : null}

            {account.profile_type === 'manager' ? (
              <ManagerPanel
                account={account}
                accounts={accounts}
                onSwitchAccount={switchLinkedAccount}
                onCreateLinkedProfile={startLinkedProfile}
              />
            ) : null}

            {account.profile_type === 'jogador' ? (
              <JogadorPanel
                account={account}
                registrations={myRegistrations}
                playerTeams={playerTeams}
                teams={teams}
                teamLines={teamLines}
              />
            ) : null}

            {message ? <div className="message floating">{message}</div> : null}
            {error ? <div className="message error floating">{error}</div> : null}
          </>
        )}
        </div>
      </main>
    </>
  )
}
