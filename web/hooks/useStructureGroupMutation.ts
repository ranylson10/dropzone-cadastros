'use client'
import { useEffect, useRef, useState } from 'react'
import { useAccountResourceScope } from './useAccountResourceScope'
import { discardStructureGroup, notifyStructureGroupAttempt, retryStructureGroup, structureGroupAttempts, writeStructureGroup, type StructureGroupIntent, type StructureGroupReadContract } from '@/lib/structure-group-write'
import type { OperationAttempt } from '@backend/shared/operation-attempt'

export function useStructureGroupMutation(championship: string) {
  const scope = useAccountResourceScope(championship), lock = useRef<number | null>(null)
  const [state, setState] = useState<{ key: string; pending: OperationAttempt<StructureGroupIntent> | null; error: string; busy: boolean; ready: boolean }>({ key: '', pending: null, error: '', busy: false, ready: false })
  useEffect(() => {
    let alive = true, revision = 0
    const refresh = async () => {
      if (!scope.actor) return
      const current = ++revision
      try {
        const pending = await structureGroupAttempts.read(scope.actor, championship)
        if (alive && current === revision && scope.isCurrent()) setState(previous => ({ key: scope.key, pending, error: previous.key === scope.key ? previous.error : '', busy: previous.key === scope.key && previous.busy, ready: true }))
      } catch (error) { if (alive && current === revision && scope.isCurrent()) setState({ key: scope.key, pending: null, error: error instanceof Error ? error.message : 'Não foi possível ler a tentativa.', busy: false, ready: false }) }
    }
    void refresh()
    const listener = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.actor === scope.actor && detail?.championship === championship) void refresh() }
    window.addEventListener('dz:structure-group-attempt', listener)
    return () => { alive = false; window.removeEventListener('dz:structure-group-attempt', listener) }
  }, [scope.key, scope.actor, championship])
  const visible = state.key === scope.key ? state : { pending: null, error: '', busy: false, ready: false }
  const assertCurrent = () => { if (!scope.actor || !scope.isCurrent()) throw new Error('A conta ou o campeonato mudou. Consulte a tentativa anterior.') }
  async function operate(work: () => Promise<any>) {
    assertCurrent()
    if (!visible.ready || lock.current === scope.epoch) throw new Error('Aguarde a leitura ou a confirmação em andamento.')
    lock.current = scope.epoch
    setState(previous => ({ ...previous, key: scope.key, error: '', busy: true }))
    try { const result = await work(); assertCurrent(); return result }
    catch (error) { if (scope.isCurrent()) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Não foi possível criar o grupo.' })); throw error }
    finally {
      try {
        const pending = await structureGroupAttempts.read(scope.actor!, championship)
        if (scope.isCurrent()) setState(previous => ({ ...previous, pending, busy: false }))
      } catch (error) { if (scope.isCurrent()) setState(previous => ({ ...previous, busy: false, ready: false, error: error instanceof Error ? error.message : 'Não foi possível ler a tentativa.' })) }
      if (lock.current === scope.epoch) lock.current = null
    }
  }
  const run = (contract: StructureGroupReadContract, body: Record<string, any>) => operate(() => writeStructureGroup(championship, contract, body, assertCurrent))
  const retry = () => {
    if (!visible.pending || !scope.actor) throw new Error('Nenhuma criação de grupo pendente.')
    const saved = visible.pending
    return operate(() => retryStructureGroup(championship, scope.actor!, saved, assertCurrent))
  }
  async function discard() {
    assertCurrent()
    if (!visible.pending || !visible.ready || lock.current === scope.epoch) return false
    lock.current = scope.epoch; setState(previous => ({ ...previous, busy: true, error: '' }))
    try { await discardStructureGroup(championship, scope.actor!, visible.pending, assertCurrent); assertCurrent(); notifyStructureGroupAttempt(scope.actor!, championship); setState(previous => ({ ...previous, pending: null })); return true }
    catch (error) { if (scope.isCurrent()) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Falha ao encerrar tentativa.' })); return false }
    finally { if (lock.current === scope.epoch) lock.current = null; if (scope.isCurrent()) setState(previous => ({ ...previous, busy: false })) }
  }
  return { ...visible, scope, run, retry, discard }
}
