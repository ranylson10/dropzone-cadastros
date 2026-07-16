'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Shield, UserRound, Users } from 'lucide-react'
import type { DropZoneRow, ProfileType } from '@/lib/types'

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

/**
 * Lista esquerda + detalhe direita (mesmo padrão do campeonato da produtora).
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

          {selected?.kind === 'staff' ? (
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

          {selected?.kind === 'perfil' ? (
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
