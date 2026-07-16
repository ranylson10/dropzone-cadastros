const LINK_META_PREFIX = '__dz_meta__:'

export type LinkEntrada = {
  participacao_id: string
  equipe_id: string | null
  equipe_nome: string | null
  line_id: string | null
  line_nome: string | null
  slot_id: string | null
  slot_letra: string | null
  slot_numero: number | null
  /** Nome da lista de referência do admin (ex.: TEAM SIX). */
  referencia_lista?: string | null
  entrou_em: string
}

export type LinkMetadata = {
  /** Quantas equipes este link aceita (1..slots do grupo). */
  limite_vagas: number | null
  /** Inscrições já consumidas neste link. */
  usos: number
  /** Quem entrou por este link. */
  entradas: LinkEntrada[]
  /** Legado: lista de nomes esperados (links antigos). */
  expected_teams: string[]
  closed_reason?: string
  closed_at?: string
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const int = Math.floor(n)
  if (int < 1) return null
  return int
}

export function normalizeExpectedTeams(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((name) => String(name || '').trim()).filter(Boolean)
}

function normalizeEntradas(value: unknown): LinkEntrada[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const item = raw as Record<string, unknown>
      const participacaoId = String(item.participacao_id || '').trim()
      if (!participacaoId) return null
      return {
        participacao_id: participacaoId,
        equipe_id: item.equipe_id ? String(item.equipe_id) : null,
        equipe_nome: item.equipe_nome ? String(item.equipe_nome) : null,
        line_id: item.line_id ? String(item.line_id) : null,
        line_nome: item.line_nome ? String(item.line_nome) : null,
        slot_id: item.slot_id ? String(item.slot_id) : null,
        slot_letra: item.slot_letra ? String(item.slot_letra) : null,
        slot_numero: item.slot_numero != null && Number.isFinite(Number(item.slot_numero))
          ? Number(item.slot_numero)
          : null,
        referencia_lista: item.referencia_lista ? String(item.referencia_lista) : null,
        entrou_em: item.entrou_em ? String(item.entrou_em) : new Date().toISOString(),
      } satisfies LinkEntrada
    })
    .filter(Boolean) as LinkEntrada[]
}

/** Lista de controle: cada nome da reserva + se já se inscreveu. */
export function buildVagasControle(meta: LinkMetadata) {
  const claimed = new Map<string, LinkEntrada>()
  for (const entrada of meta.entradas) {
    const key = String(entrada.referencia_lista || entrada.equipe_nome || entrada.line_nome || '')
      .trim()
      .toLowerCase()
    if (key && !claimed.has(key)) claimed.set(key, entrada)
  }

  const fromList = meta.expected_teams.map((nome, index) => {
    const match = claimed.get(nome.trim().toLowerCase()) || null
    return {
      ordem: index + 1,
      referencia: nome,
      status: match ? ('inscrita' as const) : ('pendente' as const),
      entrada: match,
    }
  })

  // Entradas sem match na lista (links antigos / sem referência)
  const listed = new Set(meta.expected_teams.map((n) => n.trim().toLowerCase()))
  const extras = meta.entradas
    .filter((e) => {
      const key = String(e.referencia_lista || e.equipe_nome || e.line_nome || '').trim().toLowerCase()
      return !key || !listed.has(key)
    })
    .map((entrada, index) => ({
      ordem: meta.expected_teams.length + index + 1,
      referencia: entrada.referencia_lista || entrada.equipe_nome || entrada.line_nome || 'Sem referência',
      status: 'inscrita' as const,
      entrada,
    }))

  return [...fromList, ...extras]
}

export function buildGroupInviteShareMessage(params: {
  campeonatoNome: string
  grupoNome: string
  limiteVagas: number
  expectedTeams: string[]
  publicUrl: string
  expiraEm?: string | null
}) {
  const lista = params.expectedTeams.length
    ? params.expectedTeams.map((nome, i) => `${i + 1}. ${nome}`).join('\n')
    : `(${params.limiteVagas} vaga${params.limiteVagas === 1 ? '' : 's'} neste link)`

  const validade = params.expiraEm
    ? `\nValidade: ${new Date(params.expiraEm).toLocaleString('pt-BR')}`
    : ''

  return `🏆 DropZone — Convite de inscrição

Campeonato: ${params.campeonatoNome}
Grupo: ${params.grupoNome}
Vagas neste link: ${params.limiteVagas}${validade}

Vagas de referência (use a que o organizador combinou com você):
${lista}

Como se inscrever (passo a passo):
1) Abra o link abaixo no celular ou PC
2) Entre com sua conta (Google, Facebook, Discord ou e-mail)
3) Use ou crie um perfil de EQUIPE
4) Confirme a equipe e escolha a vaga de referência da lista
5) Escolha o SLOT (letra) e a LINE que vai jogar
6) Confirme — pronto! Você entra no acompanhamento do grupo

⚠️ Cada vaga de referência só pode ser usada uma vez.
⚠️ A line é quem joga e pontua no campeonato.

Acesse:
${params.publicUrl}`
}

function emptyMeta(): LinkMetadata {
  return { limite_vagas: null, usos: 0, entradas: [], expected_teams: [] }
}

function fromObject(raw: Record<string, unknown>): LinkMetadata {
  const expected = normalizeExpectedTeams(raw.expected_teams)
  const entradas = normalizeEntradas(raw.entradas)
  const limiteFromField = asPositiveInt(raw.limite_vagas)
  // Legado: se só havia lista de nomes, o tamanho da lista era o "limite"
  const limite = limiteFromField ?? (expected.length > 0 ? expected.length : null)
  // usos: preferir campo; se ausente, usar tamanho das entradas
  const usosField = raw.usos != null ? Math.max(0, Number(raw.usos) || 0) : null
  const usos = usosField != null ? usosField : entradas.length
  return {
    limite_vagas: limite,
    usos: Math.max(usos, entradas.length),
    entradas,
    expected_teams: expected,
    closed_reason: raw.closed_reason ? String(raw.closed_reason) : undefined,
    closed_at: raw.closed_at ? String(raw.closed_at) : undefined,
  }
}

export function parseLinkMetadata(row: { metadata?: unknown; descricao?: string | null }): LinkMetadata {
  if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
    return fromObject(row.metadata as Record<string, unknown>)
  }

  const descricao = String(row.descricao || '')
  const markerIndex = descricao.indexOf(LINK_META_PREFIX)
  if (markerIndex >= 0) {
    try {
      const parsed = JSON.parse(descricao.slice(markerIndex + LINK_META_PREFIX.length))
      if (parsed && typeof parsed === 'object') return fromObject(parsed as Record<string, unknown>)
    } catch {
      // ignore malformed payload
    }
  }

  try {
    const parsed = JSON.parse(descricao)
    if (parsed && typeof parsed === 'object') return fromObject(parsed as Record<string, unknown>)
  } catch {
    // descricao is plain text
  }

  return emptyMeta()
}

/** Resolve limite efetivo: metadata → legado expected_teams → slots do grupo. */
export function resolveLinkLimiteVagas(
  meta: LinkMetadata,
  groupSlots?: number | null,
): number {
  const slots = Math.max(1, Number(groupSlots || 0) || 1)
  if (meta.limite_vagas != null) return Math.min(meta.limite_vagas, slots)
  if (meta.expected_teams.length > 0) return Math.min(meta.expected_teams.length, slots)
  return slots
}

export function linkRestantes(meta: LinkMetadata, groupSlots?: number | null) {
  const limite = resolveLinkLimiteVagas(meta, groupSlots)
  return Math.max(0, limite - Math.max(0, meta.usos || 0))
}

export function encodeLinkDescricao(
  payload: {
    limite_vagas?: number | null
    usos?: number
    expected_teams?: string[]
    entradas?: LinkEntrada[]
    closed_reason?: string
    closed_at?: string
  },
  humanDesc?: string | null,
) {
  const body = JSON.stringify({
    limite_vagas: payload.limite_vagas ?? null,
    usos: Math.max(0, Number(payload.usos || 0)),
    expected_teams: normalizeExpectedTeams(payload.expected_teams),
    entradas: normalizeEntradas(payload.entradas),
    ...(payload.closed_reason ? { closed_reason: payload.closed_reason } : {}),
    ...(payload.closed_at ? { closed_at: payload.closed_at } : {}),
  })
  const cleanDesc = String(humanDesc || '').trim()
  if (cleanDesc) return `${cleanDesc}\n${LINK_META_PREFIX}${body}`
  return `${LINK_META_PREFIX}${body}`
}

/** Parte humana de descricao, sem o bloco __dz_meta__. */
export function extractHumanDescricao(descricao?: string | null) {
  const text = String(descricao || '')
  const markerIndex = text.indexOf(LINK_META_PREFIX)
  if (markerIndex >= 0) return text.slice(0, markerIndex).trim()
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && (
      'limite_vagas' in parsed
      || 'expected_teams' in parsed
      || 'usos' in parsed
      || 'entradas' in parsed
    )) {
      return ''
    }
  } catch {
    // plain text
  }
  return text.trim()
}

export function buildLinkMetaPayload(meta: LinkMetadata, extra: Record<string, unknown> = {}) {
  return {
    limite_vagas: meta.limite_vagas,
    usos: meta.usos,
    expected_teams: meta.expected_teams,
    entradas: meta.entradas,
    ...(meta.closed_reason ? { closed_reason: meta.closed_reason } : {}),
    ...(meta.closed_at ? { closed_at: meta.closed_at } : {}),
    ...extra,
  }
}

/** Select com metadata; se a coluna não existir no banco, tenta sem ela. */
export const CAMPEONATO_LINK_SELECT_FULL =
  'id,token,titulo,tipo,ativo,expira_em,campeonato_id,grupo_id,fase_id,metadata,descricao,created_at,updated_at'

export const CAMPEONATO_LINK_SELECT_NO_META =
  'id,token,titulo,tipo,ativo,expira_em,campeonato_id,grupo_id,fase_id,descricao,created_at,updated_at'

export type LinkStatusUi = 'ativo' | 'esgotado' | 'expirado' | 'pausado' | 'grupo_cheio'

export function resolveLinkStatus(row: {
  ativo?: boolean
  expira_em?: string | null
  metadata?: unknown
  descricao?: string | null
}, groupSlots?: number | null): LinkStatusUi {
  const meta = parseLinkMetadata(row)
  const limite = resolveLinkLimiteVagas(meta, groupSlots)
  const now = Date.now()
  if (row.expira_em && new Date(row.expira_em).getTime() <= now) return 'expirado'
  if (meta.usos >= limite || meta.closed_reason === 'limite_atingido') return 'esgotado'
  if (meta.closed_reason === 'grupo_cheio') return 'grupo_cheio'
  if (row.ativo === false) return 'pausado'
  return 'ativo'
}

export function registrationLinkData(row: any) {
  const metadata = parseLinkMetadata(row)
  const limite = resolveLinkLimiteVagas(metadata)
  const status = resolveLinkStatus(row)
  const vagas_controle = buildVagasControle(metadata)
  return {
    championship_id: row.campeonato_id,
    fase_id: row.fase_id,
    group_id: row.grupo_id,
    tipo: row.tipo,
    titulo: row.titulo,
    descricao: row.descricao,
    metadata,
    limite_vagas: limite,
    usos: metadata.usos,
    restantes: Math.max(0, limite - metadata.usos),
    entradas: metadata.entradas,
    expected_teams: metadata.expected_teams,
    vagas_controle,
    closed_reason: metadata.closed_reason || null,
    closed_at: metadata.closed_at || null,
    status,
    ativo: row.ativo,
    acompanhamento_publico: row.acompanhamento_publico,
    expira_em: row.expira_em,
    created_at: row.created_at || null,
    public_url: row.tipo === 'inscricao_equipes_grupo' ? `/convite/grupo/${row.token}` : `/i/${row.token}`,
  }
}

export function isMissingMetadataColumn(error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return error?.code === 'PGRST204'
    || error?.code === '42703'
    || message.includes("'metadata'")
    || message.includes('"metadata"')
    || message.includes('metadata does not exist')
    || message.includes('metadata column')
    || message.includes('column campeonato_links.metadata')
    || message.includes('schema cache')
}
