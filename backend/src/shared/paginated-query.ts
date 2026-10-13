type RangeQuery<T> = { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }> }

/** Intentionally bounded history still needs multiple pages when the API cap is lower. */
export async function readLimitedRows<T>(query: RangeQuery<T>, limit: number): Promise<T[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50000) throw new Error('Limite de consulta inválido.')
  const rows: T[] = []
  while (rows.length < limit) {
    const end = Math.min(rows.length + 500, limit) - 1
    const { data, error } = await query.range(rows.length, end)
    if (error) throw error
    if (!data?.length) return rows
    if (data.length > end - rows.length + 1) throw new Error('Resposta de consulta incompatível com o limite solicitado.')
    rows.push(...data)
  }
  return rows
}

/** Internal scoped queries must not silently inherit the Data API row cap. */
export async function readPagedRows<T>(query: RangeQuery<T>, maxRows = 50000): Promise<T[]> {
  const rows: T[] = []
  const batchSize = 500
  while (rows.length <= maxRows) {
    const { data, error } = await query.range(rows.length, rows.length + batchSize - 1)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
    // Query an empty page to finish, even if the server returned fewer than 500:
    // PostgREST can have a lower configured maximum than our requested batch.
  }
  throw new Error('A consulta excedeu o limite de registros. Restrinja o campeonato ou o período solicitado.')
}

/** Keep IN filters below URL limits while paging each already-authorized batch. */
export async function readRowsByIds<T>(ids: string[], queryForBatch: (batch: string[]) => RangeQuery<T>): Promise<T[]> {
  const values = [...new Set(ids.filter(Boolean))]
  const rows: T[] = []
  for (let offset = 0; offset < values.length; offset += 150) {
    rows.push(...await readPagedRows(queryForBatch(values.slice(offset, offset + 150))))
    if (rows.length > 50000) throw new Error('A consulta excedeu o limite de registros. Restrinja as entidades solicitadas.')
  }
  return rows
}
