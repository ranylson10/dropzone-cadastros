/**
 * Gera PlayerNameOverwrite.json para SPEC de telamento Free Fire.
 *
 * Formato:
 * {
 *   "PlayerNameList": [ { PlayerID, PlayerNameOverwrite, PlayerNation, Color } ],
 *   "TeamRegionList": [ { TeamID, TeamRegion, Color } ],
 *   "TextColor": [ { TeamPlayer1..4, TeamPlayer1Num..4, Alive, Knockdown, Eliminated } ]
 * }
 *
 * Separador tag↔nick: U+FFA0 (HALFWIDTH HANGUL FILLER) — caractere "invisível" do arquivo original.
 */

import type { CampeonatoExportPayload } from '../types/campeonato-export.types'

/** Separador entre TAG e nick no overlay FF */
export const FF_TAG_NICK_SEP = '\uFFA0'

export type FfTextColors = {
  TeamPlayer1: string
  TeamPlayer2: string
  TeamPlayer3: string
  TeamPlayer4: string
  TeamPlayer1Num: string
  TeamPlayer2Num: string
  TeamPlayer3Num: string
  TeamPlayer4Num: string
  Alive: string
  Knockdown: string
  Eliminated: string
}

export type FfNationSource = 'funcao' | 'localidade'

export type FfGenerateOptions = {
  /** Cor do texto da função/localidade (PlayerNation) */
  roleColor: string
  /** Cor do nome da equipe em TeamRegionList */
  teamColor: string
  textColor: FfTextColors
  /**
   * O que preencher em PlayerNation:
   * - funcao → SNIPER/RUSHER/BOMBER/SUPPORT
   * - localidade → só a cidade (sem estado/país)
   */
  nationSource?: FfNationSource
}

export const DEFAULT_FF_TEXT_COLORS: FfTextColors = {
  TeamPlayer1: '#FFFFFF',
  TeamPlayer2: '#FFFFFF',
  TeamPlayer3: '#FFFFFF',
  TeamPlayer4: '#FFFFFF',
  TeamPlayer1Num: '#FFFFFF',
  TeamPlayer2Num: '#FFFFFF',
  TeamPlayer3Num: '#FFFFFF',
  TeamPlayer4Num: '#FFFFFF',
  Alive: '#04ff00',
  Knockdown: '#FFFF00',
  Eliminated: '#ff0000',
}

const ROLE_MAP: Record<string, string> = {
  sniper: 'SNIPER',
  snipers: 'SNIPER',
  atirador: 'SNIPER',
  rusher: 'RUSHER',
  rush: 'RUSHER',
  entry: 'RUSHER',
  bomber: 'BOMBER',
  granadeiro: 'BOMBER',
  granade: 'BOMBER',
  support: 'SUPPORT',
  suporte: 'SUPPORT',
  igl: 'SUPPORT',
  lider: 'SUPPORT',
  líder: 'SUPPORT',
}

export function mapFuncaoToPlayerNation(funcao: string | null | undefined): string {
  const key = String(funcao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  if (!key) return 'RUSHER'
  if (ROLE_MAP[key]) return ROLE_MAP[key]
  // se já vier no padrão do SPEC
  const upper = key.toUpperCase()
  if (['SNIPER', 'RUSHER', 'BOMBER', 'SUPPORT'].includes(upper)) return upper
  return 'RUSHER'
}

/** Extrai só a cidade da localidade (antes de vírgula, barra ou " - "). */
export function cityOnly(localidade: string | null | undefined): string {
  const s = String(localidade || '').trim()
  if (!s) return ''
  const city = s.split(/\s*[,\/|]\s*|\s+-\s+/)[0]?.trim() || s
  return city.slice(0, 24)
}

export function resolvePlayerNation(
  source: FfNationSource | undefined,
  funcao: string | null | undefined,
  localidade: string | null | undefined,
): string {
  if (source === 'localidade') {
    const city = cityOnly(localidade)
    return city || '—'
  }
  return mapFuncaoToPlayerNation(funcao)
}

function parsePlayerId(idJogo: string | null | undefined): number | null {
  const digits = String(idJogo || '').replace(/\D/g, '')
  if (!digits) return null
  // PlayerID no arquivo original cabe em number; IDs longos usam Number (pode perder precisão >2^53)
  const n = Number(digits)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function cleanTag(tag: string | null | undefined, equipeNome: string): string {
  const t = String(tag || '').trim()
  if (t) return t.slice(0, 12)
  // fallback: iniciais do nome da equipe
  return String(equipeNome || 'TEAM')
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 6) || 'TEAM'
}

function cleanNick(nick: string | null | undefined): string {
  return String(nick || 'Player').trim().slice(0, 24) || 'Player'
}

/**
 * Serializa no estilo próximo do arquivo original do SPEC
 * (espaços em torno de : e chaves em linha).
 */
export function serializePlayerNameOverwrite(payload: {
  PlayerNameList: Array<{
    PlayerID: number
    PlayerNameOverwrite: string
    PlayerNation: string
    Color: string
  }>
  TeamRegionList: Array<{
    TeamID: number
    TeamRegion: string
    Color: string
  }>
  TextColor: FfTextColors[]
}): string {
  const playerLines = payload.PlayerNameList.map((p) =>
    `{"PlayerID" :${p.PlayerID},"PlayerNameOverwrite" : ${JSON.stringify(p.PlayerNameOverwrite)},"PlayerNation" : ${JSON.stringify(p.PlayerNation)},"Color":${JSON.stringify(p.Color)}}`,
  ).join(',\n')

  const teamLines = payload.TeamRegionList.map(
    (t) =>
      `     {"TeamID" : ${t.TeamID} ,"TeamRegion" : ${JSON.stringify(t.TeamRegion)},"Color":${JSON.stringify(t.Color)}}`,
  ).join(',\n')

  const tc = payload.TextColor[0] || DEFAULT_FF_TEXT_COLORS
  const textColorLine =
    `    {"TeamPlayer1": ${JSON.stringify(tc.TeamPlayer1)}, "TeamPlayer2": ${JSON.stringify(tc.TeamPlayer2)}, "TeamPlayer3": ${JSON.stringify(tc.TeamPlayer3)}, "TeamPlayer4": ${JSON.stringify(tc.TeamPlayer4)},"TeamPlayer1Num": ${JSON.stringify(tc.TeamPlayer1Num)}, "TeamPlayer2Num": ${JSON.stringify(tc.TeamPlayer2Num)}, "TeamPlayer3Num": ${JSON.stringify(tc.TeamPlayer3Num)}, "TeamPlayer4Num": ${JSON.stringify(tc.TeamPlayer4Num)},"Alive": ${JSON.stringify(tc.Alive)}, "Knockdown": ${JSON.stringify(tc.Knockdown)}, "Eliminated": ${JSON.stringify(tc.Eliminated)}}`

  return [
    '{',
    '  "PlayerNameList": [',
    playerLines,
    '   ],',
    '   "TeamRegionList":[',
    teamLines,
    ' ]',
    '  ,',
    '  "TextColor": [',
    textColorLine,
    '  ]',
    '}',
    '',
  ].join('\n')
}

export function buildPlayerNameOverwrite(
  data: CampeonatoExportPayload,
  options: FfGenerateOptions,
): { content: string; stats: { players: number; teams: number; skipped: number } } {
  const roleColor = options.roleColor || '#000000'
  const teamColor = options.teamColor || '#000000'
  const nationSource = options.nationSource || 'funcao'

  const players: Array<{
    PlayerID: number
    PlayerNameOverwrite: string
    PlayerNation: string
    Color: string
  }> = []

  // ordem estável de equipes para TeamID
  const teamOrder: Array<{ id: string; nome: string }> = []
  const teamSeen = new Set<string>()
  let skipped = 0

  for (const eq of data.equipes || []) {
    for (const line of eq.lines || []) {
      if (!teamSeen.has(eq.id)) {
        teamSeen.add(eq.id)
        teamOrder.push({ id: eq.id, nome: eq.nome })
      }
      const tag = cleanTag(line.tag || eq.tag, eq.nome)
      for (const jog of line.jogadores || []) {
        const playerId = parsePlayerId(jog.id_jogo)
        if (playerId == null) {
          skipped += 1
          continue
        }
        const nick = cleanNick(jog.nick)
        players.push({
          PlayerID: playerId,
          PlayerNameOverwrite: `${tag}${FF_TAG_NICK_SEP}${nick}`,
          PlayerNation: resolvePlayerNation(nationSource, jog.funcao, jog.localidade),
          Color: roleColor,
        })
      }
    }
  }

  const teams = teamOrder.map((t, index) => ({
    TeamID: index + 1,
    TeamRegion: String(t.nome || 'EQUIPE').trim().toUpperCase(),
    Color: teamColor,
  }))

  const payload = {
    PlayerNameList: players,
    TeamRegionList: teams,
    TextColor: [options.textColor || DEFAULT_FF_TEXT_COLORS],
  }

  return {
    content: serializePlayerNameOverwrite(payload),
    stats: { players: players.length, teams: teams.length, skipped },
  }
}
