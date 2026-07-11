export async function listarCampeonatoJogadores(campeonatoId: string) {
  const response = await fetch(`/api/campeonatos/${campeonatoId}/jogadores`, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as escalações.')
  return payload
}
