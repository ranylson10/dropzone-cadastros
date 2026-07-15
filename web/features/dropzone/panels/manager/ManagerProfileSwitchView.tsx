'use client'

import { Plus, Shield, UserRound, Users } from 'lucide-react'
import type { DropZoneRow, ProfileType } from '@/lib/types'

export function ManagerProfileSwitchView(props: {
  mode: 'equipes' | 'jogador'
  accounts: DropZoneRow[]
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType: ProfileType) => void
}) {
  const targetType: ProfileType = props.mode === 'equipes' ? 'equipe' : 'jogador'
  const matches = props.accounts.filter((item) => item.profile_type === targetType)
  const Icon = props.mode === 'equipes' ? Users : UserRound

  return (
    <section className="panel span-3">
      <div className="section-head">
        <div>
          <p className="eyebrow">{props.mode === 'equipes' ? 'Perfil de equipe' : 'Perfil de jogador'}</p>
          <h2>
            {props.mode === 'equipes'
              ? 'Equipes que você controla'
              : 'Seu perfil de jogador'}
          </h2>
          <p className="empty" style={{ marginTop: 6 }}>
            {props.mode === 'equipes'
              ? 'O manager pode também ser líder/staff de equipe. Troque para o painel de equipe para elenco, escalações e convites.'
              : 'O manager pode também competir como jogador. Troque para o painel de jogador para inscrições e elenco.'}
          </p>
        </div>
        <Icon />
      </div>

      {matches.length === 0 ? (
        <div className="manager-empty-switch">
          <Shield size={20} />
          <div>
            <strong>
              {props.mode === 'equipes'
                ? 'Nenhum perfil de equipe vinculado'
                : 'Nenhum perfil de jogador vinculado'}
            </strong>
            <p>
              Crie um perfil vinculado na mesma conta Google/Discord/Facebook. Depois você troca entre os painéis sem
              sair.
            </p>
          </div>
          {props.onCreateLinkedProfile ? (
            <button
              type="button"
              className="button"
              onClick={() => props.onCreateLinkedProfile?.(targetType)}
            >
              <Plus size={16} /> Criar perfil de {targetType}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="manager-profile-grid">
          {matches.map((account) => {
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
                  {media ? <img src={media} alt="" /> : <b>{String(account.name || account.username || 'DZ').slice(0, 2).toUpperCase()}</b>}
                </span>
                <span className="manager-profile-copy">
                  <strong>{account.name || account.username}</strong>
                  <small>
                    @{account.username}
                    {account.public_id ? ` · ID ${account.public_id}` : ''}
                  </small>
                  <small className="manager-profile-cta">Abrir painel de {targetType}</small>
                </span>
              </button>
            )
          })}
          {props.onCreateLinkedProfile && matches.length === 0 ? null : props.onCreateLinkedProfile && targetType === 'equipe' ? (
            <button
              type="button"
              className="manager-profile-card is-create"
              onClick={() => props.onCreateLinkedProfile?.(targetType)}
            >
              <span className="manager-profile-avatar"><Plus size={18} /></span>
              <span className="manager-profile-copy">
                <strong>Criar outra equipe</strong>
                <small>Perfil vinculado na mesma conta</small>
              </span>
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
