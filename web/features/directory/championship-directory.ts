import type { DirectoryItem } from './types'

type Row = Record<string, any>

export type ChampionshipDirectoryData = {
  championships: Row[]
  configs: Row[]
  phases: Row[]
  slots: Row[]
  games: Row[]
  producers?: Row[]
}

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim()
}

function first(...values: unknown[]) {
  return values.map((value) => text(value)).find(Boolean) || ''
}

function normalized(value: unknown) {
  return text(value).toLowerCase()
}

function statusLabel(value: unknown) {
  const raw = text(value, 'ativo').replaceAll('_', ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function directoryMoney(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function groupByChampionship(rows: Row[]) {
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const championshipId = String(row.campeonato_id || '')
    if (!championshipId) continue
    const group = groups.get(championshipId)
    if (group) group.push(row)
    else groups.set(championshipId, [row])
  }
  return groups
}

/**
 * Monta a vitrine em tempo linear. A implementação anterior percorria todas as
 * fases, vagas e partidas novamente para cada campeonato.
 */
export function buildChampionshipDirectoryItems(
  data: ChampionshipDirectoryData,
  today = new Date().toISOString().slice(0, 10),
): DirectoryItem[] {
  const configByChampionship = new Map(data.configs.map((row) => [String(row.campeonato_id), row]))
  const phasesByChampionship = groupByChampionship(data.phases)
  const slotsByChampionship = groupByChampionship(data.slots)
  const gamesByChampionship = groupByChampionship(data.games)
  const producerById = new Map((data.producers || []).map((row) => [String(row.id), row]))

  return data.championships.map((row) => {
    const championshipId = String(row.id)
    const config = configByChampionship.get(championshipId) || {}
    const name = first(row.nome, 'Campeonato')
    const tipo = statusLabel(row.tipo || config.formato || 'campeonato')
    const championshipPhases = (phasesByChampionship.get(championshipId) || [])
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
    const entryOrder = championshipPhases.length ? Number(championshipPhases[0].ordem || 0) : null
    const entryPhaseIds = new Set(
      entryOrder == null
        ? []
        : championshipPhases
            .filter((phase) => Number(phase.ordem || 0) === entryOrder)
            .map((phase) => String(phase.id)),
    )
    const entrySlots = (slotsByChampionship.get(championshipId) || []).filter(
      (slot) =>
        normalized(slot.status) !== 'excluido'
        && (entryPhaseIds.size === 0 || !slot.fase_id || entryPhaseIds.has(String(slot.fase_id))),
    )
    const occupiedSlots = entrySlots.filter((slot) => Boolean(slot.equipe_id || slot.line_id)).length
    const officialTotal = Math.max(0, Math.floor(Number(config.numero_vagas || 0)))
    const freeVacancies = officialTotal > 0
      ? Math.max(0, officialTotal - occupiedSlots)
      : entrySlots.length > 0
        ? Math.max(0, entrySlots.length - occupiedSlots)
        : null
    const nextGame = (gamesByChampionship.get(championshipId) || [])
      .filter((game) => normalized(game.status || 'ativo') === 'ativo' && String(game.data_jogo || '') >= today)
      .sort((a, b) => `${a.data_jogo || '9999'} ${a.horario || ''}`.localeCompare(`${b.data_jogo || '9999'} ${b.horario || ''}`))[0]
    const producer = producerById.get(String(row.produtora_id || '')) || {}

    return {
      id: championshipId,
      kind: 'campeonatos',
      name,
      image: first(row.logo_url),
      banner: first(row.banner_url),
      producerId: first(row.produtora_id),
      producerName: first(producer.nome, producer.username),
      producerImage: first(producer.logo_url),
      eyebrow: tipo,
      description: first(config.formato, `${tipo} competitivo`),
      commercial: {
        valor_inscricao: config.valor_inscricao != null ? Number(config.valor_inscricao) : null,
        premiacao: config.premiacao != null ? Number(config.premiacao) : null,
        tem_live: Boolean(config.tem_live),
        vagas_livres: freeVacancies,
        total_vagas: officialTotal || (entrySlots.length || null),
        plataforma: config.plataforma || null,
        servidor: config.servidor || null,
        data_jogo: nextGame?.data_jogo || config.data_jogo || null,
        data_limite_inscricao: config.data_limite_inscricao || null,
      },
      meta: [
        { label: 'Inscrição', value: directoryMoney(config.valor_inscricao) },
        { label: 'Premiação', value: directoryMoney(config.premiacao) },
        { label: 'Vagas livres', value: freeVacancies == null ? '-' : String(freeVacancies) },
      ],
      searchText: [name, tipo, config.formato, config.plataforma, config.servidor, producer.nome, producer.username].join(' ').toLowerCase(),
    }
  })
}
