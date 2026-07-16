'use client'

import { Building2, Shield, UserRound, Users } from 'lucide-react'
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

function mediaOf(alvo: StaffVinculo['alvo']) {
  return String(alvo.logo_url || alvo.avatar_url || '')
}

function permLabels(perms: Record<string, boolean>) {
  const map: Record<string, string> = {
    pode_ver: 'ver',
    pode_editar: 'editar',
    pode_escalar: 'escalar',
    pode_gerar_token: 'tokens',
    pode_criar_campeonato: 'criar eventos',
    pode_gerenciar_campeonato: 'gerir eventos',
  }
  return Object.entries(perms)
    .filter(([, v]) => v)
    .map(([k]) => map[k] || k)
    .join(' · ')
}

/** Lista unificada: vínculos de staff + perfis da mesma conta. */
export function ManagerContextsView(props: {
  context: 'equipes' | 'jogador'
  /** Staff via manager_equipe / manager_jogador */
  staff: StaffVinculo[]
  /** Perfis vinculados no mesmo login */
  linkedProfiles: DropZoneRow[]
  loading?: boolean
  error?: string
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: ProfileType) => void
  onOpenStaff?: (item: StaffVinculo) => void
}) {
  const isEquipe = props.context === 'equipes'
  const Icon = isEquipe ? Users : UserRound
  const profileType: ProfileType = isEquipe ? 'equipe' : 'jogador'
  const staffTitle = isEquipe ? 'Equipes onde você é staff' : 'Jogadores que você gerencia'
  const linkedTitle = isEquipe ? 'Seus perfis de equipe nesta conta' : 'Seu perfil de jogador nesta conta'
  const emptyStaff = isEquipe
    ? 'Nenhuma equipe te convidou como manager ainda. Quando aceitar um convite no correio, ela aparece aqui.'
    : 'Nenhum jogador sob sua gestão ainda.'
  const emptyLinked = isEquipe
    ? 'Você ainda não tem perfil de equipe neste login. Pode criar um vinculado para operar como dono/líder.'
    : 'Você ainda não tem perfil de jogador neste login.'

  return (
    <div className="manager-context-stack">
      {props.error ? <div className="message error">{props.error}</div> : null}

      <section className="panel span-3">
        <div className="section-head">
          <div>
            <p className="eyebrow">Como ajudante</p>
            <h2>{staffTitle}</h2>
            <p className="empty" style={{ marginTop: 6 }}>
              Vínculos em que outro dono te convidou. Permissões vêm do convite.
            </p>
          </div>
          <Shield />
        </div>

        {props.loading ? <p className="empty">Carregando vínculos...</p> : null}
        {!props.loading && props.staff.length === 0 ? <p className="empty">{emptyStaff}</p> : null}

        <div className="manager-staff-grid">
          {props.staff.map((item) => {
            const media = mediaOf(item.alvo)
            const label = item.alvo.nome || item.alvo.username || 'Sem nome'
            const perms = permLabels(item.permissoes)
            return (
              <article key={item.vinculo_id} className="manager-staff-card">
                <span className="manager-staff-avatar">
                  {media ? <img src={media} alt="" /> : <b>{label.slice(0, 2).toUpperCase()}</b>}
                </span>
                <div className="manager-staff-copy">
                  <strong>{label}</strong>
                  <small>
                    {item.alvo.username ? `@${item.alvo.username}` : '—'}
                    {item.alvo.public_id != null ? ` · ID ${item.alvo.public_id}` : ''}
                  </small>
                  <small className="manager-staff-perms">{perms || 'sem permissões extras'}</small>
                </div>
                <span className="manager-staff-badge">Staff</span>
                {props.onOpenStaff ? (
                  <button type="button" className="button secondary small" onClick={() => props.onOpenStaff?.(item)}>
                    Detalhes
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel span-3">
        <div className="section-head">
          <div>
            <p className="eyebrow">Mesma conta de login</p>
            <h2>{linkedTitle}</h2>
            <p className="empty" style={{ marginTop: 6 }}>
              {isEquipe
                ? 'Perfil de equipe criado neste login — você opera como dono/líder da pasta.'
                : 'Perfil de jogador neste login — você compete com esta identidade.'}
            </p>
          </div>
          <Icon />
        </div>

        {props.linkedProfiles.length === 0 ? (
          <div className="manager-empty-switch">
            <Shield size={20} />
            <div>
              <strong>{emptyLinked}</strong>
              <p>Isso é independente de ser staff de outra pessoa.</p>
            </div>
            {props.onCreateLinkedProfile ? (
              <button type="button" className="button" onClick={() => props.onCreateLinkedProfile?.(profileType)}>
                Criar perfil de {profileType}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="manager-profile-grid">
            {props.linkedProfiles.map((account) => {
              const media = String(account.data?.logo_url || account.data?.avatar_url || '')
              return (
                <button
                  key={account.id}
                  type="button"
                  className="manager-profile-card"
                  onClick={() => props.onSwitchAccount?.(account)}
                  disabled={!props.onSwitchAccount}
                >
                  <span className="manager-profile-avatar">
                    {media ? (
                      <img src={media} alt="" />
                    ) : (
                      <b>{String(account.name || account.username || 'DZ').slice(0, 2).toUpperCase()}</b>
                    )}
                  </span>
                  <span className="manager-profile-copy">
                    <strong>{account.name || account.username}</strong>
                    <small>
                      @{account.username}
                      {account.public_id ? ` · ID ${account.public_id}` : ''}
                    </small>
                    <small className="manager-profile-cta">Abrir painel de {profileType}</small>
                  </span>
                </button>
              )
            })}
            {props.onCreateLinkedProfile ? (
              <button
                type="button"
                className="manager-profile-card manager-profile-card-create"
                onClick={() => props.onCreateLinkedProfile?.(profileType)}
              >
                <span className="manager-profile-avatar">
                  <Building2 size={18} />
                </span>
                <span className="manager-profile-copy">
                  <strong>Criar outro {profileType}</strong>
                  <small>Perfil vinculado na mesma conta</small>
                </span>
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
