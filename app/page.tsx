'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, Copy, Gamepad2, LogOut, RefreshCw, Send, Shield, Trash2, Trophy, Upload, Users, X } from 'lucide-react'
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
  produtora: 'Painel de campeonatos e gestão geral.',
  equipe: 'Acesso do líder para montar elenco e entrar em eventos.',
  jogador: 'Cadastro competitivo e inscrições em partidas.',
  manager: 'Ajudante com convite único para operar o painel.',
}

function ProducerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <path d="M15 48h34l-3-19-8 6-6-15-6 15-8-6-3 19Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="M23 48v5m18-5v5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
      <path d="M21 16h0m22 0h0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <path d="M32 12 47 18v12c0 11-7 18-15 22-8-4-15-11-15-22V18l15-6Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="M32 20v22M22 30h20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  )
}

function PlayerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <path d="M18 23 32 16l14 7v16L32 48 18 39V23Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="m24 28-7 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
      <circle cx="26" cy="28" r="2.5" fill="currentColor" />
      <circle cx="38" cy="36" r="2.5" fill="currentColor" />
    </svg>
  )
}

function ManagerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <circle cx="22" cy="26" r="6" stroke="currentColor" strokeWidth="3.5" />
      <path d="M12 46c2.8-6 7.4-9 14-9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
      <circle cx="42" cy="22" r="5" stroke="currentColor" strokeWidth="3.5" />
      <path d="M42 31v15m-7-7h15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  )
}

const profileIcons: Record<ProfileType, React.ReactNode> = {
  produtora: <ProducerIcon />,
  equipe: <TeamIcon />,
  jogador: <PlayerIcon />,
  manager: <ManagerIcon />,
}

const uploadTargets = {
  produtora: { width: 500, height: 500, kindLabel: 'logo' },
  equipe: { width: 500, height: 500, kindLabel: 'logo' },
  campeonato: { width: 500, height: 500, kindLabel: 'logo' },
  jogador: { width: 500, height: 600, kindLabel: 'foto' },
  manager: { width: 500, height: 600, kindLabel: 'foto' },
} as const

function uploadTargetFor(bucket: string) {
  return uploadTargets[bucket as keyof typeof uploadTargets] || { width: 500, height: 500, kindLabel: 'imagem' }
}

const BRAZIL_LOCATIONS = [
  { cidade: 'Belém', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Ananindeua', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Marituba', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Santarém', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Marabá', estado: 'PA', pais: 'Brasil' },
  { cidade: 'São Paulo', estado: 'SP', pais: 'Brasil' },
  { cidade: 'Rio de Janeiro', estado: 'RJ', pais: 'Brasil' },
  { cidade: 'Belo Horizonte', estado: 'MG', pais: 'Brasil' },
  { cidade: 'Brasília', estado: 'DF', pais: 'Brasil' },
  { cidade: 'Salvador', estado: 'BA', pais: 'Brasil' },
  { cidade: 'Fortaleza', estado: 'CE', pais: 'Brasil' },
  { cidade: 'Recife', estado: 'PE', pais: 'Brasil' },
  { cidade: 'Manaus', estado: 'AM', pais: 'Brasil' },
  { cidade: 'Curitiba', estado: 'PR', pais: 'Brasil' },
  { cidade: 'Porto Alegre', estado: 'RS', pais: 'Brasil' },
  { cidade: 'Goiânia', estado: 'GO', pais: 'Brasil' },
  { cidade: 'Florianópolis', estado: 'SC', pais: 'Brasil' },
  { cidade: 'Cuiabá', estado: 'MT', pais: 'Brasil' },
  { cidade: 'Maceió', estado: 'AL', pais: 'Brasil' },
  { cidade: 'Macapá', estado: 'AP', pais: 'Brasil' },
]

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function LocationSearch({ value, onSelect }: { value: { pais: string; estado: string; cidade: string }; onSelect: (location: { pais: string; estado: string; cidade: string }) => void }) {
  const selectedLabel = [value.cidade, value.estado, value.pais].filter(Boolean).join(', ')
  const [query, setQuery] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const q = normalizeText(query)
    if (!q) return BRAZIL_LOCATIONS.slice(0, 6)
    return BRAZIL_LOCATIONS.filter((item) => normalizeText(`${item.cidade} ${item.estado} ${item.pais}`).includes(q)).slice(0, 8)
  }, [query])

  return (
    <Field label="Localidade">
      <div className="location-search">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Digite cidade, estado ou país"
        />
        {open ? (
          <div className="location-results">
            {filtered.length ? filtered.map((item) => (
              <button
                type="button"
                key={`${item.cidade}-${item.estado}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(item)
                  setQuery(`${item.cidade}, ${item.estado}, ${item.pais}`)
                  setOpen(false)
                }}
              >
                <strong>{item.cidade}</strong>
                <span>{item.estado}, {item.pais}</span>
              </button>
            )) : <div className="location-empty">Nenhuma cidade encontrada.</div>}
          </div>
        ) : null}
      </div>
    </Field>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function UploadField({ label, value, bucket, onChange, onUpload }: { label: string; value: string; bucket: string; onChange: (value: string) => void; onUpload: (file: File, bucket: string) => Promise<string> }) {
  const target = uploadTargetFor(bucket)
  const previewWidth = 220
  const previewHeight = Math.round(previewWidth * (target.height / target.width))
  const [cropOpen, setCropOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [uploading, setUploading] = useState(false)

  const imageRatio = naturalSize.width && naturalSize.height ? naturalSize.width / naturalSize.height : 1
  const frameRatio = previewWidth / previewHeight
  const coverBase = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return { width: previewWidth, height: previewHeight }
    if (imageRatio > frameRatio) {
      return { width: previewHeight * imageRatio, height: previewHeight }
    }
    return { width: previewWidth, height: previewWidth / imageRatio }
  }, [frameRatio, imageRatio, naturalSize.height, naturalSize.width, previewHeight, previewWidth])

  const drawWidth = coverBase.width * zoom
  const drawHeight = coverBase.height * zoom
  const limitX = Math.max(0, (drawWidth - previewWidth) / 2)
  const limitY = Math.max(0, (drawHeight - previewHeight) / 2)
  const displayLeft = (previewWidth - drawWidth) / 2 + offsetX
  const displayTop = (previewHeight - drawHeight) / 2 + offsetY

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }, [sourceUrl])

  function resetCrop(url = '') {
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setNaturalSize({ width: 0, height: 0 })
    if (url) setSourceUrl(url)
  }

  function closeCropper() {
    setCropOpen(false)
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl('')
    resetCrop()
  }

  async function handleSelect(file: File) {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    const nextUrl = URL.createObjectURL(file)
    resetCrop(nextUrl)
    setCropOpen(true)
  }

  async function handleSaveCrop() {
    if (!sourceUrl) return
    setUploading(true)
    try {
      const image = new Image()
      image.src = sourceUrl
      await image.decode()

      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Nao foi possivel preparar a imagem.')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const scale = target.width / previewWidth
      ctx.drawImage(image, displayLeft * scale, displayTop * scale, drawWidth * scale, drawHeight * scale)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Nao foi possivel gerar o PNG final.')
      const croppedFile = new File([blob], `${bucket}-${Date.now()}.png`, { type: 'image/png' })
      const url = await onUpload(croppedFile, bucket)
      if (url) {
        onChange(url)
        closeCropper()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field label={label}>
      <div className="upload-field compact-upload-field">
        <input
          id={`${bucket}-upload-input`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async (e) => {
            const input = e.currentTarget
            const file = input.files?.[0]

            if (!file) return

            input.value = ''
            await handleSelect(file)
          }}
        />

        <label htmlFor={`${bucket}-upload-input`} className={`upload-picker ${value ? 'filled' : ''}`}>
          {value ? <img src={value} alt="" /> : <Upload size={24} />}
        </label>

        <div className="upload-hint-row">
          <small>{target.kindLabel.toUpperCase()} · PNG · {target.width}x{target.height}</small>
          {value ? (
            <button type="button" className="inline-icon-button" onClick={() => onChange('')}>
              <Trash2 size={15} /> Remover
            </button>
          ) : null}
        </div>

        {cropOpen && typeof document !== 'undefined' ? createPortal(
          <div className="cropper-overlay" onClick={closeCropper}>
            <div className="cropper-modal" onClick={(event) => event.stopPropagation()}>
              <div className="cropper-head">
                <div>
                  <p className="eyebrow">Ajustar {target.kindLabel}</p>
                  <h3>{target.width} x {target.height} px</h3>
                </div>
                <button type="button" className="close-auth" onClick={closeCropper} aria-label="Fechar ajuste da imagem">
                  <X size={18} />
                </button>
              </div>

              <div className="cropper-frame-wrap">
                <div className="cropper-frame" style={{ width: previewWidth, height: previewHeight }}>
                  {sourceUrl ? (
                    <img
                      src={sourceUrl}
                      alt="Prévia"
                      onLoad={(event) => {
                        const element = event.currentTarget
                        setNaturalSize({ width: element.naturalWidth, height: element.naturalHeight })
                      }}
                      style={{ width: drawWidth, height: drawHeight, left: displayLeft, top: displayTop }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="crop-controls">
                <Field label="Tamanho">
                  <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                </Field>
                <div className="crop-range-grid">
                  <Field label="Posição horizontal">
                    <input type="range" min={-Math.ceil(limitX)} max={Math.ceil(limitX)} step="1" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} disabled={limitX === 0} />
                  </Field>
                  <Field label="Posição vertical">
                    <input type="range" min={-Math.ceil(limitY)} max={Math.ceil(limitY)} step="1" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} disabled={limitY === 0} />
                  </Field>
                </div>
              </div>

              <div className="button-row cropper-actions">
                <button type="button" className="button secondary" onClick={closeCropper}>Cancelar</button>
                <button type="button" className="button" onClick={handleSaveCrop} disabled={uploading}>
                  <Check size={16} /> {uploading ? 'Salvando...' : 'Usar imagem'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        ) : null}
      </div>
    </Field>
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

function mediaForProfile(profile: any) {
  return profile?.data?.logo_url || profile?.data?.avatar_url || ''
}

function safeHeaderText(value: string) {
  return String(value || '').trim().replace(/[^\x20-\x7E]/g, '')
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${safeHeaderText(token)}` }
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>('entrar')
  const [profileType, setProfileType] = useState<ProfileType>('produtora')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
  const [group, setGroup] = useState({ nome: '', campeonato_id: '', slots: '12' })
  const [game, setGame] = useState({ nome: '', campeonato_id: '', data_jogo: '', horario: '', numero_partidas: '6', mapas: '', grupos_ids: [] as string[] })
  const [selectedChampId, setSelectedChampId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [teamInviteToken, setTeamInviteToken] = useState('')
  const [teamPanelToken, setTeamPanelToken] = useState('')
  const [teamPlayerChampId, setTeamPlayerChampId] = useState('')
  const [teamPlayerTeamId, setTeamPlayerTeamId] = useState('')
  const [teamStandaloneToken, setTeamStandaloneToken] = useState('')
  const [teamPanelTab, setTeamPanelTab] = useState('campeonatos')
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
  const teamPlayers = useMemo(() => rows.filter((row) => row.entity_type === 'team_player'), [rows])

  const selectedChamp = championships.find((row) => row.id === selectedChampId) || championships[0]
  const selectedChampTeams = links
    .filter((link) => link.parent_id === selectedChamp?.id)
    .map((link) => teams.find((teamRow) => teamRow.id === link.ref_id))
    .filter(Boolean) as DropZoneRow[]

  const managedTeamIds = useMemo(() => {
    if (!account) return []
    const direct = teams.filter((row) => row.created_by === account.auth_user_id).map((row) => row.id)
    const ownProfileTeam = account.profile_type === 'equipe' ? [account.id] : []
    return Array.from(new Set([...direct, ...ownProfileTeam].filter(Boolean)))
  }, [account, teams, links])

  const managedTeams = teams.filter((row) => managedTeamIds.includes(row.id))
  const managedLinks = links.filter((row) => row.ref_id && managedTeamIds.includes(row.ref_id))
  const managedChampionships = championships.filter((row) => managedLinks.some((link) => link.parent_id === row.id))
  const playerInvite = tokens.find((row) => row.token?.toUpperCase() === playerToken.trim().toUpperCase() && row.data?.token_kind === 'player_invite')
  const myRegistrations = registrations.filter((row) => row.created_by === account?.auth_user_id)
  const recentProfileByType = useMemo(() => Object.fromEntries(recentProfiles.map((profile) => [profile.profile_type, profile])) as Partial<Record<ProfileType, any>>, [recentProfiles])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadMeAndRows(data.session.access_token)
    })
    const saved = localStorage.getItem('dropzone_recent_profiles')
    if (saved) setRecentProfiles(JSON.parse(saved))
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

  async function enterRecentProfile(type: ProfileType, recent: any) {
    clearRegisterForm(type)
    setProfileType(type)
    setError('')
    setMessage('')

    if (!recent) {
      setMode('entrar')
      setActiveAuthType(type)
      return
    }

    setUsername(recent.username || '')
    setName(recent.name || '')
    setMediaUrl(mediaForProfile(recent))
    setMode('entrar')

    const { data } = await supabase.auth.getSession()
    if (data.session) {
      try {
        await loadMeAndRows(data.session.access_token)
        return
      } catch {
        await supabase.auth.signOut()
      }
    }

    setActiveAuthType(type)
    setMessage('Digite a senha para acessar esta conta recente.')
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

  function selectLocation(location: { pais: string; estado: string; cidade: string }) {
    setRegisterData((current) => ({ ...current, ...location }))
  }

  function clearRegisterForm(nextType?: ProfileType) {
    setName('')
    setEmail('')
    setUsername('')
    setPassword('')
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

  async function loadMeAndRows(token?: string) {
    const accessToken = token || await getToken()
    if (!accessToken) return

    const meRes = await fetch('/api/me', {
      headers: authHeaders(accessToken),
    })
    const meJson = await meRes.json()
    if (!meRes.ok) throw new Error(meJson.error || 'Sessao invalida.')
    setAccount(meJson.account)
    saveRecentProfile(meJson.account)

    const rowsRes = await fetch('/api/dropzone', {
      headers: authHeaders(accessToken),
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
            email,
            media_url: mediaUrl,
            password,
            details: registerData,
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
      setActiveAuthType(null)
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
          ...authHeaders(token),
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
    setGroup({ nome: '', campeonato_id: champ.id, slots: '12' })
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
    setGame({ nome: '', campeonato_id: champ.id, data_jogo: '', horario: '', numero_partidas: '6', mapas: '', grupos_ids: [] })
  }

  async function acceptTeamInvite() {
    const clean = teamPanelToken.trim().toUpperCase()
    if (!clean) return setError('Cole o token do campeonato.')
    await createRow({
      entity_type: 'championship_team',
      token: clean,
      data: { token: clean },
    }, 'Convite aceito. Equipe adicionada ao campeonato.')
    setTeamPanelToken('')
  }

  async function generatePlayerInvite() {
    const champ = championships.find((row) => row.id === teamPlayerChampId)
    const teamRow = teams.find((row) => row.id === teamPlayerTeamId) || managedTeams[0]
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

  async function generateTeamPlayerInvite() {
    const teamRow = managedTeams[0]
    if (!teamRow) return setError('Equipe nao encontrada para gerar convite.')
    await createRow({
      entity_type: 'invite_token',
      name: `Token jogador ${rowTitle(teamRow)}`,
      ref_id: teamRow.id,
      generate_token: true,
      token_prefix: 'JG',
      data: {
        token_kind: 'player_invite',
        team_id: teamRow.id,
        team_name: teamRow.name,
        team_tag: dataText(teamRow, 'tag'),
      },
    }, 'Token gerado para adicionar jogador na equipe.')
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
                              onClick={() => enterRecentProfile(type, recent)}
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
                        className="login-other-account"
                        onClick={() => {
                          clearRegisterForm('produtora')
                          setProfileType('produtora')
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
                  <div className="tabs auth-inline-tabs">
                    <button type="button" className={`tab ${mode === 'entrar' ? 'active' : ''}`} onClick={() => setMode('entrar')}>Entrar</button>
                    <button type="button" className={`tab ${mode === 'criar' ? 'active' : ''}`} onClick={() => setMode('criar')}>Criar conta</button>
                  </div>
                  <button type="button" className="close-auth inline-close" onClick={() => setActiveAuthType(null)} aria-label="Fechar">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAuth} className="auth-inline-form compact-auth-form">
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
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={profileType === 'jogador' ? 'Nick do jogador' : 'Nome público'} />
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
                        <Field label="E-mail de confirmação">
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@gmail.com" />
                        </Field>
                      </div>
                    </div>
                  ) : null}

                  <div className="mini-grid auth-base-grid">
                    <Field label="Login único ou ID">
                      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@login ou ID público" />
                    </Field>
                    <Field label="Senha">
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                    </Field>
                  </div>

                  <div className="auth-actions-row">
                    <button className="button" disabled={loading}>{mode === 'criar' ? 'Criar e entrar' : 'Entrar'}</button>
                    <button type="button" className="link-button auth-inline-link" onClick={() => setMessage('Recuperação de senha entra na próxima etapa: envio pelo e-mail confirmado do perfil.')}>Esqueci minha senha</button>
                  </div>
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
                teamPlayers={teamPlayers}
                registrations={registrations}
                teamPanelTab={teamPanelTab}
                setTeamPanelTab={setTeamPanelTab}
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
                generateTeamPlayerInvite={generateTeamPlayerInvite}
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
  group: { nome: string; campeonato_id: string; slots: string }
  setGroup: (value: any) => void
  game: { nome: string; campeonato_id: string; data_jogo: string; horario: string; numero_partidas: string; mapas: string; grupos_ids: string[] }
  setGame: (value: any) => void
  createChampionship: () => void
  createTeam: () => void
  createGroup: () => void
  createGame: () => void
  addTeamToChamp: () => void
  generateTeamInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
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
          <UploadField label="Logo do campeonato" value={props.championship.logo_url} bucket="campeonato" onChange={(url) => props.setChampionship({ ...props.championship, logo_url: url })} onUpload={props.uploadPublicFile} />
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
            <UploadField label="Logo da equipe" value={props.team.logo_url} bucket="equipe" onChange={(url) => props.setTeam({ ...props.team, logo_url: url })} onUpload={props.uploadPublicFile} />
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
            <Field label="Slots do grupo"><input type="number" value={props.group.slots} onChange={(e) => props.setGroup({ ...props.group, slots: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} placeholder="12" /></Field>
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
            <Field label="Horário"><input type="time" value={props.game.horario} onChange={(e) => props.setGame({ ...props.game, horario: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} /></Field>
            <Field label="Número de partidas"><input type="number" value={props.game.numero_partidas} onChange={(e) => props.setGame({ ...props.game, numero_partidas: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} /></Field>
            <Field label="Mapas"><input value={props.game.mapas} onChange={(e) => props.setGame({ ...props.game, mapas: e.target.value, campeonato_id: props.selectedChamp?.id || '' })} placeholder="Bermuda, Purgatório, Alpine" /></Field>
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
  teamPlayers: DropZoneRow[]
  registrations: DropZoneRow[]
  tokens: DropZoneRow[]
  teamPanelTab: string
  setTeamPanelTab: (value: string) => void
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
  generateTeamPlayerInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const currentTeam = props.managedTeams[0]
  const teamPlayerIds = new Set(props.managedTeams.map((team) => team.id))
  const playerInvites = props.tokens.filter((row) => row.data?.token_kind === 'player_invite' && row.ref_id && teamPlayerIds.has(row.ref_id))
  const standaloneInvites = playerInvites.filter((row) => !row.parent_id)
  const championshipInvites = playerInvites.filter((row) => row.parent_id)
  const teamMembers = props.teamPlayers.filter((row) => row.ref_id && teamPlayerIds.has(row.ref_id))
  const TEAM_PLAYER_LIMIT = 6

  return (
    <div className="team-dashboard">
      <section className="panel span-2 team-tabs-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">{props.accountType === 'manager' ? 'Manager' : 'Equipe'}</p>
            <h2>Painel da equipe</h2>
          </div>
          <Shield />
        </div>

        <div className="tabs panel-tabs">
          <button type="button" className={`tab ${props.teamPanelTab === 'campeonatos' ? 'active' : ''}`} onClick={() => props.setTeamPanelTab('campeonatos')}>Campeonatos</button>
          <button type="button" className={`tab ${props.teamPanelTab === 'jogadores' ? 'active' : ''}`} onClick={() => props.setTeamPanelTab('jogadores')}>Jogadores</button>
          <button type="button" className={`tab ${props.teamPanelTab === 'convites' ? 'active' : ''}`} onClick={() => props.setTeamPanelTab('convites')}>Convites</button>
          <button type="button" className={`tab ${props.teamPanelTab === 'config' ? 'active' : ''}`} onClick={() => props.setTeamPanelTab('config')}>Configurações</button>
        </div>
      </section>

      {props.teamPanelTab === 'campeonatos' ? (
        <>
          <section className="panel span-2">
            <div className="section-head">
              <div>
                <p className="eyebrow">Campeonatos</p>
                <h2>Campeonatos inscritos</h2>
              </div>
              <Trophy />
            </div>
            {props.managedChampionships.length === 0 ? <p className="empty">Sua equipe ainda não está inscrita em campeonatos.</p> : null}
            <div className="cards compact championship-list-cards">
              {props.managedChampionships.map((champ) => {
                const link = props.managedLinks.find((item) => item.parent_id === champ.id)
                const used = props.registrations.filter((item) => item.parent_id === champ.id && item.ref_id === link?.ref_id).length
                const free = Math.max(0, TEAM_PLAYER_LIMIT - used)
                return (
                  <div className="card championship-team-card" key={champ.id}>
                    <p>{dataText(champ, 'premiacao') ? `Premiação ${dataText(champ, 'premiacao')}` : 'Campeonato'}</p>
                    <strong>{rowTitle(champ)}</strong>
                    <small>Grupo: {dataText(link, 'grupo_id') || 'não definido'} · Slot: {dataText(link, 'slot') || 'não definido'}</small>
                    <div className="slot-row">
                      <span>{used}/{TEAM_PLAYER_LIMIT} jogadores escalados</span>
                      <b>{free} vagas</b>
                    </div>
                    <div className="button-row compact-row">
                      <button type="button" className="button secondary" onClick={() => {
                        props.setTeamPlayerChampId(champ.id)
                        props.setTeamPlayerTeamId(link?.ref_id || currentTeam?.id || '')
                        props.setTeamPanelTab('convites')
                      }}>Gerar token</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel span-2">
            <h2>Entrar em novo campeonato</h2>
            <p className="muted-text">Cole o token enviado pela produtora para adicionar esta equipe ao campeonato.</p>
            <Field label="Token do campeonato">
              <input value={props.teamPanelToken} onChange={(e) => props.setTeamPanelToken(e.target.value.toUpperCase())} placeholder="EQ-..." />
            </Field>
            <button className="button" onClick={props.acceptTeamInvite}>Aceitar convite</button>
          </section>
        </>
      ) : null}

      {props.teamPanelTab === 'jogadores' ? (
        <section className="panel span-2">
          <div className="section-head">
            <div>
              <p className="eyebrow">Elenco</p>
              <h2>Jogadores da equipe</h2>
            </div>
            <Users />
          </div>
          {teamMembers.length === 0 ? <p className="empty">Nenhum jogador vinculado diretamente à equipe.</p> : null}
          <div className="cards compact">
            {teamMembers.map((row) => (
              <div className="card" key={row.id}>
                <p>{dataText(row, 'funcao') || 'Jogador'}</p>
                <strong>{dataText(row, 'nick') || rowTitle(row)}</strong>
                <small>ID: {dataText(row, 'id_jogo') || '-'}</small>
              </div>
            ))}
          </div>

          <h3>Escalados em campeonatos</h3>
          <div className="cards compact">
            {props.registrations.filter((row) => row.ref_id && teamPlayerIds.has(row.ref_id)).map((row) => (
              <div className="card" key={row.id}>
                <p>{dataText(row, 'funcao') || 'Jogador'}</p>
                <strong>{dataText(row, 'nick') || rowTitle(row)}</strong>
                <small>ID: {dataText(row, 'id_jogo') || '-'} · Campeonato vinculado</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {props.teamPanelTab === 'convites' ? (
        <section className="panel span-2">
          <div className="section-head">
            <div>
              <p className="eyebrow">Convites</p>
              <h2>Tokens para jogadores</h2>
            </div>
            <Send />
          </div>

          <div className="form-grid">
            <Field label="Campeonato para escalar jogador">
              <select value={props.teamPlayerChampId} onChange={(e) => props.setTeamPlayerChampId(e.target.value)}>
                <option value="">Sem campeonato / só adicionar na equipe</option>
                {props.managedChampionships.map((champ) => <option key={champ.id} value={champ.id}>{champ.name}</option>)}
              </select>
            </Field>
            <Field label="Equipe">
              <select value={props.teamPlayerTeamId || currentTeam?.id || ''} onChange={(e) => props.setTeamPlayerTeamId(e.target.value)}>
                <option value="">Selecione</option>
                {props.managedTeams.map((team) => <option key={team.id} value={team.id}>{dataText(team, 'tag') ? `[${dataText(team, 'tag')}] ` : ''}{team.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="button-row compact-row">
            <button className="button" onClick={props.teamPlayerChampId ? props.generatePlayerInvite : props.generateTeamPlayerInvite}>Gerar token</button>
          </div>

          <div className="token-list">
            {[...championshipInvites, ...standaloneInvites].map((token) => (
              <button key={token.id} className="token-card" onClick={() => props.copyToken(token.token)}>
                <span>{dataText(token, 'championship_name') || 'Adicionar na equipe'}</span>
                <strong>{tokenText(token.token)}</strong>
                <Copy size={15} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {props.teamPanelTab === 'config' ? (
        <section className="panel span-2">
          <h2>Configurações</h2>
          <p className="empty">Edição de nome, tag e logo entra aqui na próxima etapa. A equipe não cria outra equipe neste painel.</p>
        </section>
      ) : null}
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
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
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
          <UploadField label="Foto do jogador" value={props.player.foto_url} bucket="jogador" onChange={(url) => props.setPlayer({ ...props.player, foto_url: url })} onUpload={props.uploadPublicFile} />
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
