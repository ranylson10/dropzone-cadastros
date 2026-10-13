'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { confirmAction } from '@/components/feedback'
import { slotMovementAttempts, slotMovementSession, writeSlotMovement, notifySlotMovementAttempt, type SlotMovementReadContract } from '@/lib/slot-movement-write'
import type { SlotMovementAttempt } from '@backend/campeonatos/slot-movement-attempt'

export function SlotMovementRecovery({ championshipId, contract, onConfirmed }: { championshipId: string; contract: SlotMovementReadContract; onConfirmed: () => void | Promise<void> }) {
  const scope = useRef(0), actorRef = useRef<string | null>(null), lock = useRef<symbol | null>(null)
  const [pending, setPending] = useState<SlotMovementAttempt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let active = true
    ++scope.current; setPending(null); setBusy(false); lock.current = null
    async function read() {
      const generation = scope.current
      try {
        const { actor } = await slotMovementSession(), attempt = await slotMovementAttempts.read(actor, championshipId)
        if (active && generation === scope.current) { actorRef.current = actor; setPending(attempt); setError('') }
      } catch (err) { if (active && generation === scope.current) { setPending(null); setError(err instanceof Error ? err.message : 'Não foi possível ler a movimentação anterior.') } }
    }
    const changed = () => { void read() }
    window.addEventListener('dz:slot-movement-attempt', changed)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const actor = session?.user.id || null
      if (actor === actorRef.current) return
      actorRef.current = actor; ++scope.current; setPending(null); setBusy(false); setError('')
      queueMicrotask(() => { if (active) void read() })
    })
    void read()
    return () => { active = false; ++scope.current; data.subscription.unsubscribe(); window.removeEventListener('dz:slot-movement-attempt', changed) }
  }, [championshipId])
  async function recover(discard: boolean) {
    if (!pending || lock.current) return
    const operation = Symbol(), generation = scope.current, attempt = pending
    lock.current = operation; setBusy(true); setError('')
    try {
      const { actor } = await slotMovementSession(), stored = await slotMovementAttempts.read(actor, championshipId)
      if (generation !== scope.current || stored?.requestId !== attempt.requestId) throw new Error('A conta ou a tentativa mudou. Abra novamente o acompanhamento.')
      if (discard) {
        if (!await confirmAction('Depois de conferir os slots, encerrar esta tentativa neste navegador? Uma movimentação confirmada no servidor permanece válida.')) return
        if (generation !== scope.current || (await slotMovementSession()).actor !== actor) return
        await slotMovementAttempts.discard(attempt); notifySlotMovementAttempt()
      } else {
        if (contract.slot_movement_mode !== 'atomic') throw new Error('Confira os slots antes de encerrar a tentativa anterior. A confirmação está temporariamente indisponível.')
        await writeSlotMovement(championshipId, contract, attempt.body)
      }
      const remaining = await slotMovementAttempts.read(actor, championshipId)
      if (generation === scope.current) { setPending(remaining); await onConfirmed() }
    } catch (err) { if (generation === scope.current) setError(err instanceof Error ? err.message : 'Não foi possível confirmar a movimentação.') }
    finally { if (lock.current === operation) lock.current = null; if (generation === scope.current) setBusy(false) }
  }
  if (!pending && !error) return null
  return <section role="status" aria-label="Confirmação de movimentação anterior">
    {pending ? <><p>Há uma movimentação aguardando confirmação. Confira os slots antes de iniciar outra alteração.</p><div className="button-row">
      <button type="button" className="button secondary" disabled={busy} onClick={() => void recover(false)}>Confirmar movimentação anterior</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void recover(true)}>Encerrar movimentação após conferir</button>
    </div></> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
