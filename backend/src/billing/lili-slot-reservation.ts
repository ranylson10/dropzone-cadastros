import { randomBytes } from 'crypto'
import { supabaseAdmin } from '../shared/supabase-admin'

export type LiliPaymentMethod = 'pix' | 'cartao' | 'paypal' | 'whatsapp'

function reservationCode() {
  return `DZ-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function releaseExpiredLiliReservations() {
  const { error } = await supabaseAdmin.rpc('fn_lili_liberar_reservas_expiradas')
  if (error && !['42883', 'PGRST202'].includes(String(error.code || ''))) throw error
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
  await releaseExpiredLiliReservations()
  const codigo = reservationCode()
  const { data, error } = await supabaseAdmin.rpc('fn_lili_reservar_slot', {
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
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('lili_reservas_slot')
    .update({ status: 'confirmada', confirmado_em: now, updated_at: now })
    .eq('id', reservationId)
  if (error) throw error
}
