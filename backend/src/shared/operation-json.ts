export function operationUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) throw new Error('Identificador de operação inválido.')
  return value.toLowerCase()
}
/** Stable JSON for immutable snapshot intents; order-independent objects, bounded depth/bytes. */
export function operationJson(value: unknown): string {
  const normalize = (item: any, depth: number): any => {
    if (depth > 20) throw new Error('Acompanhamento de operação inválido.')
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item
    if (typeof item === 'number' && Number.isFinite(item)) return item
    if (Array.isArray(item)) return item.map(child => normalize(child, depth + 1))
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize(item[key], depth + 1)]))
    throw new Error('Acompanhamento de operação inválido.')
  }
  const serialized = JSON.stringify(normalize(value, 0))
  if (new TextEncoder().encode(serialized).length > 4194304) throw new Error('O acompanhamento excede o limite da operação.')
  return serialized
}
