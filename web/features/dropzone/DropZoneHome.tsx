'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Send, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { PROFILE_TYPES, type DropZoneRow, type ProfileType } from '@/lib/types'
import { cleanUsername, getPasswordIssue } from '@/lib/validation'
import { Field, LocationSearch, UploadField } from './components/form-fields'
import { profileIcons } from './components/profile-icons'
import { EquipePanel } from './panels/equipe/EquipePanel'
import { JogadorPanel } from './panels/jogador/JogadorPanel'
import { ProdutoraPanel } from './panels/produtora/ProdutoraPanel'
import type { CampeonatoFormValue } from '@/components/forms/campeonato'
import { AppHeader } from '@/components/layout/AppHeader'
import { authHeaders, dataText, loginSuggestion, mediaForProfile, rowTitle } from './utils'

type AuthMode = 'entrar' | 'criar' | 'recuperar'
const AUTH_RESEND_COOLDOWN_SECONDS = 60

const emptyChampionship = {
  nome: '',
  tipo: 'copa',
  logo_url: '',
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
  const [slotAssignment, setSlotAssignment] = useState({ slot_id: '', grupo_id: '', equipe_id: '', line_id: '', campeonato_equipe_id: '', slot_numero: '1' })
  const [game, setGame] = useState({ nome: '', campeonato_id: '', fase_id: '', data_jogo: '', horario: '', numero_partidas: '6', mapas: '', grupos_ids: [] as string[] })
  const [registrationLink, setRegistrationLink] = useState({ grupo_id: '', vagas_por_equipe: '6', abre_em: '', encerra_em: '', permite_substituicao: false, max_substituicoes_por_equipe: '0', substituicao_encerra_em: '', descricao: '' })
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
    if (recent) {
      const media = mediaForProfile(recent)
      setUsername(recent.username || '')
      setName(recent.name || '')
      setMediaUrl(media)
      setMode('entrar')
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        try {
          await loadMeAndRows(data.session.access_token)
          return
        } catch {
          // se a sessao local nao for valida, cai no login preenchido
        }
      }
    }
    setActiveAuthType(type)
  }

  useEffect(() => {
    async function initialize() {
      const params = new URLSearchParams(window.location.search)
      const convite = String(params.get('convite') || '').trim()
      const escala = String(params.get('escala') || '').trim()
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
      if (saved) setRecentProfiles(JSON.parse(saved))

      if (convite) setInviteReturnTo(`/convite/equipe/${encodeURIComponent(convite)}`)
      if (escala) setInviteReturnTo(`/escala/${encodeURIComponent(escala)}`)

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
          setMode(wantsCreate ? 'criar' : 'entrar')
          setQueryReady(true)
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data.session && wantsCreate && wantsLinked) {
          try {
            await loadMeAndRows(data.session.access_token)
            clearRegisterForm('equipe')
            setMode('criar')
            setActiveAuthType(forcedProfileType)
            setLinkingProfile(true)
          } catch (err: any) {
            setError(err?.message || 'Não foi possível carregar o login ativo.')
          }
          setQueryReady(true)
          return
        }

        setLinkingProfile(false)
        setMode(wantsCreate ? 'criar' : 'entrar')
        setQueryReady(true)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        try {
          await loadMeAndRows(data.session.access_token)
        } catch {
          // Mantém a tela pública quando a sessão local não for válida.
        }
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

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async function loadMeAndRows(token?: string, preferredType?: ProfileType | null) {
    const accessToken = token || await getToken()
    if (!accessToken) return
    const storedType = preferredType || (localStorage.getItem('dropzone_active_profile_type') as ProfileType | null)

    const meRes = await fetch('/api/me', {
      headers: authHeaders(accessToken, storedType),
    })
    const meJson = await meRes.json()
    if (!meRes.ok) throw new Error(meJson.error || 'Sessao invalida.')
    setAccount(meJson.account)
    setAccounts(meJson.accounts || [meJson.account])
    saveRecentProfile(meJson.account)
    localStorage.setItem('dropzone_active_profile_type', meJson.account.profile_type)

    const rowsRes = await fetch('/api/dropzone', {
      headers: authHeaders(accessToken, meJson.account.profile_type),
    })
    const rowsJson = await rowsRes.json()
    if (!rowsRes.ok) throw new Error(rowsJson.error || 'Erro ao listar dados.')
    setRows(rowsJson.rows || [])
  }

  async function switchLinkedAccount(nextAccount: DropZoneRow) {
    setLoading(true)
    setError('')
    try {
      localStorage.setItem('dropzone_active_profile_type', String(nextAccount.profile_type || ''))
      await loadMeAndRows(undefined, nextAccount.profile_type as ProfileType)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível trocar de perfil.')
    } finally {
      setLoading(false)
    }
  }

  function startLinkedProfile() {
    const used = new Set(accounts.map((item) => item.profile_type))
    const available = PROFILE_TYPES.find((type) => !used.has(type))
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
        setLinkingProfile(false)
        setActiveAuthType(null)
        await loadMeAndRows(token, profileType)
        if (inviteReturnTo) {
          window.location.assign(inviteReturnTo)
          return
        }
        setMessage('Perfil vinculado criado com sucesso.')
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

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      localStorage.setItem('dropzone_active_profile_type', profileType)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err?.message || 'Nao foi possivel entrar com Google.')
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
      setLoading(false)
    }
  }

  async function updateStructure(entityType: 'phase' | 'group' | 'group_slot', id: string, data: Record<string, unknown>) {
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

  async function deleteStructure(entityType: 'phase' | 'group', id: string) {
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
      setMessage(entityType === 'phase' ? 'Fase excluída.' : 'Grupo excluído.')
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
    if (!champ || !phase.nome.trim()) return setError('Selecione o campeonato e informe o nome da fase.')
    await createRow({
      entity_type: 'phase',
      name: phase.nome,
      parent_id: champ.id,
      data: {
        ...phase,
        campeonato_id: champ.id,
        ordem: Number(phase.ordem || 1),
      },
    }, 'Fase criada.')
    setPhase({ nome: '', campeonato_id: champ.id, ordem: String(Number(phase.ordem || 1) + 1) })
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
    if (!champ || !group.nome.trim()) return setError('Selecione o campeonato e informe o nome do grupo.')
    await createRow({
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
    setGroup({ nome: dataText(champ, 'tipo') === 'diario' ? '19h' : 'Grupo A', campeonato_id: champ.id, fase_id: group.fase_id, slots: '12', whatsapp_url: '' })
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
    setGame({ nome: '', campeonato_id: champ.id, fase_id: game.fase_id, data_jogo: '', horario: '', numero_partidas: '6', mapas: '', grupos_ids: [] })
  }

  async function createRegistrationLink() {
    const champ = selectedChamp
    if (!champ) return setError('Selecione um campeonato.')
    if (!registrationLink.grupo_id) return setError('Selecione o grupo do link.')
    const row = await createRow({
      entity_type: 'registration_link',
      name: `Inscricao ${rowTitle(champ)}`,
      parent_id: champ.id,
      generate_token: true,
      data: {
        championship_id: champ.id,
        group_id: registrationLink.grupo_id,
        ...registrationLink,
      },
    }, 'Link publico de inscricao criado.')
    if (row?.token) await copyToken(`${window.location.origin}/i/${row.token}`)
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
    return <main className="page page-loading"><div className="shell"><div className="message">Carregando acesso...</div></div></main>
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
                              className={`profile-card gamer-card ${recent ? 'has-recent' : ''}`}
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
                                  <small>Entrar, criar conta ou recuperar senha</small>
                                )}
                              </div>
                              <i className="card-corner" />
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        className="other-account-button"
                        onClick={() => {
                          clearRegisterForm('produtora')
                          setMode('entrar')
                          setActiveAuthType('produtora')
                        }}
                      >
                        Logar com outra conta
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
                  {!linkingProfile ? <div className="tabs auth-inline-tabs">
                    <button type="button" className={`tab ${mode === 'entrar' ? 'active' : ''}`} onClick={() => { setMode('entrar'); resetVerificationState() }}>Entrar</button>
                    <button type="button" className={`tab ${mode === 'criar' ? 'active' : ''}`} onClick={() => { setMode('criar'); resetVerificationState() }}>Criar conta</button>
                  </div> : null}
                  <button type="button" className="close-auth inline-close" onClick={() => { setActiveAuthType(null); setLinkingProfile(false) }} aria-label="Fechar">
                    <X size={18} />
                  </button>
                </div>

                {linkingProfile ? (
                  <div className="linked-profile-type-picker">
                    <span>Escolha o novo tipo de perfil:</span>
                    {PROFILE_TYPES.map((type) => {
                      const disabled = accounts.some((item) => item.profile_type === type)
                      return (
                        <button
                          key={type}
                          type="button"
                          disabled={disabled}
                          className={profileType === type ? 'active' : ''}
                          onClick={() => { clearRegisterForm(type); setMode('criar') }}
                        >
                          {typeLabels[type]} {disabled ? '— já existe' : ''}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                <form onSubmit={handleAuth} className="auth-inline-form compact-auth-form">
                  {mode === 'recuperar' ? (
                    <div className="register-main-fields">
                      <div className="mini-grid auth-base-grid">
                        <Field label="E-mail da conta">
                          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); resetVerificationState() }} placeholder="seuemail@gmail.com" />
                        </Field>
                        <Field label="Código de 6 dígitos">
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            disabled={!codeSent}
                          />
                        </Field>
                        <Field label="Nova senha">
                          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 8, numero e especial" disabled={!codeSent} />
                        </Field>
                        {codeSent ? <small className="auth-password-hint">{passwordIssue || 'Senha segura: letra, numero e caractere especial.'}</small> : null}
                        <Field label="Confirmar nova senha">
                          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite novamente" disabled={!codeSent} />
                        </Field>
                      </div>

                      <div className="auth-actions-row">
                        {!codeSent ? (
                          <button type="button" className="button" disabled={loading || !email.trim()} onClick={() => requestVerificationCode('reset_password')}>
                            Enviar código
                          </button>
                        ) : (
                          <>
                            <button className="button" disabled={loading || verificationCode.length !== 6 || Boolean(passwordIssue) || password !== confirmPassword}>Alterar senha</button>
                            <button type="button" className="button secondary" disabled={resendBlocked} onClick={() => requestVerificationCode('reset_password')}>{resendLabel}</button>
                          </>
                        )}
                        <button type="button" className="link-button auth-inline-link" onClick={() => { setMode('entrar'); resetVerificationState(); setPassword(''); setConfirmPassword('') }}>
                          Voltar para o login
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {mode === 'criar' ? (
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

                            {profileType === 'manager' ? (
                              <div className="mini-grid tight-grid">
                                <Field label="Token de convite">
                                  <input value={registerData.token_convite} onChange={(e) => updateRegisterData('token_convite', e.target.value.toUpperCase())} placeholder="MG-..." />
                                </Field>
                                <Field label="Senha do convite">
                                  <input type="password" value={registerData.senha_convite} onChange={(e) => updateRegisterData('senha_convite', e.target.value)} placeholder="Senha recebida" />
                                </Field>
                              </div>
                            ) : null}

                            <LocationSearch value={registerData} onSelect={selectLocation} />
                            {!linkingProfile ? (
                              <Field label="E-mail de confirmação">
                                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); resetVerificationState() }} placeholder="seuemail@gmail.com" />
                              </Field>
                            ) : (
                              <div className="linked-create-note">Este perfil usará o mesmo e-mail e a mesma senha do login ativo.</div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="mini-grid auth-base-grid">
                        <Field label={mode === 'criar' ? 'Login' : 'Login, ID publico ou e-mail'}>
                          <input value={username} onChange={(e) => { setUsername(cleanUsername(e.target.value)); if (mode === 'criar') resetVerificationState() }} placeholder={mode === 'criar' ? '@login sugerido pelo nome' : '@login, ID ou e-mail'} />
                        </Field>
                        {!linkingProfile ? (
                          <>
                            <Field label="Senha">
                              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 8, numero e especial" />
                            </Field>
                            {mode === 'criar' ? <small className="auth-password-hint">{passwordIssue || 'Senha segura: letra, numero e caractere especial.'}</small> : null}
                            {mode === 'criar' ? (
                              <Field label="Confirmar senha">
                                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" />
                              </Field>
                            ) : null}
                            {mode === 'criar' && codeSent && !linkingProfile ? (
                              <Field label="Código enviado por e-mail">
                                <input inputMode="numeric" maxLength={6} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
                              </Field>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      <div className="auth-actions-row">
                        {!linkingProfile ? (
                          <button type="button" className="button secondary google-auth-button" disabled={loading} onClick={signInWithGoogle}>
                            Entrar com Google
                          </button>
                        ) : null}
                        {linkingProfile ? (
                          <button className="button" disabled={loading || !username.trim()}>Criar perfil vinculado</button>
                        ) : mode === 'criar' && !codeSent ? (
                          <button type="button" className="button" disabled={loading || !email.trim() || !username.trim() || Boolean(passwordIssue) || password !== confirmPassword} onClick={() => requestVerificationCode('register')}>
                            Enviar código
                          </button>
                        ) : (
                          <button className="button" disabled={loading || (mode === 'criar' && verificationCode.length !== 6)}>
                            {mode === 'criar' ? 'Confirmar e criar conta' : 'Entrar'}
                          </button>
                        )}
                        {mode === 'criar' && codeSent && !linkingProfile ? (
                          <button type="button" className="button secondary" disabled={resendBlocked} onClick={() => requestVerificationCode('register')}>{resendLabel}</button>
                        ) : null}
                        {mode === 'entrar' ? (
                          <button type="button" className="link-button auth-inline-link" onClick={() => { setMode('recuperar'); resetVerificationState(); setPassword(''); setConfirmPassword('') }}>
                            Esqueci minha senha
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </form>
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
                addTeamToChamp={() => addTeamToChamp()}
                generateTeamInvite={generateTeamInvite}
                copyToken={copyToken}
                loading={loading}
                uploadPublicFile={uploadPublicFile}
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
                registrations={registrations}
                playerTeams={playerTeams}
                teamLines={teamLines}
                lineupRules={lineupRules}
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
                uploadPublicFile={uploadPublicFile}
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
                uploadPublicFile={uploadPublicFile}
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
