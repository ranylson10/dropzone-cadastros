export type PostArtworkSliceDirection = 'horizontal' | 'vertical'
export type PostArtworkOutputFormat = 'png' | 'jpg'
export type PostArtworkBlockType = 'table_general' | 'table_day' | 'qualified_teams' | 'booyahs_day' | 'mvp_general' | 'mvp_day' | 'kills_leaders' | 'image' | 'text'
export type PostArtworkTableColumnKey = 'rank' | 'logo' | 'name' | 'drops' | 'booyah' | 'kills' | 'points'
export type PostArtworkCellBackgroundType = 'color' | 'image' | 'none'

export type PostArtworkTableColumnStyle = {
  key: PostArtworkTableColumnKey
  label: string
  enabled: boolean
  width: number
  align: 'left' | 'center' | 'right'
  backgroundType: PostArtworkCellBackgroundType
  backgroundColor: string
  backgroundUrl: string | null
  color: string
  fontSize: number
  fontWeight: number
}

export type PostArtworkTableStyle = {
  rowHeight: number
  rowGap: number
  cellGap: number
  headerHeight: number
  showHeader: boolean
  headerBackgroundType: PostArtworkCellBackgroundType
  headerBackgroundColor: string
  headerBackgroundUrl: string | null
  headerColor: string
  columns: PostArtworkTableColumnStyle[]
}

export type PostArtworkBlockSource = {
  rodadaId?: string
  rodadaName?: string
}

export type PostArtworkBlock = {
  id: string
  type: PostArtworkBlockType
  name: string
  x: number
  y: number
  width: number
  visible: boolean
  dataStart?: number
  dataEnd?: number
  source?: PostArtworkBlockSource
  style?: Record<string, unknown>
}

export type PostArtworkProject = {
  id: string
  campeonato_id: string
  name: string
  width: number
  height: number
  slice_count: number
  slice_direction: PostArtworkSliceDirection
  slice_width: number
  slice_height: number
  output_format: PostArtworkOutputFormat
  background_url: string | null
  background_color: string
  blocks: PostArtworkBlock[]
  created_at: string
  updated_at: string
}

export type PostArtworkTeamRow = {
  rank: number
  logo: string
  name: string
  drops: number
  booyah: number
  kills: number
  points: number
}


export type PostArtworkMvpStyle = {
  cardWidth: number
  cardHeight: number
  backgroundType: PostArtworkCellBackgroundType
  backgroundColor: string
  backgroundUrl: string | null
  imageSize: number
  imageRadius: number
  nameColor: string
  nameFontSize: number
  nameFontWeight: number
  teamColor: string
  teamFontSize: number
  statsColor: string
  statsFontSize: number
  showPhoto: boolean
  showTeam: boolean
  showDrops: boolean
  showKills: boolean
  gap: number
}

export type PostArtworkPlayerRow = {
  rank: number
  id: string
  nick: string
  gameId: string
  photo: string
  team: string
  drops: number
  kills: number
  damage: number
  assists: number
}

export type PostArtworkAssetKind = 'background' | 'cell' | 'card' | 'other'

export type PostArtworkAsset = {
  id: string
  campeonato_id: string
  name: string
  url: string
  kind: PostArtworkAssetKind
  created_at: string
}
