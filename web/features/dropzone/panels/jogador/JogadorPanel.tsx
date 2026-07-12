'use client'

import { BarChart3, Gamepad2, Shield, Swords, Users } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { dataText, rowTitle } from '../../utils'

export function JogadorPanel(props: { account: DropZoneRow; registrations: DropZoneRow[]; playerTeams: DropZoneRow[]; teams: DropZoneRow[]; teamLines: DropZoneRow[] }) {
  const memberships = props.playerTeams.filter((row) => row.created_by === props.account.auth_user_id || String(row.data?.jogador_id || '') === props.account.id)
  const teamIds = new Set(memberships.map((row) => String(row.ref_id || row.data?.team_id || '')))
  const myTeams = props.teams.filter((team) => teamIds.has(team.id))
  const myLines = props.teamLines.filter((line) => teamIds.has(String(line.ref_id || line.data?.team_id || '')))
  return <div className="dashboard player-dashboard">
    <section className="panel span-3"><div className="section-head"><div><p className="eyebrow">Jogador</p><h2>Meu painel</h2></div><Gamepad2 /></div><div className="player-summary-grid"><div><Shield size={18}/><strong>{myTeams.length}</strong><span>Equipes</span></div><div><Users size={18}/><strong>{myLines.length}</strong><span>Lines</span></div><div><Swords size={18}/><strong>{props.registrations.length}</strong><span>Campeonatos</span></div><div><BarChart3 size={18}/><strong>0</strong><span>Partidas pontuadas</span></div></div></section>
    <section className="panel span-2"><h2>Campeonatos inscritos</h2><div className="cards">{props.registrations.length === 0 ? <p className="empty">Você ainda não está inscrito em campeonato.</p> : null}{props.registrations.map((row) => <div className="card" key={row.id}><p>{String(row.data?.team_tag || 'Equipe')}</p><strong>{String(row.data?.championship_name || 'Campeonato')}</strong><span>{String(row.data?.team_name || '')}</span></div>)}</div></section>
    <section className="panel"><h2>Minha equipe</h2>{myTeams.length === 0 ? <p className="empty">Você ainda não faz parte de uma equipe.</p> : null}<div className="team-line-grid">{myTeams.map((team) => <article className="team-line-card" key={team.id}><img src={dataText(team, 'logo_url') || '/favicon.ico'} alt=""/><div><strong>{rowTitle(team)}</strong><span>{dataText(team, 'tag') || 'Sem tag'}</span></div></article>)}</div></section>
    <section className="panel"><h2>Minhas lines</h2>{myLines.length === 0 ? <p className="empty">Nenhuma line vinculada ao seu elenco.</p> : null}<div className="team-line-grid">{myLines.map((line) => <article className="team-line-card" key={line.id}><img src={dataText(line, 'logo_url') || '/favicon.ico'} alt=""/><div><strong>{rowTitle(line)}</strong><span>{dataText(line, 'tag') || 'Sem tag'}</span></div></article>)}</div></section>
    <section className="panel span-3"><div className="section-head"><div><p className="eyebrow">Desempenho</p><h2>Estatísticas</h2></div><BarChart3 /></div><p className="empty">As estatísticas aparecerão após partidas pontuadas com este ID de jogo.</p></section>
  </div>
}
