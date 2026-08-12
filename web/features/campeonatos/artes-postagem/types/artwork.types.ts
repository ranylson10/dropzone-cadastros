export type PostArtworkSliceDirection = 'horizontal' | 'vertical'
export type PostArtworkOutputFormat = 'png' | 'jpg'

export type PostArtworkBlock = {
  id: string
  type: 'table_general' | 'table_day' | 'mvp_general' | 'mvp_day' | 'booyahs_day' | 'kills_leaders' | 'image' | 'text'
  name: string
  x: number
  y: number
  width: number
  visible: boolean
  dataStart?: number
  dataEnd?: number
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
