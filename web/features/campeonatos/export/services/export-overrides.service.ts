import { supabase } from '@/lib/supabase-browser'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export type ExportOverrides = {
  logo_bg_url: string | null
  photo_bg_url: string | null
  logo_margin: { top: number; right: number; bottom: number; left: number }
  photo_margin: { top: number; right: number; bottom: number; left: number }
  equipes: Record<string, { nome?: string; tag?: string }>
  jogadores: Record<string, {
    nick?: string
    id_jogo?: string
    funcao?: string
    localidade?: string
    tag_equipe?: string
    equipe_id?: string
  }>
  logos: Record<string, {
    source_url?: string | null
    tint_color?: string | null
    codigo?: number
    slot_letra?: string
    equipe_nome?: string
    line_nome?: string
    equipe_id?: string
  }>
  fotos: Record<string, {
    source_url?: string | null
    nick?: string
    equipe_nome?: string
    key?: string
  }>
  nation_source?: string
  role_color?: string
  team_color?: string
  text_colors?: unknown
  updated_at?: string | null
}

export const exportOverridesService = {
  async load(campeonatoId: string): Promise<{ overrides: ExportOverrides; missing_table?: boolean }> {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/export/overrides`, {
      headers: await authHeaders(),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar backup do campeonato.')
    return json
  },

  async save(campeonatoId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/export/overrides`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Erro ao salvar backup do campeonato.')
    return json
  },
}
