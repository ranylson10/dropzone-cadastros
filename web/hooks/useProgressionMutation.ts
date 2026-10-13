'use client'
import { useEffect, useRef, useState } from 'react'
import { progressionAttempts, writeProgression, notifyProgressionAttempt } from '@/lib/progression-write'
import type { ProgressionAttempt } from '@backend/campeonatos/progression-attempt'
import type { ProgressionReadContract } from '@backend/campeonatos/progression-contract'
export function useProgressionMutation(championship: string, actor: string) {
  const identity = JSON.stringify([championship, actor]), current = useRef({ identity, epoch: 0 })
  if (current.current.identity !== identity) current.current = { identity, epoch: current.current.epoch + 1 }
  const epoch = current.current.epoch
  const [state, setState] = useState<{ epoch: number; pending: ProgressionAttempt | null; error: string; busy: boolean; ready: boolean }>({ epoch, pending: null, error: '', busy: false, ready: false })
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const lock = useRef<number | null>(null), active = () => mounted.current && current.current.epoch === epoch && current.current.identity === identity
  useEffect(() => {
    let alive = true
    let revision = 0
    const refresh = async () => {
      if (!actor) return
      const readRevision = ++revision
      try { const pending = await progressionAttempts.read(actor, championship); if (alive && revision === readRevision) setState(previous => ({ epoch, pending, error: previous.epoch === epoch ? previous.error : '', busy: previous.epoch === epoch && previous.busy, ready: true })) }
      catch (cause) { if (alive && revision === readRevision) setState({ epoch, pending: null, error: cause instanceof Error ? cause.message : 'Falha ao ler a tentativa.', busy: false, ready: false }) }
    }
    void refresh()
    const listener = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.actor === actor && detail?.championship === championship) void refresh() }
    window.addEventListener('dz:progression-attempt', listener)
    return () => { alive = false; window.removeEventListener('dz:progression-attempt', listener) }
  }, [actor, championship, epoch])
  const visible = state.epoch === epoch ? state : { pending: null, error: '', busy: false, ready: false }
  async function run(contract: ProgressionReadContract, body: Record<string, any>) {
    if (!actor || !active() || !visible.ready) throw new Error('Atualize o acompanhamento antes de confirmar.')
    if (lock.current === epoch) throw new Error('Aguarde a progressão em andamento.')
    lock.current = epoch; setState(previous => ({ ...previous, epoch, busy: true, error: '' }))
    try {
      const result = await writeProgression(championship, contract, body, () => { if (!active()) throw new Error('O campeonato ou a conta mudou. Consulte a tentativa anterior.') })
      if (!active()) throw new Error('A progressão foi confirmada no campeonato anterior. Consulte o acompanhamento daquela conta.')
      return result
    } catch (cause) {
      if (active()) setState(previous => ({ ...previous, epoch, error: cause instanceof Error ? cause.message : 'Falha ao confirmar.', busy: false }))
      throw cause
    } finally { if (lock.current === epoch) lock.current = null; if (active()) setState(previous => ({ ...previous, busy: false })) }
  }
  async function discard() {
    if (!visible.pending || visible.busy || !active()) return false
    try { await progressionAttempts.discard(visible.pending); if (active()) { notifyProgressionAttempt(actor, championship); setState(previous => ({ ...previous, pending: null, error: '' })); return true } }
    catch (cause) { if (active()) setState(previous => ({ ...previous, error: cause instanceof Error ? cause.message : 'Falha ao encerrar a tentativa.' })) }
    return false
  }
  const retry = () => { if (!visible.pending) throw new Error('Nenhuma progressão pendente.'); return run({ progression_write_mode: 'atomic', progression_actor_id: actor }, visible.pending.body) }
  return { ...visible, run, retry, discard, epoch }
}
