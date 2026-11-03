import { randomBytes } from 'crypto'
import { supabaseAdmin } from '../shared/supabase-admin'

export type LiliPaymentMethod = 'pix' | 'cartao' | 'paypal' | 'whatsapp'

function reservationCode() {
  return `DZ-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function releaseExpiredLiliReservations() {
  // R11: opt-in for bounded cleanup under group -> slot locks in staging.
  // When enabled, an absent RPC MUST fail; never silently use the global legacy writer.
  const mode = process.env.DROPZONE_LILI_CLEANUP_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') throw new Error('Modo de limpeza de reservas indisponível.')
  const { error } = mode === 'atomic'
    ? await supabaseAdmin.rpc('fn_lili_liberar_reservas_expiradas_r11', { p_limit: 100 })
    : await supabaseAdmin.rpc('fn_lili_liberar_reservas_expiradas')
  if (error && (mode === 'atomic' || !['42883', 'PGRST202'].includes(String(error.code || '')))) throw error
}

export async function reserveSlotForLili(input: {
  campeonatoId: string
  grupoId: string
  slotId: string
  authUserId: string
  equipeId: string
  lineId?: string | null
  nomeLine?: string | null
  conviteToken?: string | null
  metodo: LiliPaymentMethod
  minutes?: number
  meta?: Record<string, unknown>
}) {
  // An opt-in deployment uses the R10 group -> slot RPC and its scoped expiry.
  // Never call the legacy global cleanup before entering that transaction.
  const mode = process.env.DROPZONE_LILI_RESERVATION_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') throw new Error('Modo de reserva indisponível.')
  if (mode === 'legacy') await releaseExpiredLiliReservations()
  const codigo = reservationCode()
  const { data, error } = await supabaseAdmin.rpc(mode === 'atomic' ? 'fn_lili_reservar_slot_r10' : 'fn_lili_reservar_slot', {
    p_codigo: codigo,
    p_campeonato_id: input.campeonatoId,
    p_grupo_id: input.grupoId,
    p_slot_id: input.slotId,
    p_auth_user_id: input.authUserId,
    p_equipe_id: input.equipeId,
    p_line_id: input.lineId || null,
    p_nome_line: input.nomeLine || null,
    p_convite_token: input.conviteToken || null,
    p_metodo: input.metodo,
    p_minutos: input.minutes || (input.metodo === 'whatsapp' ? 30 : 15),
    p_meta: input.meta || {},
  })
  if (error) throw error
  return data
}

export async function attachReservationPayment(reservationId: string, compraId?: string | null, paymentId?: string | null) {
  const patch: Record<string, unknown> = { pagamento_id: paymentId || null, updated_at: new Date().toISOString() }
  if (compraId) patch.compra_vaga_id = compraId
  const { error } = await supabaseAdmin
    .from('lili_reservas_slot')
    .update(patch)
    .eq('id', reservationId)
  if (error) throw error
}

export async function confirmLiliReservation(reservationId: string) {
  // Never confirm an expired, cancelled, or previously finalized reservation.
  // The predicate is enforced by PostgreSQL in the same UPDATE, not a pre-read.
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('lili_reservas_slot')
    .update({ status: 'confirmada', confirmado_em: now, updated_at: now })
    .eq('id', reservationId)
    .eq('status', 'ativa')
    .gt('expira_em', now)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (data) return
  // Repeated webhooks may acknowledge an already confirmed reservation.
  // This read happens only after the guarded UPDATE matched zero rows.
  const { data: previous, error: previousError } = await supabaseAdmin
    .from('lili_reservas_slot')
    .select('status')
    .eq('id', reservationId)
    .maybeSingle()
  if (previousError) throw previousError
  if (previous?.status === 'confirmada') return
  throw new Error('Reserva expirada, cancelada ou inexistente; confirme o pagamento manualmente.')
}
