'use client'

import { useState } from 'react'
import { Copy, Shield } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { Field } from '../../components/form-fields'
import { dataText, rowTitle, tokenText } from '../../utils'

const PLAYER_INVITE_TYPES = new Set(['convite_jogador_campeonato', 'convite_jogador_equipe', 'player_invite'])

export function EquipePanel(props: {
  accountType: string | null
  teams: DropZoneRow[]
  managedTeams: DropZoneRow[]
  managedChampionships: DropZoneRow[]
  managedLinks: DropZoneRow[]
  tokens: DropZoneRow[]
  registrations: DropZoneRow[]
  playerTeams: DropZoneRow[]
  teamLines: DropZoneRow[]
  lineupRules: DropZoneRow[]
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
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [tab, setTab] = useState<'campeonatos' | 'lines' | 'jogadores' | 'convites' | 'config'>('campeonatos')
  const playerInvites = props.tokens.filter((row) => PLAYER_INVITE_TYPES.has(String(row.data?.token_kind || '')) && row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id))
  const teamRegistrations = props.registrations.filter((row) => row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id))

  return (
    <div className="dashboard team-dashboard">
      <section className="panel span-3">
        <div className="section-head">
          <div>
            <p className="eyebrow">{props.accountType === 'manager' ? 'Manager' : 'Equipe'}</p>
            <h2>Painel da equipe</h2>
          </div>
          <Shield />
        </div>
        <div className="tabs panel-tabs">
          <button className={`tab ${tab === 'campeonatos' ? 'active' : ''}`} onClick={() => setTab('campeonatos')}>Campeonatos</button>
          <button className={`tab ${tab === 'lines' ? 'active' : ''}`} onClick={() => setTab('lines')}>Lines</button>
          <button className={`tab ${tab === 'jogadores' ? 'active' : ''}`} onClick={() => setTab('jogadores')}>Jogadores</button>
          <button className={`tab ${tab === 'convites' ? 'active' : ''}`} onClick={() => setTab('convites')}>Convites</button>
          <button className={`tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>Configurações</button>
        </div>

        {tab === 'campeonatos' ? (
          <div className="panel-tab-body">
            <div className="panel-soft">
              <h3>Meus campeonatos</h3>
              {props.managedChampionships.length === 0 ? <p className="empty">Essa equipe ainda não está inscrita em campeonato.</p> : null}
              <div className="list">
                {props.managedChampionships.map((champ) => {
                  const link = props.managedLinks.find((item) => item.parent_id === champ.id)
                  const regs = teamRegistrations.filter((reg) => reg.parent_id === champ.id && reg.ref_id === link?.ref_id)
                  const rule = props.lineupRules.find((item) => item.parent_id === champ.id && (!item.data?.group_id || item.data?.group_id === link?.data?.grupo_id))
                  const vagas = Number(rule?.data?.vagas_por_equipe || 6)
                  return (
                    <div key={champ.id} className="list-item team-champ-card">
                      <strong>{rowTitle(champ)}</strong>
                      <span>Grupo: {dataText(link, 'grupo_nome') || link?.data?.grupo_id || 'sem grupo'} · Slot: {dataText(link, 'slot') || '-'}</span>
                      <small>Escalação: {regs.length}/{vagas} jogadores {rule?.data?.encerra_em ? `· encerra ${new Date(rule.data.encerra_em).toLocaleString('pt-BR')}` : ''}</small>
                      <div className="button-row">
                        <button className="button secondary" onClick={() => { props.setTeamPlayerChampId(champ.id); props.setTeamPlayerTeamId(String(link?.ref_id || '')); setTab('convites') }}>Gerar token</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="panel-soft">
              <h3>Entrar em novo campeonato</h3>
              <Field label="Token enviado pela produtora">
                <input value={props.teamPanelToken} onChange={(e) => props.setTeamPanelToken(e.target.value.toUpperCase())} placeholder="EQ-..." />
              </Field>
              <button className="button" onClick={props.acceptTeamInvite}>Aceitar convite</button>
            </div>
          </div>
        ) : null}


        {tab === 'lines' ? (
          <div className="panel-tab-body">
            <div className="panel-soft">
              <h3>Lines da equipe</h3>
              {props.teamLines.filter((line) => line.ref_id && props.managedTeams.some((team) => team.id === line.ref_id)).length === 0 ? <p className="empty">Nenhuma line cadastrada para esta equipe.</p> : null}
              <div className="list">
                {props.teamLines.filter((line) => line.ref_id && props.managedTeams.some((team) => team.id === line.ref_id)).map((line) => (
                  <div key={line.id} className="list-item">
                    <strong>{rowTitle(line)}</strong>
                    <span>{dataText(line, 'tag') || 'sem tag'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'jogadores' ? (
          <div className="panel-tab-body">
            <div className="panel-soft">
              <h3>Jogadores da equipe</h3>
              {props.playerTeams.length === 0 ? <p className="empty">Nenhum jogador vinculado ao elenco da equipe.</p> : null}
              <div className="list">
                {props.playerTeams.filter((row) => row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id)).map((row) => (
                  <div key={row.id} className="list-item">
                    <strong>{dataText(row, 'nick') || rowTitle(row)}</strong>
                    <span>{dataText(row, 'id_jogo') || 'sem ID'} · {dataText(row, 'funcao') || 'função não informada'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-soft">
              <h3>Jogadores escalados em campeonatos</h3>
              {teamRegistrations.length === 0 ? <p className="empty">Nenhum jogador escalado ainda.</p> : null}
              {teamRegistrations.map((row) => (
                <div key={row.id} className="compact-row"><strong>{dataText(row, 'nick')}</strong><span>{dataText(row, 'id_jogo')} · {dataText(row, 'funcao')}</span></div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'convites' ? (
          <div className="panel-tab-body">
            <div className="panel-soft">
              <h3>Gerar token para jogador no campeonato</h3>
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
            </div>
            <div className="panel-soft">
              <h3>Link para adicionar jogador à equipe</h3>
              <p className="empty">Use token de jogador sem campeonato para elenco fixo na próxima etapa do fluxo.</p>
            </div>
          </div>
        ) : null}

        {tab === 'config' ? (
          <div className="panel-tab-body">
            <div className="panel-soft">
              <h3>Dados da equipe</h3>
              {props.managedTeams.map((team) => (
                <div className="compact-row" key={team.id}><strong>{rowTitle(team)}</strong><span>{dataText(team, 'tag') || 'sem tag'}</span></div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
