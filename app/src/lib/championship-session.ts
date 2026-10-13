import { supabase } from './supabase'
import { participationUuid } from '../../../backend/src/campeonatos/participation-contract'
/** Client binding only; the server authorizes the bearer independently. */
export async function championshipSession(expectedActor: string) {
  expectedActor = participationUuid(expectedActor)
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id || !data.session.access_token) throw new Error('Entre novamente para confirmar a operação.')
  if (data.session.user.id !== expectedActor) throw new Error('A conta mudou. Abra novamente o campeonato antes de confirmar.')
  return { actor: expectedActor, token: data.session.access_token }
}
