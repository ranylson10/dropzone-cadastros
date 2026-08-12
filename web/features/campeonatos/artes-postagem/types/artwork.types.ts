export type PostArtworkSliceDirection = 'horizontal' | 'vertical'
export type PostArtworkOutputFormat = 'png' | 'jpg'
export type PostArtworkBlockType = 'table_general' | 'table_day' | 'mvp_general' | 'mvp_day' | 'booyahs_day' | 'kills_leaders' | 'image' | 'text'
export type PostArtworkTableColumnKey = 'rank' | 'logo' | 'name' | 'drops' | 'booyah' | 'kills' | 'points'
export type PostArtworkCellBackgroundType = 'color' | 'image'

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
  headerBackgroundColor: string
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
