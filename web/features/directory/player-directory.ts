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

export function buildPlayerDirectoryItems({
  players,
  registrations,
}: {
  players: Row[]
  registrations: Row[]
}): DirectoryItem[] {
  const championshipCounts = new Map<string, number>()
  for (const registration of registrations) {
    if (String(registration.status || '') === 'deletado') continue
    const playerId = String(registration.jogador_id || '')
    if (playerId) championshipCounts.set(playerId, (championshipCounts.get(playerId) || 0) + 1)
  }

  return players.map((row) => {
    const id = String(row.id)
    const name = first(row.nick, row.nome, row.username, 'Jogador')
    return {
      id,
      kind: 'jogadores',
      name,
      username: text(row.username),
      image: first(row.avatar_url, row.foto_url),
      eyebrow: first(row.funcao, 'Jogador'),
      description: first(location(row), row.bio, 'Perfil competitivo cadastrado na DropZone.'),
      meta: [
        { label: 'Função', value: first(row.funcao, 'Jogador') },
        { label: 'Campeonatos', value: String(championshipCounts.get(id) || 0) },
        { label: 'Status', value: statusLabel(row.status) },
      ],
      searchText: [name, row.username, row.id_jogo, row.funcao, location(row)].join(' ').toLowerCase(),
    }
  })
}
