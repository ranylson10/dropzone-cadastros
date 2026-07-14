const LINK_META_PREFIX = '__dz_meta__:'

export type LinkMetadata = {
  expected_teams: string[]
}

export function normalizeExpectedTeams(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((name) => String(name || '').trim()).filter(Boolean)
}

export function parseLinkMetadata(row: { metadata?: unknown; descricao?: string | null }) {
  if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
    const meta = row.metadata as Record<string, unknown>
    if (Array.isArray(meta.expected_teams)) {
      return { expected_teams: normalizeExpectedTeams(meta.expected_teams) }
    }
  }

  const descricao = String(row.descricao || '')
  const markerIndex = descricao.indexOf(LINK_META_PREFIX)
  if (markerIndex >= 0) {
    try {
      const parsed = JSON.parse(descricao.slice(markerIndex + LINK_META_PREFIX.length))
      if (Array.isArray(parsed?.expected_teams)) {
        return { expected_teams: normalizeExpectedTeams(parsed.expected_teams) }
      }
    } catch {
      // ignore malformed payload
    }
  }

  try {
    const parsed = JSON.parse(descricao)
    if (Array.isArray(parsed?.expected_teams)) {
      return { expected_teams: normalizeExpectedTeams(parsed.expected_teams) }
    }
  } catch {
    // descricao is plain text
  }

  return { expected_teams: [] as string[] }
}

export function encodeLinkDescricao(expectedTeams: string[], humanDesc?: string | null) {
  const payload = JSON.stringify({ expected_teams: normalizeExpectedTeams(expectedTeams) })
  const cleanDesc = String(humanDesc || '').trim()
  if (cleanDesc) return `${cleanDesc}\n${LINK_META_PREFIX}${payload}`
  return `${LINK_META_PREFIX}${payload}`
}

export function registrationLinkData(row: any) {
  const metadata = parseLinkMetadata(row)
  return {
    championship_id: row.campeonato_id,
    fase_id: row.fase_id,
    group_id: row.grupo_id,
    tipo: row.tipo,
    titulo: row.titulo,
    descricao: row.descricao,
    metadata,
    expected_teams: metadata.expected_teams,
    ativo: row.ativo,
    acompanhamento_publico: row.acompanhamento_publico,
    expira_em: row.expira_em,
    public_url: row.tipo === 'inscricao_equipes_grupo' ? `/convite/grupo/${row.token}` : `/i/${row.token}`,
  }
}

export function isMissingMetadataColumn(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === 'PGRST204'
    || error?.code === '42703'
    || message.includes("'metadata'")
    || message.includes('metadata column')
    || message.includes('schema cache')
}
