'use client'

import { ShieldCheck, Swords, Users } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { dataText, rowTitle } from '../../utils'

export function ManagerPanel({ championships, teams, players }: { championships: DropZoneRow[]; teams: DropZoneRow[]; players: DropZoneRow[] }) {
  return <div className="dashboard manager-dashboard">
    <section className="panel span-3"><div className="section-head"><div><p className="eyebrow">Manager</p><h2>Contas sob minha administração</h2></div><ShieldCheck /></div><div className="player-summary-grid"><div><Swords size={18}/><strong>{championships.length}</strong><span>Campeonatos</span></div><div><ShieldCheck size={18}/><strong>{teams.length}</strong><span>Equipes</span></div><div><Users size={18}/><strong>{players.length}</strong><span>Jogadores</span></div></div></section>
    <section className="panel"><h2>Campeonatos</h2>{championships.length === 0 ? <p className="empty">Nenhum campeonato liberado para este manager.</p> : null}{championships.map((row) => <div className="compact-row" key={row.id}><strong>{rowTitle(row)}</strong><span>{dataText(row, 'tipo') || 'Campeonato'}</span></div>)}</section>
    <section className="panel"><h2>Equipes</h2>{teams.length === 0 ? <p className="empty">Nenhuma equipe vinculada.</p> : null}{teams.map((row) => <div className="compact-row" key={row.id}><strong>{rowTitle(row)}</strong><span>{dataText(row, 'tag') || 'Equipe'}</span></div>)}</section>
    <section className="panel"><h2>Jogadores</h2>{players.length === 0 ? <p className="empty">Nenhum jogador vinculado.</p> : null}{players.map((row) => <div className="compact-row" key={row.id}><strong>{dataText(row, 'nick') || rowTitle(row)}</strong><span>ID {dataText(row, 'id_jogo') || '-'}</span></div>)}</section>
  </div>
}
