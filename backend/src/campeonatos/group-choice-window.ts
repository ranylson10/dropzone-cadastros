type GroupChoiceWindow = { aberta?: unknown; abre_em?: unknown; fecha_em?: unknown }

/** Missing dates are unrestricted; malformed dates must never open a choice window. */
export function groupChoiceWindowIsOpen(config: GroupChoiceWindow | null | undefined, now = Date.now()) {
  if (config?.aberta !== true || !Number.isFinite(now)) return false
  const time = (value: unknown) => {
    if (value == null || value === '') return null
    if (typeof value !== 'string') return Number.NaN
    return new Date(value).getTime()
  }
  const start = time(config.abre_em)
  const end = time(config.fecha_em)
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) return false
  if (start !== null && end !== null && start > end) return false
  return (start === null || start <= now) && (end === null || end >= now)
}
