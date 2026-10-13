const running = new Map<string, { identity: string; promise: Promise<any> }>()
/** One synchronous lease covers persistence and HTTP across operation families in this runtime. */
export async function runChampionshipOperation<T>(actor: string, championship: string, identity: string, share: boolean, execute: () => Promise<T>): Promise<T> {
  const scope = JSON.stringify([actor, championship]), existing = running.get(scope)
  if (existing) {
    if (share && existing.identity === identity) return existing.promise
    throw new Error('Aguarde a operação em andamento antes de confirmar outra alteração.')
  }
  const promise = Promise.resolve().then(execute)
  running.set(scope, { identity, promise })
  try { return await promise } finally { if (running.get(scope)?.promise === promise) running.delete(scope) }
}
