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

export function buildProducerDirectoryItems({
  producers,
  championships,
}: {
  producers: Row[]
  championships: Row[]
}): DirectoryItem[] {
  return producers.map((row) => {
    const id = String(row.id)
    const producedIds = new Set(
      championships
        .filter((championship) => championship.criado_por === row.auth_user_id || championship.produtora_id === row.id)
        .map((championship) => String(championship.id)),
    )
    const name = first(row.nome, row.username, 'Produtora')
    const bio = text(row.bio)
    return {
      id,
      kind: 'produtoras',
      name,
      username: text(row.username),
      image: first(row.logo_url),
      eyebrow: 'Produtora',
      description: first(bio, location(row), 'Produtora de eventos competitivos.'),
      meta: [
        { label: 'Campeonatos', value: String(producedIds.size) },
        { label: 'Localidade', value: first(location(row), 'Não informada') },
        { label: 'Status', value: statusLabel(row.status) },
      ],
      searchText: [name, row.username, bio, location(row)].join(' ').toLowerCase(),
    }
  })
}
