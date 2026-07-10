'use client'

import { Gamepad2 } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { PlayerRegistrationForm } from '@/components/dropzone/forms/PlayerRegistrationForm'
import { Field } from '../../components/form-fields'

export function JogadorPanel(props: {
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
        <PlayerRegistrationForm player={props.player} setPlayer={props.setPlayer} uploadPublicFile={props.uploadPublicFile} />
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
