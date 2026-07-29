import { supabaseAdmin } from '../shared/supabase-admin'

type TeamPlayerInput = {
  equipe_id: string
  jogador_auth_user_id: string
  nick?: string | null
  foto_url?: string | null
  id_jogo?: string | null
  funcao?: string | null
  localidade?: string | null
  origem?: string | null
  status?: string | null
  updated_at?: string
}

export async function saveTeamPlayer(input: TeamPlayerInput) {
  const payload = {
    ...input,
    origem: input.origem || 'manual',
    status: input.status || 'ativo',
    updated_at: input.updated_at || new Date().toISOString(),
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from('equipe_jogadores')
    .select('id')
    .eq('equipe_id', input.equipe_id)
    .eq('jogador_auth_user_id', input.jogador_auth_user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (findError) throw findError

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('equipe_jogadores')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabaseAdmin
    .from('equipe_jogadores')
    .insert(payload)
    .select('*')
    .single()

  if (error?.code === '23505') {
    const { data: concurrent, error: concurrentError } = await supabaseAdmin
      .from('equipe_jogadores')
      .select('id')
      .eq('equipe_id', input.equipe_id)
      .eq('jogador_auth_user_id', input.jogador_auth_user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (concurrentError) throw concurrentError
    if (!concurrent?.id) throw error

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('equipe_jogadores')
      .update(payload)
      .eq('id', concurrent.id)
      .select('*')
      .single()
    if (updateError) throw updateError
    return updated
  }

  if (error) throw error
  return data
}
