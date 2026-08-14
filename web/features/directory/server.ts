import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'
import { carregarRankingTiers } from '@backend/ranking/tier-ranking.service'
import type { DirectoryItem, DirectoryKind, DirectoryProfile } from './types'

function text(value: unknown, fallback = '') { return String(value ?? fallback).trim() }
function first(...values: unknown[]) { return values.map((value) => text(value)).find(Boolean) || '' }
function statusLabel(value: unknown) {
  const raw = text(value, 'ativo').replaceAll('_', ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
function money(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Sem premiação informada'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}
function directoryMoney(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}
function yesNo(value: unknown) { return value == null ? '-' : value ? 'Sim' : 'Não' }
function dateLabel(value: unknown) {
  const raw = text(value)
  if (!raw) return '-'
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function location(row: any) { return first(row.localidade, [row.cidade, row.estado, row.pais].filter(Boolean).join(' · ')) }

const DIRECTORY_PAGE_SIZE = 1000
const DIRECTORY_MAX_ROWS = 10000

function normalized(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function compactNumber(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

function integer(value: unknown) {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}

async function competitiveProfile(kind: 'equipes' | 'jogadores', id: string) {
  const ranking = await carregarRankingTiers().catch(() => null)
  const isPlayer = kind === 'jogadores'
  let rankRows: any[] = []
  let statsRows: any[] = []

  if (isPlayer) {
    rankRows = (ranking?.players || []).filter((row: any) => String(row.jogador_id) === id)
    const { data, error } = await supabaseAdmin
      .from('garena_matchstats_jogadores')
      .select('importacao_id,abates,dano,assistencias,garena_matchstats_importacoes(partida_id,concluida_em)')
      .eq('jogador_id', id)
      .limit(1000)
    if (!error) statsRows = data || []
  } else {
    const { data: participations, error: participationError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('equipe_id', id)
      .neq('status', 'deletado')
      .limit(1000)
    const participationIds = (participations || []).map((row: any) => String(row.id)).filter(Boolean)
    rankRows = (ranking?.teams || []).filter((row: any) => String(row.equipe_id) === id)
    if (!participationError && participationIds.length) {
      const { data, error } = await supabaseAdmin
        .from('garena_matchstats_jogadores')
        .select('importacao_id,abates,dano,assistencias,garena_matchstats_importacoes(partida_id,concluida_em)')
        .in('campeonato_equipe_id', participationIds)
        .limit(10000)
      if (!error) statsRows = data || []
    }
  }

  const aggregate = (field: string) => rankRows.reduce((total, row) => total + integer(row[field]), 0)
  const principal = rankRows.sort((a, b) => integer(b.score) - integer(a.score))[0] || null
  const byFall = new Map<string, { label: string; date: string; abates: number; dano: number; assistencias: number }>()
  for (const row of statsRows) {
    const imported: any = Array.isArray(row.garena_matchstats_importacoes) ? row.garena_matchstats_importacoes[0] : row.garena_matchstats_importacoes
    const key = String(imported?.partida_id || row.importacao_id)
    const current = byFall.get(key) || { label: `Q${byFall.size + 1}`, date: String(imported?.concluida_em || ''), abates: 0, dano: 0, assistencias: 0 }
    current.abates += integer(row.abates)
    current.dano += integer(row.dano)
    current.assistencias += integer(row.assistencias)
    byFall.set(key, current)
  }
  const trend = [...byFall.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-8).map(({ label, abates, dano, assistencias }) => ({ label, abates, dano, assistencias }))

  if (isPlayer) {
    const row = principal
    return {
      label: 'Perfil gamer · dados oficiais', tier: row?.tier || null, score: row?.score || null,
      metrics: [
        { label: 'Abates', value: String(aggregate('abates')) }, { label: 'Dano total', value: compactNumber(aggregate('dano')) },
        { label: 'Assistências', value: String(aggregate('assistencias')) }, { label: 'Headshots', value: String(aggregate('headshots')) },
        { label: 'Sobrevivência', value: `${compactNumber(aggregate('sobrevivencia_segundos'))} s` }, { label: 'Quedas', value: String(aggregate('quedas')) },
      ],
      highlights: [
        { label: 'Arma mais usada', value: row?.arma_mais_usada || '' },
        { label: 'Habilidade ativa', value: [row?.habilidade_ativa?.personagem, row?.habilidade_ativa?.habilidade].filter(Boolean).join(' · ') },
        { label: 'Passivas', value: (row?.habilidades_passivas || []).map((item: any) => item.habilidade || item.personagem).filter(Boolean).join(' · ') },
        { label: 'Função', value: row?.funcao || '' },
      ], trend,
    }
  }

  return {
    label: 'Elenco · dados oficiais', tier: principal?.tier || null, score: principal?.score || null,
    metrics: [
      { label: 'Pontos', value: String(aggregate('pontos')) }, { label: 'Abates', value: String(aggregate('abates')) },
      { label: 'Dano do elenco', value: compactNumber(aggregate('dano')) }, { label: 'Assistências', value: String(aggregate('assistencias')) },
      { label: 'Booyahs', value: String(aggregate('booyahs')) }, { label: 'Quedas', value: String(aggregate('quedas')) },
    ],
    highlights: [
      { label: 'Headshots', value: String(aggregate('headshots')) }, { label: 'Knockdowns', value: String(aggregate('knockdowns')) },
      { label: 'Paredes de gel', value: String(aggregate('gel_usado')) }, { label: 'Kits médicos', value: String(aggregate('kits_medicos')) },
    ], trend,
  }
}

async function rowsPlain(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select('*')
  if (error) {
    if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }
  return data || []
}

async function rows(table: string) {
  const collected: any[] = []

  for (let from = 0; from < DIRECTORY_MAX_ROWS; from += DIRECTORY_PAGE_SIZE) {
    const to = from + DIRECTORY_PAGE_SIZE - 1
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
      throw error
    }

    const page = data || []
    collected.push(...page)
    if (page.length < DIRECTORY_PAGE_SIZE) break
  }

  return collected.filter((row: any) => {
    const status = normalized(row.status || 'ativo')
    if (['suspenso', 'banido', 'excluido', 'excluído'].includes(status)) return false
    if (row.deleted_at) return false

    // Só no ar se aprovado pelo admin. Normalização evita exclusão por espaços/caixa.
    const approval = normalized(row.aprovacao_status)
    if (approval && approval !== 'aprovado') return false
    return true
  })
}

export async function listDirectory(kind: DirectoryKind): Promise<DirectoryItem[]> {
  if (kind === 'campeonatos') {
    const [items, configs, phases, slots] = await Promise.all([
      rows('campeonatos'),
      rows('campeonato_configuracoes'),
      rows('campeonato_fases'),
      rows('campeonato_slots'),
    ])
    const configByChamp = new Map(configs.map((row: any) => [row.campeonato_id, row]))
    return items.map((row: any) => {
      const config: any = configByChamp.get(row.id) || {}
      const name = first(row.nome, 'Campeonato')
      const tipo = statusLabel(row.tipo || config.formato || 'campeonato')
      const champPhases = phases
        .filter((phase: any) => phase.campeonato_id === row.id)
        .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0))
      const entryOrder = champPhases.length ? Number(champPhases[0].ordem || 0) : null
      const entryPhaseIds = new Set(
        entryOrder == null
          ? []
          : champPhases
              .filter((phase: any) => Number(phase.ordem || 0) === entryOrder)
              .map((phase: any) => String(phase.id)),
      )
      const entrySlots = slots.filter(
        (slot: any) =>
          slot.campeonato_id === row.id
          && normalized(slot.status) !== 'excluido'
          && (entryPhaseIds.size === 0 || !slot.fase_id || entryPhaseIds.has(String(slot.fase_id))),
      )
      const occupiedSlots = entrySlots.filter((slot: any) => Boolean(slot.equipe_id || slot.line_id)).length
      const officialTotal = Math.max(0, Math.floor(Number(config.numero_vagas || 0)))
      const freeVacancies = officialTotal > 0
        ? Math.max(0, officialTotal - occupiedSlots)
        : entrySlots.length > 0
          ? Math.max(0, entrySlots.length - occupiedSlots)
          : null
      return {
        id: row.id, kind, name, image: first(row.logo_url), banner: first(row.banner_url), eyebrow: tipo,
        description: first(config.formato, `${tipo} competitivo`),
        commercial: {
          valor_inscricao: config.valor_inscricao != null ? Number(config.valor_inscricao) : null,
          premiacao: config.premiacao != null ? Number(config.premiacao) : null,
          tem_live: Boolean(config.tem_live),
          vagas_livres: freeVacancies,
          total_vagas: officialTotal || (entrySlots.length || null),
          plataforma: config.plataforma || null,
          servidor: config.servidor || null,
          data_jogo: config.data_jogo || row.data_jogo || row.data_inicio || null,
          data_limite_inscricao: config.data_limite_inscricao || row.data_limite_inscricao || null,
        },
        meta: [
          { label: 'Inscrição', value: directoryMoney(config.valor_inscricao) },
          { label: 'Premiação', value: directoryMoney(config.premiacao) },
          { label: 'Vagas livres', value: freeVacancies == null ? '-' : String(freeVacancies) },
        ],
        searchText: [name, tipo, config.formato, config.plataforma, config.servidor].join(' ').toLowerCase(),
      }
    })
  }

  if (kind === 'equipes') {
    const [items, lines, participations] = await Promise.all([rows('equipes'), rows('equipe_lines'), rows('campeonato_equipes')])
    return items.map((row: any) => {
      const teamLines = lines.filter((line: any) => line.equipe_id === row.id)
      const championships = participations.filter((item: any) => item.equipe_id === row.id)
      const name = first(row.nome, 'Equipe')
      return {
        id: row.id, kind, name, username: text(row.username), image: first(row.logo_url), eyebrow: first(row.tag, 'Equipe'),
        description: first(row.bio, location(row), 'Equipe competitiva cadastrada na DropZone.'),
        meta: [
          { label: 'Lines', value: String(teamLines.length) },
          { label: 'Campeonatos', value: String(championships.length) },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, row.tag, row.username, location(row), ...teamLines.map((line: any) => line.nome)].join(' ').toLowerCase(),
      }
    })
  }

  if (kind === 'jogadores') {
    const [items, registrations] = await Promise.all([rows('jogadores'), rows('campeonato_jogadores')])
    return items.map((row: any) => {
      const playerRegs = registrations.filter((item: any) => item.jogador_id === row.id && item.status !== 'deletado')
      const name = first(row.nick, row.nome, row.username, 'Jogador')
      return {
        id: row.id, kind, name, username: text(row.username), image: first(row.avatar_url, row.foto_url), eyebrow: first(row.funcao, 'Jogador'),
        description: first(location(row), row.bio, 'Perfil competitivo cadastrado na DropZone.'),
        meta: [
          { label: 'Função', value: first(row.funcao, 'Jogador') },
          { label: 'Campeonatos', value: String(playerRegs.length) },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, row.username, row.id_jogo, row.funcao, location(row)].join(' ').toLowerCase(),
      }
    })
  }

  if (kind === 'managers') {
    const [items, teamLinks, producerLinks, playerLinks] = await Promise.all([rows('managers'), rows('manager_equipe'), rows('manager_produtora'), rows('manager_jogador')])
    return items.map((row: any) => {
      const name = first(row.nome, row.username, 'Manager')
      const total = teamLinks.filter((x: any) => x.manager_id === row.id).length + producerLinks.filter((x: any) => x.manager_id === row.id).length + playerLinks.filter((x: any) => x.manager_id === row.id).length
      return {
        id: row.id, kind, name, username: text(row.username), image: first(row.avatar_url, row.foto_url), eyebrow: 'Manager',
        description: first(location(row), row.bio, 'Gestor de perfis competitivos.'),
        meta: [
          { label: 'Vínculos', value: String(total) },
          { label: 'Localidade', value: first(location(row), 'Não informada') },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, row.username, location(row)].join(' ').toLowerCase(),
      }
    })
  }

  const [items, championships] = await Promise.all([rows('produtoras'), rows('campeonatos')])
  return items.map((row: any) => {
    const produced = championships.filter((item: any) => item.criado_por === row.auth_user_id || item.produtora_id === row.id)
    const name = first(row.nome, row.username, 'Produtora')
    const bio = text(row.bio)
    return {
      id: row.id, kind, name, username: text(row.username), image: first(row.logo_url, row.avatar_url), eyebrow: 'Produtora',
      // Bio pública em destaque; localidade só se não houver bio
      description: first(bio, location(row), 'Produtora de eventos competitivos.'),
      meta: [
        { label: 'Campeonatos', value: String(produced.length) },
        { label: 'Localidade', value: first(location(row), 'Não informada') },
        { label: 'Status', value: statusLabel(row.status) },
      ],
      searchText: [name, row.username, bio, location(row)].join(' ').toLowerCase(),
    }
  })
}

export async function getDirectoryProfile(kind: DirectoryKind, id: string): Promise<DirectoryProfile | null> {
  const list = await listDirectory(kind)
  const base = list.find((item) => item.id === id)
  if (!base) return null
  const sections: DirectoryProfile['sections'] = []
  const details = [...base.meta]
  const actions: DirectoryProfile['actions'] = []

  let theme: DirectoryProfile['theme'] = null
  let enrollment: DirectoryProfile['enrollment'] = null
  let statsFilters: DirectoryProfile['statsFilters'] = undefined
  let competitive: DirectoryProfile['competitive'] = null

  if (kind === 'campeonatos') {
    const [championships, phases, groups, slots, games, rounds, participations, teams, teamLines, championshipPlayers, players, temporaryPlayers, teamStats, mvpStats, configs] = await Promise.all([
      rows('campeonatos'),
      rows('campeonato_fases'),
      rows('campeonato_grupos'),
      rows('campeonato_slots'),
      rows('campeonato_jogos'),
      rowsPlain('campeonato_partidas_com_mapa'),
      rows('campeonato_equipes'),
      rows('equipes'),
      rows('equipe_lines'),
      rows('campeonato_jogadores'),
      rows('jogadores'),
      rows('jogadores_temporarios'),
      listarEstatisticasEquipes(id, {}).catch(() => []),
      listarEstatisticasMvp(id, {}).catch(() => []),
      rows('campeonato_configuracoes'),
    ])
    const championship: any = championships.find((row: any) => row.id === id) || {}
    const cfg: any = configs.find((row: any) => row.campeonato_id === id) || {}
    theme = {
      cor_principal: cfg.cor_principal || null,
      cor_secundaria: cfg.cor_secundaria || null,
      bg_opacidade: cfg.bg_opacidade != null ? Number(cfg.bg_opacidade) : null,
      bg_image_url: cfg.bg_image_url || null,
      cor_texto_clara: cfg.cor_texto_clara || null,
      cor_texto_escura: cfg.cor_texto_escura || null,
    }
    const champPhasesForCapacity = phases
      .filter((row: any) => row.campeonato_id === id)
      .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0))
    const entryOrder = champPhasesForCapacity.length ? Number(champPhasesForCapacity[0].ordem || 0) : null
    const entryPhaseIds = new Set(
      entryOrder == null
        ? []
        : champPhasesForCapacity
            .filter((row: any) => Number(row.ordem || 0) === entryOrder)
            .map((row: any) => String(row.id)),
    )
    const entrySlots = slots.filter(
      (row: any) =>
        row.campeonato_id === id
        && String(row.status || '') !== 'excluido'
        && (entryPhaseIds.size === 0 || !row.fase_id || entryPhaseIds.has(String(row.fase_id))),
    )
    const occupiedSlots = entrySlots.filter((row: any) => Boolean(row.equipe_id || row.line_id)).length
    const officialTotal = Math.max(0, Math.floor(Number(cfg.numero_vagas || 0)))
    const freeSlots = Math.max(0, officialTotal - occupiedSlots)
    enrollment = {
      aceita_novas_inscricoes: Boolean(cfg.aceita_novas_inscricoes_equipes),
      valor_inscricao:
        cfg.valor_inscricao != null && Number(cfg.valor_inscricao) > 0
          ? Number(cfg.valor_inscricao)
          : null,
      contatos_whatsapp: Array.isArray(cfg.contatos_whatsapp) ? cfg.contatos_whatsapp : [],
      vagas_livres: freeSlots,
      proximo_grupo: null,
      pagamento_pix_ativo: cfg.pagamento_pix_ativo !== false,
      pagamento_cartao_ativo: cfg.pagamento_cartao_ativo !== false,
      pagamento_paypal_ativo: cfg.pagamento_paypal_ativo === true,
      pagamento_whatsapp_ativo: cfg.pagamento_whatsapp_ativo !== false,
      cartao_max_parcelas: Math.min(12, Math.max(1, Number.parseInt(String(cfg.cartao_max_parcelas || '1'), 10) || 1)),
      paypal_moedas: Array.isArray(cfg.paypal_moedas) ? cfg.paypal_moedas.map(String) : ['BRL', 'USD', 'EUR'],
    }
    const teamById = new Map(teams.map((row: any) => [row.id, row]))
    const lineById = new Map(teamLines.map((row: any) => [row.id, row]))
    const champPhases = phases
      .filter((row: any) => row.campeonato_id === id)
      .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0))
    const champGroups = groups.filter((row: any) => row.campeonato_id === id)
    const champSlots = slots.filter((row: any) => row.campeonato_id === id)
    const champGames = games.filter((row: any) => row.campeonato_id === id)
    const champRounds = rounds.filter((row: any) => row.campeonato_id === id)
    const champParts = participations.filter((row: any) => row.campeonato_id === id && String(row.status || 'ativo') === 'ativo')
    const champPlayerRows = championshipPlayers.filter((row: any) => row.campeonato_id === id && String(row.status || 'ativo') !== 'deletado')
    const playerById = new Map(players.map((row: any) => [String(row.id), row]))
    const temporaryPlayerById = new Map(temporaryPlayers.map((row: any) => [String(row.id), row]))
    const participationById = new Map(champParts.map((row: any) => [String(row.id), row]))
    const mvpByPlayerId = new Map(mvpStats.map((row: any) => [String(row.campeonato_jogador_id), row]))

    details.length = 0
    details.push(
      { label: 'Tipo', value: first(base.eyebrow, '-') },
      { label: 'Formato', value: first(cfg.formato, '-') },
      { label: 'Inscrição', value: directoryMoney(cfg.valor_inscricao) },
      { label: 'Premiação', value: directoryMoney(cfg.premiacao ?? championship.premiacao) },
      { label: 'Total de vagas', value: officialTotal > 0 ? String(officialTotal) : '-' },
      { label: 'Vagas livres', value: officialTotal > 0 ? String(freeSlots) : '-' },
      { label: 'Jogadores por equipe', value: cfg.jogadores_por_vaga != null ? String(cfg.jogadores_por_vaga) : '-' },
      { label: 'Vagas por equipe', value: cfg.vagas_por_equipe != null ? String(cfg.vagas_por_equipe) : '-' },
      { label: 'Reservas', value: cfg.qtd_reservas != null ? String(cfg.qtd_reservas) : cfg.permite_reservas != null ? yesNo(cfg.permite_reservas) : '-' },
      { label: 'Troca de jogadores', value: yesNo(cfg.permite_troca_jogadores) },
      { label: 'Limite para trocas', value: dateLabel(cfg.data_limite_trocas) },
      { label: 'Inscrições até', value: dateLabel(cfg.data_limite_inscricao) },
      { label: 'Plataforma', value: first(cfg.plataforma, '-') },
      { label: 'Servidor', value: first(cfg.servidor, '-') },
      { label: 'Transmissão', value: yesNo(cfg.tem_live) },
      { label: 'Status', value: statusLabel(championship.status || 'ativo') },
    )

    const gameNameById = new Map(champGames.map((row: any) => [String(row.id), first(row.nome, `Jogo ${row.id}`)]))
    const mapCodes = Array.from(new Set(champRounds.map((row: any) => text(row.mapa_codigo)).filter(Boolean)))
    statsFilters = {
      phases: champPhases.map((row: any) => ({ id: String(row.id), label: first(row.nome, 'Fase') })),
      groups: champGroups.map((row: any) => ({
        id: String(row.id),
        label: first(row.nome, 'Grupo'),
        phaseId: row.fase_id ? String(row.fase_id) : null,
      })),
      games: champGames.map((row: any) => ({ id: String(row.id), label: first(row.nome, 'Jogo') })),
      rounds: champRounds
        .sort((a: any, b: any) => Number(a.numero_partida || 0) - Number(b.numero_partida || 0))
        .map((row: any) => ({
          id: String(row.id),
          label: `${gameNameById.get(String(row.jogo_id)) || 'Jogo'} · Queda ${Number(row.numero_partida || 0) || '-'}`,
          gameId: row.jogo_id ? String(row.jogo_id) : null,
          mapCode: text(row.mapa_codigo) || null,
        })),
      maps: mapCodes.map((code) => ({ id: code, label: code })),
    }

    // Ações antigas removidas do banner — navegação via ChampionshipPublicView
    actions.length = 0
    sections.push({
      title: 'Jogadores participantes',
      layout: 'list',
      items: champPlayerRows.map((row: any) => {
        const registered = row.jogador_id ? playerById.get(String(row.jogador_id)) : null
        const temporaryId = row.jogador_temporario_id || row.temporario_id || row.jogador_temp_id
        const temporary = temporaryId ? temporaryPlayerById.get(String(temporaryId)) : null
        const participation: any = participationById.get(String(row.campeonato_equipe_id || ''))
        const team: any = participation?.equipe_id ? teamById.get(participation.equipe_id) : null
        const line: any = participation?.line_id ? lineById.get(participation.line_id) : null
        const performance: any = mvpByPlayerId.get(String(row.id))
        return {
          id: String(row.id),
          title: first(row.nick, registered?.nick, registered?.nome, temporary?.nick, 'Jogador'),
          subtitle: first(line?.nome, team?.nome, 'Equipe não informada'),
          image: first(row.foto_url, registered?.avatar_url, registered?.foto_url, temporary?.foto_url),
          stats: {
            campeonato_equipe_id: row.campeonato_equipe_id || null,
            partidas: Number(performance?.quedas || 0),
            equipe_nome: first(line?.nome, team?.nome, 'Equipe não informada'),
          },
        }
      }),
    })
    sections.push({
      title: 'Tabela',
      layout: 'stats',
      items: teamStats.slice(0, 100).map((row: any) => ({
        id: row.campeonato_equipe_id,
        title: row.nome,
        subtitle: row.tag || undefined,
        image: first(row.logo_url),
        stats: {
          colocacao: Number(row.colocacao || 0),
          grupo_id: row.grupo_id || null,
          quedas: Number(row.quedas || 0),
          booyahs: Number(row.booyahs || 0),
          abates: Number(row.abates || 0),
          pontos_posicao: Number(row.pontos_posicao || 0),
          pontos_abates: Number(row.pontos_abates || 0),
          pontos_total: Number(row.pontos_total || 0),
        },
      })),
    })
    sections.push({
      title: 'MVP',
      layout: 'stats',
      items: mvpStats.slice(0, 100).map((row: any) => ({
        id: row.campeonato_jogador_id,
        title: row.nick,
        subtitle: row.id_jogo || undefined,
        image: first(row.foto_url),
        stats: {
          colocacao: Number(row.colocacao || 0),
          campeonato_equipe_id: row.campeonato_equipe_id || null,
          quedas: Number(row.quedas || 0),
          abates: Number(row.abates || 0),
          dano: Number(row.dano || 0),
          assistencias: Number(row.assistencias || 0),
          revives: Number(row.revives || 0),
        },
      })),
    })

    // Leitura pública: fases → grupos → slots (sem ações de editar)
    sections.push({
      title: 'Fases e grupos',
      layout: 'structure',
      items: champPhases.map((phase: any) => {
        const phaseGroups = champGroups
          .filter((group: any) => group.fase_id === phase.id)
          .sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        const totalSlots = phaseGroups.reduce((sum: number, group: any) => {
          const groupSlotCount = champSlots.filter((s: any) => s.grupo_id === group.id).length
          return sum + (groupSlotCount || Number(group.slots || 0))
        }, 0)

        return {
          id: phase.id,
          title: phase.nome,
          subtitle: `${phaseGroups.length} grupo(s) · ${totalSlots} slot(s)`,
          children: phaseGroups.map((group: any) => {
            const groupSlots = champSlots
              .filter((s: any) => s.grupo_id === group.id)
              .sort((a: any, b: any) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
            const occupied = groupSlots.filter((s: any) => s.line_id || s.equipe_id).length

            return {
              id: group.id,
              title: group.nome,
              subtitle: `${occupied}/${groupSlots.length || Number(group.slots || 0)} slots preenchidos`,
              children: (groupSlots.length
                ? groupSlots
                : Array.from({ length: Number(group.slots || 0) }, (_, index) => ({
                    id: `${group.id}-ghost-${index + 1}`,
                    slot_numero: index + 1,
                    slot_letra: String.fromCharCode(65 + (index % 26)),
                    line_id: null,
                    equipe_id: null,
                  }))
              ).map((slot: any) => {
                const slotNum = Number(slot.slot_numero || 0)
                const letter = first(
                  slot.slot_letra,
                  slotNum > 0 ? String.fromCharCode(64 + Math.min(slotNum, 26)) : '?',
                )
                const line = slot.line_id ? lineById.get(slot.line_id) : null
                const team = slot.equipe_id ? teamById.get(slot.equipe_id) : null
                const part = champParts.find(
                  (p: any) =>
                    p.slot_id === slot.id
                    || (p.grupo_id === group.id && Number(p.slot_numero) === slotNum && p.line_id === slot.line_id),
                )
                const filled = Boolean(slot.line_id || slot.equipe_id || part)
                // Mesmo padrão da aba Equipes: nome principal = line / "Slot X"
                const lineName = filled
                  ? first(line?.nome, part?.nome_exibicao, part?.line_nome, 'Line inscrita')
                  : `Slot ${letter}`
                const teamName = first(team?.nome, part?.equipe_nome)
                const logo = first(line?.logo_url, team?.logo_url)

                return {
                  id: String(slot.id || `${group.id}-${letter}`),
                  badge: letter,
                  title: lineName,
                  subtitle: filled
                    ? [teamName, group.nome].filter(Boolean).join(' · ') || 'Line no campeonato'
                    : [group.nome].filter(Boolean).join(' · ') || 'Disponível',
                  image: logo || undefined,
                  status: filled ? 'ocupada' : 'livre',
                }
              }),
            }
          }),
        }
      }),
    })
    sections.push({
      title: 'Jogos',
      items: champGames.map((game: any) => ({
        id: game.id,
        title: game.nome,
        subtitle: [game.data_jogo, game.horario ? String(game.horario).slice(0, 5) : '', `${game.numero_partidas || 0} quedas`].filter(Boolean).join(' · ') || 'Data a definir',
        meta: Array.isArray(game.grupos_ids) ? game.grupos_ids.slice(0, 6).map((groupId: string) => ({ label: 'Grupo', value: first(champGroups.find((group: any) => group.id === groupId)?.nome, groupId) })) : [],
      })),
    })
    sections.push({
      title: 'Equipes participantes',
      items: champParts.map((entry: any) => {
        const team: any = teamById.get(entry.equipe_id)
        const line: any = entry.line_id ? lineById.get(entry.line_id) : null
        return {
          id: entry.id,
          title: first(line?.nome, entry.nome_exibicao, team?.nome, 'Line'),
          image: first(line?.logo_url, team?.logo_url),
          href: team ? `/equipes/${team.id}` : undefined,
          subtitle: [
            team?.nome,
            entry.slot_letra || (entry.slot_numero ? `Slot ${entry.slot_numero}` : null),
            entry.origem_entrada ? `via ${entry.origem_entrada}` : null,
          ].filter(Boolean).join(' · ') || 'Participação confirmada',
        }
      }),
    })
  } else if (kind === 'equipes') {
    const [lines, participations, championships] = await Promise.all([rows('equipe_lines'), rows('campeonato_equipes'), rows('campeonatos')])
    const championshipById = new Map(championships.map((row: any) => [row.id, row]))
    sections.push({ title: 'Lines', items: lines.filter((x: any) => x.equipe_id === id).map((line: any) => ({ id: line.id, title: line.nome, subtitle: first(line.tag, statusLabel(line.status)), image: first(line.logo_url) })) })
    competitive = await competitiveProfile('equipes', id)
    sections.push({ title: 'Campeonatos', items: participations.filter((x: any) => x.equipe_id === id).map((entry: any) => { const champ: any = championshipById.get(entry.campeonato_id); return { id: entry.id, title: first(champ?.nome, 'Campeonato'), subtitle: entry.slot_numero ? `Slot ${entry.slot_numero}` : statusLabel(entry.status), image: first(champ?.logo_url), href: champ ? `/campeonatos/${champ.id}` : undefined } }) })
  } else if (kind === 'jogadores') {
    const [regs, championships, teams] = await Promise.all([rows('campeonato_jogadores'), rows('campeonatos'), rows('equipes')])
    const champById = new Map(championships.map((row: any) => [row.id, row]))
    const teamById = new Map(teams.map((row: any) => [row.id, row]))
    competitive = await competitiveProfile('jogadores', id)
    sections.push({ title: 'Participações', items: regs.filter((x: any) => x.jogador_id === id && x.status !== 'deletado').map((reg: any) => { const champ: any = champById.get(reg.campeonato_id); const team: any = teamById.get(reg.equipe_id); return { id: reg.id, title: first(champ?.nome, 'Campeonato'), subtitle: [team?.nome, reg.funcao].filter(Boolean).join(' · '), image: first(champ?.logo_url), href: champ ? `/campeonatos/${champ.id}` : undefined } }) })
  } else if (kind === 'produtoras') {
    const items = await rows('campeonatos')
    const producerRow = (await rows('produtoras')).find((row: any) => row.id === id)
    const producerBio = text(producerRow?.bio)
    // Bio já aparece no banner (description); nos detalhes só se for diferente da localidade
    if (producerBio) {
      details.unshift({ label: 'Sobre', value: producerBio })
    }
    sections.push({ title: 'Campeonatos produzidos', items: items.filter((x: any) => x.produtora_id === id || x.criado_por === producerRow?.auth_user_id).map((champ: any) => ({ id: champ.id, title: champ.nome, subtitle: statusLabel(champ.status), image: first(champ.logo_url), href: `/campeonatos/${champ.id}` })) })
  } else {
    const [teamLinks, producerLinks, playerLinks, teams, producers, players] = await Promise.all([rows('manager_equipe'), rows('manager_produtora'), rows('manager_jogador'), rows('equipes'), rows('produtoras'), rows('jogadores')])
    const mapItems = (links: any[], collection: any[], key: string, href: string) => links.filter((x: any) => x.manager_id === id).map((link: any) => { const target = collection.find((x: any) => x.id === link[key]); return target ? { id: link.id, title: first(target.nome, target.nick, target.username), image: first(target.logo_url, target.avatar_url), href: `/${href}/${target.id}`, subtitle: statusLabel(link.status) } : null }).filter(Boolean) as any[]
    sections.push({ title: 'Equipes administradas', items: mapItems(teamLinks, teams, 'equipe_id', 'equipes') })
    sections.push({ title: 'Produtoras vinculadas', items: mapItems(producerLinks, producers, 'produtora_id', 'produtoras') })
    sections.push({ title: 'Jogadores vinculados', items: mapItems(playerLinks, players, 'jogador_id', 'jogadores') })
  }

  return {
    ...base,
    details,
    actions,
    sections,
    theme,
    enrollment,
    statsFilters,
    competitive,
  }
}
