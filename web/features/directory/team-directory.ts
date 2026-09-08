import type { DirectoryItem } from './types'

type Row = Record<string, any>

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim()
}

function first(...values: unknown[]) {
  return values.map((value) => text(value)).find(Boolean) || ''
}

function statusLabel(value: unknown) {
  const raw = text(value, 'ativo').replaceAll('_', ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function location(row: Row) {
  return first(row.localidade, [row.cidade, row.estado, row.pais].filter(Boolean).join(' · '))
}

function countByTeam(rows: Row[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const teamId = String(row.equipe_id || '')
    if (teamId) counts.set(teamId, (counts.get(teamId) || 0) + 1)
  }
  return counts
}

function lineNamesByTeam(lines: Row[]) {
  const names = new Map<string, string[]>()
  for (const line of lines) {
    const teamId = String(line.equipe_id || '')
    if (!teamId) continue
    const current = names.get(teamId) || []
    current.push(text(line.nome))
    names.set(teamId, current)
  }
  return names
}

export function buildTeamDirectoryItems({
  teams,
  lines,
  participations,
}: {
  teams: Row[]
  lines: Row[]
  participations: Row[]
}): DirectoryItem[] {
  const lineCounts = countByTeam(lines)
  const championshipCounts = countByTeam(participations)
  const lineNames = lineNamesByTeam(lines)

  return teams.map((row) => {
    const id = String(row.id)
    const name = first(row.nome, 'Equipe')
    return {
      id,
      kind: 'equipes',
      name,
      username: text(row.username),
      image: first(row.logo_url),
      eyebrow: first(row.tag, 'Equipe'),
      description: first(row.bio, location(row), 'Equipe competitiva cadastrada na DropZone.'),
      meta: [
        { label: 'Lines', value: String(lineCounts.get(id) || 0) },
        { label: 'Campeonatos', value: String(championshipCounts.get(id) || 0) },
        { label: 'Status', value: statusLabel(row.status) },
      ],
      searchText: [name, row.tag, row.username, location(row), ...(lineNames.get(id) || [])].join(' ').toLowerCase(),
    }
  })
}
