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

export function buildManagerDirectoryItems({
  managers,
  links,
}: {
  managers: Row[]
  links: Row[]
}): DirectoryItem[] {
  const linkCounts = new Map<string, number>()
  for (const link of links) {
    const managerId = String(link.manager_id || '')
    if (managerId) linkCounts.set(managerId, (linkCounts.get(managerId) || 0) + 1)
  }

  return managers.map((row) => {
    const id = String(row.id)
    const name = first(row.nome, row.username, 'Manager')
    return {
      id,
      kind: 'managers',
      name,
      username: text(row.username),
      image: first(row.avatar_url, row.foto_url),
      eyebrow: 'Manager',
      description: first(location(row), row.bio, 'Gestor de perfis competitivos.'),
      meta: [
        { label: 'Vínculos', value: String(linkCounts.get(id) || 0) },
        { label: 'Localidade', value: first(location(row), 'Não informada') },
        { label: 'Status', value: statusLabel(row.status) },
      ],
      searchText: [name, row.username, location(row)].join(' ').toLowerCase(),
    }
  })
}
