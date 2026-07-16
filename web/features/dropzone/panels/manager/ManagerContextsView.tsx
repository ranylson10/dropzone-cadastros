'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react'
import type { DropZoneRow, ProfileType } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'
import { Field, UploadField } from '../../components/form-fields'
import { uploadPublicFile } from '@/lib/upload-public'
import { ProfileEditForm } from '@/components/forms/ProfileEditForm'

export type StaffVinculo = {
  vinculo_id: string
  tipo: 'equipe' | 'produtora' | 'jogador'
  permissoes: Record<string, boolean>
  alvo: {
    id: string
    nome?: string
    username?: string
    logo_url?: string | null
    avatar_url?: string | null
    tag?: string | null
    public_id?: number | null
    status?: string
  }
  created_at?: string
}

type ListItem =
  | { key: string; kind: 'staff'; staff: StaffVinculo }
  | { key: string; kind: 'perfil'; account: DropZoneRow }

type LineRow = {
  id: string
  nome: string
  tag?: string | null
  logo_url?: string | null
  status?: string
  campeonatos?: Array<{
    participacao_id: string
    campeonato_id: string
    nome: string
    logo_url?: string | null
    status?: string
  }>
}

function mediaOf(alvo: StaffVinculo['alvo']) {
  return String(alvo.logo_url || alvo.avatar_url || '')
}

function mediaOfAccount(account: DropZoneRow) {
  return String(account.data?.logo_url || account.data?.avatar_url || '')
}

function permLabels(perms: Record<string, boolean>) {
  const map: Record<string, string> = {
    pode_ver: 'Ver',
    pode_editar: 'Editar',
    pode_escalar: 'Escalar',
    pode_gerar_token: 'Tokens',
    pode_criar_campeonato: 'Criar eventos',
    pode_gerenciar_campeonato: 'Gerir eventos',
  }
  return Object.entries(perms)
    .filter(([, v]) => v)
    .map(([k]) => map[k] || k)
}

function initials(label: string) {
  return String(label || 'DZ').slice(0, 2).toUpperCase()
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/**
 * Lista esquerda + detalhe direita.
 * Perfis do mesmo login NÃO trocam de conta — ficam no manager.
 */
export function ManagerContextsView(props: {
  context: 'equipes' | 'jogador'
  staff: StaffVinculo[]
  linkedProfiles: DropZoneRow[]
  loading?: boolean
  error?: string
  onCreateLinkedProfile?: (profileType?: ProfileType) => void
  onOpenStaff?: (item: StaffVinculo) => void
}) {
  const isEquipe = props.context === 'equipes'
  const Icon = isEquipe ? Users : UserRound
  const profileType: ProfileType = isEquipe ? 'equipe' : 'jogador'
  const listTitle = isEquipe ? 'Equipes' : 'Jogadores'
  const emptyAll = isEquipe ? 'Nenhuma equipe vinculada.' : 'Nenhum jogador vinculado.'

  const [selectedKey, setSelectedKey] = useState('')

  const items = useMemo<ListItem[]>(() => {
    const staffItems: ListItem[] = props.staff.map((staff) => ({
      key: `staff:${staff.vinculo_id}`,
      kind: 'staff',
      staff,
    }))
    const perfilItems: ListItem[] = props.linkedProfiles.map((account) => ({
      key: `perfil:${account.id}`,
      kind: 'perfil',
      account,
    }))
    return [...staffItems, ...perfilItems]
  }, [props.staff, props.linkedProfiles])

  useEffect(() => {
    if (!items.length) {
      setSelectedKey('')
      return
    }
    if (!items.some((i) => i.key === selectedKey)) {
      setSelectedKey(items[0].key)
    }
  }, [items, selectedKey])

  const selected = items.find((i) => i.key === selectedKey) || null

  const selectedEquipeId =
    selected?.kind === 'staff'
      ? selected.staff.alvo.id
      : selected?.kind === 'perfil'
        ? selected.account.id
        : ''

  const canEditEquipe =
    selected?.kind === 'perfil'
    || (selected?.kind === 'staff' && Boolean(selected.staff.permissoes?.pode_editar))

  const canViewEquipe =
    selected?.kind === 'perfil'
    || (selected?.kind === 'staff' && selected.staff.permissoes?.pode_ver !== false)

  return (
    <div className="manager-context-stack span-3">
      {props.error ? <div className="message error">{props.error}</div> : null}

      <div className="producer-layout-ref">
        <aside className="championship-nav-card panel">
          <div className="section-head compact-head">
            <div>
              <p className="eyebrow">Manager</p>
              <h2>{listTitle}</h2>
            </div>
            <Icon />
          </div>

          <div className="championship-list ref-list">
            {props.loading ? <p className="empty">Carregando...</p> : null}
            {!props.loading && items.length === 0 ? <p className="empty">{emptyAll}</p> : null}

            {items.map((item) => {
              if (item.kind === 'staff') {
                const label = item.staff.alvo.nome || item.staff.alvo.username || 'Sem nome'
                const media = mediaOf(item.staff.alvo)
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`champ-list-item ref-champ-item ${selectedKey === item.key ? 'active' : ''}`}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <span className="champ-thumb">
                      {media ? <img src={media} alt="" /> : <b>{initials(label)}</b>}
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>
                        Staff
                        {item.staff.alvo.username ? ` · @${item.staff.alvo.username}` : ''}
                      </small>
                    </span>
                  </button>
                )
              }

              const label = String(item.account.name || item.account.username || 'Perfil')
              const media = mediaOfAccount(item.account)
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`champ-list-item ref-champ-item ${selectedKey === item.key ? 'active' : ''}`}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <span className="champ-thumb">
                    {media ? <img src={media} alt="" /> : <b>{initials(label)}</b>}
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>
                      Dono
                      {item.account.username ? ` · @${item.account.username}` : ''}
                    </small>
                  </span>
                </button>
              )
            })}
          </div>

          {props.onCreateLinkedProfile ? (
            <button type="button" className="button full" onClick={() => props.onCreateLinkedProfile?.(profileType)}>
              Nova {profileType}
            </button>
          ) : null}
        </aside>

        <section className="championship-detail-card panel manager-detail-panel">
          {!selected ? (
            <div className="manager-detail-empty">
              <Icon size={28} />
              <div>
                <strong>Selecione {isEquipe ? 'uma equipe' : 'um jogador'}</strong>
              </div>
            </div>
          ) : null}

          {selected?.kind === 'staff' && !isEquipe ? (
            <EntityDetail
              label={selected.staff.alvo.nome || selected.staff.alvo.username || 'Sem nome'}
              media={mediaOf(selected.staff.alvo)}
              username={selected.staff.alvo.username}
              publicId={selected.staff.alvo.public_id}
              status={selected.staff.alvo.status}
              role="Staff"
              perms={permLabels(selected.staff.permissoes)}
              actions={
                props.onOpenStaff ? (
                  <button type="button" className="button" onClick={() => props.onOpenStaff?.(selected.staff)}>
                    Opções
                  </button>
                ) : null
              }
            />
          ) : null}

          {selected?.kind === 'perfil' && !isEquipe ? (
            <EntityDetail
              label={String(selected.account.name || selected.account.username || 'Perfil')}
              media={mediaOfAccount(selected.account)}
              username={selected.account.username || undefined}
              publicId={selected.account.public_id}
              status={selected.account.status}
              role="Dono"
              perms={['Controle total']}
              actions={null}
            />
          ) : null}

          {isEquipe && selected && selectedEquipeId && canViewEquipe ? (
            <EquipeManagerDetail
              equipeId={selectedEquipeId}
              label={
                selected.kind === 'staff'
                  ? selected.staff.alvo.nome || selected.staff.alvo.username || 'Equipe'
                  : String(selected.account.name || selected.account.username || 'Equipe')
              }
              media={
                selected.kind === 'staff'
                  ? mediaOf(selected.staff.alvo)
                  : mediaOfAccount(selected.account)
              }
              username={
                selected.kind === 'staff'
                  ? selected.staff.alvo.username
                  : selected.account.username || undefined
              }
              publicId={
                selected.kind === 'staff'
                  ? selected.staff.alvo.public_id
                  : selected.account.public_id
              }
              status={
                selected.kind === 'staff'
                  ? selected.staff.alvo.status
                  : selected.account.status
              }
              role={selected.kind === 'staff' ? 'Staff' : 'Dono'}
              perms={
                selected.kind === 'staff'
                  ? permLabels(selected.staff.permissoes)
                  : ['Controle total']
              }
              canEdit={canEditEquipe}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}

function EntityDetail(props: {
  label: string
  media: string
  username?: string | null
  publicId?: number | null
  status?: string | null
  role: string
  perms: string[]
  actions?: ReactNode
}) {
  return (
    <>
      <div className="section-head compact-head">
        <div>
          <p className="eyebrow">{props.role}</p>
          <h2>{props.label}</h2>
        </div>
        <span className="champ-thumb manager-detail-thumb">
          {props.media ? <img src={props.media} alt="" /> : <b>{initials(props.label)}</b>}
        </span>
      </div>

      <div className="manager-detail-meta">
        <div>
          <small>Usuário</small>
          <strong>{props.username ? `@${props.username}` : '—'}</strong>
        </div>
        <div>
          <small>ID</small>
          <strong>{props.publicId != null ? props.publicId : '—'}</strong>
        </div>
        <div>
          <small>Status</small>
          <strong>{props.status || 'ativo'}</strong>
        </div>
        <div>
          <small>Papel</small>
          <strong>{props.role}</strong>
        </div>
      </div>

      <div className="manager-detail-block">
        <div className="manager-perm-chips">
          {props.perms.length ? (
            props.perms.map((p) => (
              <span key={p} className="manager-perm-chip">
                <Shield size={12} /> {p}
              </span>
            ))
          ) : (
            <span className="manager-perm-chip muted">Sem permissões</span>
          )}
        </div>
      </div>

      {props.actions ? <div className="manager-detail-actions">{props.actions}</div> : null}
    </>
  )
}

function EquipeManagerDetail(props: {
  equipeId: string
  label: string
  media: string
  username?: string | null
  publicId?: number | null
  status?: string | null
  role: string
  perms: string[]
  canEdit: boolean
}) {
  const [tab, setTab] = useState<'lines' | 'campeonatos' | 'perfil'>('lines')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState<LineRow[]>([])
  const [participacoes, setParticipacoes] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [nome, setNome] = useState('')
  const [tag, setTag] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const load = useCallback(async () => {
    if (!props.equipeId) return
    setLoading(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/equipes/${encodeURIComponent(props.equipeId)}/lines`, {
        headers,
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar equipe.')
      setLines(Array.isArray(json.lines) ? json.lines : [])
      setParticipacoes(Array.isArray(json.participacoes) ? json.participacoes : [])
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar equipe.')
      setLines([])
      setParticipacoes([])
    } finally {
      setLoading(false)
    }
  }, [props.equipeId])

  useEffect(() => {
    void load()
    setShowForm(false)
    setEditingId('')
    setTab('lines')
  }, [load])

  function startCreate() {
    setEditingId('')
    setNome('')
    setTag('')
    setLogoUrl(props.media || '')
    setShowForm(true)
  }

  function startEdit(line: LineRow) {
    setEditingId(line.id)
    setNome(line.nome)
    setTag(line.tag || '')
    setLogoUrl(line.logo_url || props.media || '')
    setShowForm(true)
  }

  async function saveLine() {
    if (!nome.trim()) {
      setError('Informe o nome da line.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/equipes/${encodeURIComponent(props.equipeId)}/lines`, {
        method: editingId ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(
          editingId
            ? { line_id: editingId, nome: nome.trim(), tag: tag.trim() || null, logo_url: logoUrl.trim() || null }
            : { nome: nome.trim(), tag: tag.trim() || null, logo_url: logoUrl.trim() || props.media || null },
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar line.')
      setShowForm(false)
      setEditingId('')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar line.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteLine(lineId: string) {
    if (!window.confirm('Apagar esta line?')) return
    setBusy(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `/api/equipes/${encodeURIComponent(props.equipeId)}/lines?line_id=${encodeURIComponent(lineId)}`,
        { method: 'DELETE', headers },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao apagar line.')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao apagar line.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-head compact-head">
        <div>
          <p className="eyebrow">{props.role}</p>
          <h2>{props.label}</h2>
        </div>
        <span className="champ-thumb manager-detail-thumb">
          {props.media ? <img src={props.media} alt="" /> : <b>{initials(props.label)}</b>}
        </span>
      </div>

      <div className="manager-detail-meta">
        <div>
          <small>Usuário</small>
          <strong>{props.username ? `@${props.username}` : '—'}</strong>
        </div>
        <div>
          <small>ID</small>
          <strong>{props.publicId != null ? props.publicId : '—'}</strong>
        </div>
        <div>
          <small>Status</small>
          <strong>{props.status || 'ativo'}</strong>
        </div>
        <div>
          <small>Papel</small>
          <strong>{props.role}</strong>
        </div>
      </div>

      <div className="manager-detail-block">
        <div className="manager-perm-chips">
          {props.perms.map((p) => (
            <span key={p} className="manager-perm-chip">
              <Shield size={12} /> {p}
            </span>
          ))}
        </div>
      </div>

      <div className="producer-tabs manager-champ-tabs" style={{ marginTop: 8 }}>
        <button type="button" className={tab === 'lines' ? 'active' : ''} onClick={() => setTab('lines')}>
          Lines
        </button>
        <button
          type="button"
          className={tab === 'campeonatos' ? 'active' : ''}
          onClick={() => setTab('campeonatos')}
        >
          Campeonatos
        </button>
        {props.role === 'Dono' ? (
          <button type="button" className={tab === 'perfil' ? 'active' : ''} onClick={() => setTab('perfil')}>
            Perfil
          </button>
        ) : null}
      </div>

      {error ? <div className="message error" style={{ marginTop: 10 }}>{error}</div> : null}

      {loading ? (
        <p className="empty" style={{ marginTop: 14 }}>
          <Loader2 size={16} className="spin" /> Carregando...
        </p>
      ) : null}

      {!loading && tab === 'lines' ? (
        <div className="ref-section-stack" style={{ marginTop: 12 }}>
          <div className="subtab-actionbar">
            <div>
              <p className="eyebrow">Lines</p>
              <h3>{lines.length} line(s)</h3>
            </div>
            {props.canEdit ? (
              <button type="button" className="button" onClick={startCreate}>
                <Plus size={16} /> Nova line
              </button>
            ) : null}
          </div>

          {showForm && props.canEdit ? (
            <div className="inline-action-panel">
              <div className="mini-grid two">
                <Field label="Nome da line">
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: ALOE BASE" />
                </Field>
                <Field label="Tag (opcional)">
                  <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ex.: ALOE" />
                </Field>
              </div>
              <UploadField
                label="Logo da line (nasce com a logo da equipe)"
                value={logoUrl}
                bucket="equipe"
                onChange={setLogoUrl}
                onUpload={async (file, b) => uploadPublicFile(file, b, 'manager')}
              />
              <div className="button-row">
                <button type="button" className="button" disabled={busy} onClick={() => void saveLine()}>
                  {busy ? 'Salvando...' : editingId ? 'Salvar' : 'Criar line'}
                </button>
                <button type="button" className="button secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <div className="championship-vagas-list">
            {lines.length === 0 ? (
              <div className="vagas-empty-filter">Nenhuma line nesta equipe.</div>
            ) : (
              lines.map((line, index) => (
                <article key={line.id} className="championship-vaga-row status-ocupada">
                  <div className="vaga-row-summary" style={{ cursor: 'default' }}>
                    <span className="vaga-row-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="vaga-row-avatar status-ocupada" aria-hidden>
                      {line.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.logo_url} alt="" />
                      ) : (
                        <Users size={18} />
                      )}
                    </span>
                    <span className="vaga-row-identity">
                      <strong>{line.nome}</strong>
                      <small>
                        {line.tag ? `Tag ${line.tag}` : 'Sem tag'}
                        {(line.campeonatos || []).length
                          ? ` · ${(line.campeonatos || []).length} campeonato(s)`
                          : ' · livre'}
                      </small>
                    </span>
                    <span className="vaga-row-meta">
                      {props.canEdit ? (
                        <>
                          <button type="button" className="button small secondary" onClick={() => startEdit(line)}>
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="button small secondary"
                            disabled={busy}
                            onClick={() => void deleteLine(line.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : null}
                    </span>
                    <span className="vaga-row-chevron" aria-hidden />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === 'perfil' && props.role === 'Dono' ? (
        <div style={{ marginTop: 12 }}>
          <ProfileEditForm
            profileType="equipe"
            profileId={props.equipeId}
            initial={{
              nome: props.label,
              logo_url: props.media,
              bio: '',
              tag: '',
            }}
          />
        </div>
      ) : null}

      {!loading && tab === 'campeonatos' ? (
        <div className="ref-section-stack" style={{ marginTop: 12 }}>
          <div className="subtab-actionbar">
            <div>
              <p className="eyebrow">Campeonatos</p>
              <h3>{participacoes.length} inscrição(ões)</h3>
            </div>
          </div>
          <p className="empty" style={{ margin: '0 0 10px' }}>
            Para entrar em novos eventos, abra o link de inscrição do campeonato — o manager escolhe a equipe na lista.
          </p>
          <div className="championship-vagas-list">
            {participacoes.length === 0 ? (
              <div className="vagas-empty-filter">Nenhuma line inscrita em campeonato.</div>
            ) : (
              participacoes.map((p, index) => {
                const camp = p.campeonato || {}
                const line = lines.find((l) => l.id === p.line_id)
                return (
                  <article key={p.id} className="championship-vaga-row status-ocupada">
                    <div className="vaga-row-summary" style={{ cursor: 'default' }}>
                      <span className="vaga-row-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="vaga-row-avatar status-ocupada" aria-hidden>
                        {camp.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={camp.logo_url} alt="" />
                        ) : (
                          <Trophy size={18} />
                        )}
                      </span>
                      <span className="vaga-row-identity">
                        <strong>{camp.nome || p.nome_exibicao || 'Campeonato'}</strong>
                        <small>{line?.nome || 'Line'} · {p.status || 'ativo'}</small>
                      </span>
                      <span className="vaga-row-meta">
                        {p.campeonato_id ? (
                          <a
                            className="button small secondary"
                            href={`/campeonatos/${p.campeonato_id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </span>
                      <span className="vaga-row-chevron" aria-hidden />
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
