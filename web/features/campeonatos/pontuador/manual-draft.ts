export type TeamEdit = { posicao: string; abates: string; punicao: string; motivo: string; jogadores: Record<string, string> }

export function manualDraftTeams(
  edits: Record<string, TeamEdit>,
  initial: Record<string, TeamEdit>,
  absent: Record<string, boolean>,
) {
  const positions = new Set<number>()
  const result = []
  for (const [id, edit] of Object.entries(edits)) {
    if (absent[id]) continue
    const changed = JSON.stringify(edit) !== JSON.stringify(initial[id])
    if (!edit.posicao.trim() && !changed) continue
    if (changed && (!edit.posicao.trim() || !edit.abates.trim())) throw new Error('Informe colocação e abates de cada equipe alterada. Use 0 quando não houve abates.')
    const posicao = Number(edit.posicao)
    const abates = Number(edit.abates)
    if (!Number.isSafeInteger(posicao) || posicao < 1 || !Number.isSafeInteger(abates) || abates < 0) throw new Error('Colocação e abates devem ser números inteiros válidos.')
    if (positions.has(posicao)) throw new Error('Duas equipes não podem ter a mesma colocação na queda.')
    positions.add(posicao)
    if (!changed) continue
    const punicao = Number(edit.punicao || 0)
    if (!Number.isFinite(punicao) || punicao > 0) throw new Error('A punição deve ser zero ou negativa.')
    const jogadores = Object.entries(edit.jogadores).filter(([, value]) => value.trim() !== '').map(([playerId, value]) => {
      const kills = Number(value)
      if (!Number.isSafeInteger(kills) || kills < 0) throw new Error('Os abates dos jogadores devem ser inteiros e não negativos.')
      return { campeonato_jogador_id: playerId, abates: kills }
    })
    if (jogadores.reduce((sum, player) => sum + player.abates, 0) > abates) throw new Error('Os abates informados dos jogadores excedem o total da equipe.')
    result.push({ campeonato_equipe_id: id, posicao, abates, punicao_pontos: punicao, punicao_motivo: edit.motivo, jogadores })
  }
  return result
}
