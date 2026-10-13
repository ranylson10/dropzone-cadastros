/** Shared visibility contract for public directories, profiles and statistics. */
export function isPublicDirectoryRow(row: Record<string, any>) {
  const status = String(row.status || 'ativo').trim().toLowerCase()
  if (['suspenso', 'banido', 'excluido', 'excluído'].includes(status) || row.deleted_at) return false
  const approval = String(row.aprovacao_status || '').trim().toLowerCase()
  return !approval || approval === 'aprovado'
}
