'use client'
import { useEffect, useRef, useState } from 'react'
import { confirmAction } from '@/components/feedback'
import { supabase } from '@/lib/supabase-browser'
import { participationAttempts, participationSession, writeParticipation, notifyParticipationAttempt,
  type ParticipationAttempt, type ParticipationReadContract } from '@/lib/participation-write'

export function ParticipationRecovery({ championshipId, contract, onConfirmed }: {
  championshipId: string; contract: ParticipationReadContract; onConfirmed: () => void | Promise<void>;
}) {
  const scope = useRef(0), locked = useRef<symbol | null>(null)
  const currentActor = useRef<string | null>(null)
  const [pending, setPending] = useState<ParticipationAttempt | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    ++scope.current
    let active = true
    async function read() {
      const generation = scope.current
      try {
        const { actor } = await participationSession(), attempt = await participationAttempts.read(actor, championshipId)
        if (active && generation === scope.current) { currentActor.current = actor; setPending(attempt); setError('') }
      } catch (err) { if (active && generation === scope.current) { setPending(null); setError(err instanceof Error ? err.message : 'Não foi possível ler a tentativa anterior.') } }
    }
    setPending(null); setBusy(false); locked.current = null
    const changed = () => { void read() }
    window.addEventListener('dz:participation-attempt', changed)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const actor = session?.user.id || null
      if (actor === currentActor.current) return
      currentActor.current = actor
      ++scope.current; setPending(null); setError(''); setBusy(false)
      queueMicrotask(() => { if (active) void read() })
    })
    void read()
    return () => { active = false; ++scope.current; data.subscription.unsubscribe(); window.removeEventListener('dz:participation-attempt', changed) }
  }, [championshipId])
  async function recover(discard: boolean) {
    if (!pending || locked.current) return
    const generation = scope.current, attempt = pending
    const operation = Symbol(); locked.current = operation; setBusy(true); setError('')
    try {
      const { actor } = await participationSession(), stored = await participationAttempts.read(actor, championshipId)
      if (generation !== scope.current || stored?.requestId !== attempt.requestId) throw new Error('A conta ou a tentativa mudou. Abra novamente o acompanhamento.')
      if (discard) {
        if (!await confirmAction('Após conferir o acompanhamento, encerrar esta tentativa neste navegador? Uma inscrição já confirmada no servidor permanece válida.')) return
        if (generation !== scope.current || (await participationSession()).actor !== actor) return
        await participationAttempts.discard(attempt)
        notifyParticipationAttempt(actor, championshipId)
      } else {
        if (contract.participation_write_mode !== 'atomic') throw new Error('Confira o acompanhamento antes de encerrar a tentativa anterior. A confirmação está temporariamente indisponível.')
        await writeParticipation(championshipId, contract, attempt.method, attempt.body, attempt.participationId || undefined)
      }
      const remaining = await participationAttempts.read(actor, championshipId)
      if (generation === scope.current) { setPending(remaining); await onConfirmed() }
    } catch (err) { if (generation === scope.current) setError(err instanceof Error ? err.message : 'Não foi possível confirmar a tentativa.') }
    finally { if (locked.current === operation) locked.current = null; if (generation === scope.current) setBusy(false) }
  }
  if (!pending && !error) return null
  return <section aria-label="Confirmação de inscrição anterior" role="status">
    {pending ? <>
      <p>Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de iniciar outra.</p>
      <div className="button-row">
        <button type="button" className="button secondary" disabled={busy} onClick={() => void recover(false)}>Confirmar tentativa anterior</button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => void recover(true)}>Encerrar tentativa após conferir</button>
      </div>
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
