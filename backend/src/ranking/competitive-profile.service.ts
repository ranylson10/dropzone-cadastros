import { readPublicCompetitiveHistory } from './public-performance-read.service'

function text(value: unknown) { return String(value ?? '').trim() }
function compactNumber(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

function integer(value: unknown) {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}


export async function buildCompetitiveProfile(kind: 'equipes' | 'jogadores', id: string, rankRows: any[]) {
  const isPlayer = kind === 'jogadores'
  const statsRows = await readPublicCompetitiveHistory(kind, id)
  const aggregate = (field: string) => rankRows.reduce((total, row) => total + integer(row[field]), 0)
  const principal = rankRows.sort((a, b) => integer(b.score) - integer(a.score))[0] || null
  const statTotal = (field: string) => statsRows.reduce((total, row) => total + integer(row[field]), 0)
  const total = (field: string) => aggregate(field) || statTotal(field)
  const weaponUsage = new Map<string, { nome: string; abates: number; dano: number }>()
  const skillUsage = new Map<string, { tipo: string; personagem: string; habilidade: string; usos: number; pickTimes: number; pickRate: number }>()
  for (const row of statsRows) {
    for (const weapon of (row.garena_matchstats_armas || [])) {
      const nome = text(weapon.arma)
      if (!nome) continue
      const current = weaponUsage.get(nome) || { nome, abates: 0, dano: 0 }
      current.abates += integer(weapon.abates)
      current.dano += integer(weapon.dano)
      weaponUsage.set(nome, current)
    }
    for (const skill of (row.garena_matchstats_habilidades || [])) {
      const tipo = text(skill.tipo)
      const habilidade = text(skill.habilidade)
      if (!tipo || !habilidade) continue
      const key = `${tipo}:${habilidade}`
      const current = skillUsage.get(key) || { tipo, personagem: text(skill.personagem), habilidade, usos: 0, pickTimes: 0, pickRate: 0 }
      current.usos += integer(skill.usos)
      current.pickTimes += integer(skill.pick_times)
      current.pickRate += integer(skill.pick_rate)
      skillUsage.set(key, current)
    }
  }
  const topWeapon = [...weaponUsage.values()].sort((a, b) => b.abates - a.abates || b.dano - a.dano || a.nome.localeCompare(b.nome))[0]?.nome || ''
  const topSkills = (tipo: string, limit: number) => [...skillUsage.values()]
    .filter((skill) => skill.tipo === tipo)
    .sort((a, b) => b.usos - a.usos || b.pickTimes - a.pickTimes || b.pickRate - a.pickRate || a.habilidade.localeCompare(b.habilidade))
    .slice(0, limit)
  const skillLabel = (skill: any) => [skill?.personagem, skill?.habilidade].filter(Boolean).join(' · ')
  const byFall = new Map<string, { label: string; date: string; abates: number; dano: number; assistencias: number }>()
  for (const row of statsRows) {
    const imported: any = Array.isArray(row.garena_matchstats_importacoes) ? row.garena_matchstats_importacoes[0] : row.garena_matchstats_importacoes
    const key = String(imported?.partida_id || row.importacao_id)
    const current = byFall.get(key) || { label: `P${byFall.size + 1}`, date: String(imported?.concluida_em || ''), abates: 0, dano: 0, assistencias: 0 }
    current.abates += integer(row.abates)
    current.dano += integer(row.dano)
    current.assistencias += integer(row.assistencias)
    byFall.set(key, current)
  }
  const trend = [...byFall.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-8).map(({ label, abates, dano, assistencias }) => ({ label, abates, dano, assistencias }))
  const sampleSize = Math.max(1, aggregate('quedas') || byFall.size || statsRows.length)
  const perMatch = (field: string, divisor = sampleSize) => total(field) / Math.max(1, divisor)

  if (isPlayer) {
    const row = principal
    return {
      label: 'Perfil gamer · dados oficiais', tier: row?.tier || null, score: row?.score || null,
      metrics: [
        { label: 'Abates', value: String(total('abates')) }, { label: 'Dano total', value: compactNumber(total('dano')) },
        { label: 'Assistências', value: String(total('assistencias')) }, { label: 'Headshots', value: String(total('headshots')) },
        { label: 'Sobrevivência', value: `${compactNumber(total('sobrevivencia_segundos'))} s` }, { label: 'Quedas', value: String(aggregate('quedas') || byFall.size) },
      ],
      averages: [
        { label: 'Abates', value: perMatch('abates').toFixed(1) }, { label: 'Dano', value: compactNumber(perMatch('dano')) },
        { label: 'Assistências', value: perMatch('assistencias').toFixed(1) }, { label: 'Gelo', value: perMatch('gel_usado').toFixed(1) },
      ],
      highlights: [
        { label: 'Arma mais usada', value: row?.arma_mais_usada || topWeapon },
        { label: 'Habilidade ativa', value: skillLabel(row?.habilidade_ativa) || skillLabel(topSkills('ativa', 1)[0]) },
        { label: 'Passivas', value: (row?.habilidades_passivas || []).map((item: any) => item.habilidade || item.personagem).filter(Boolean).join(' · ') || topSkills('passiva', 3).map(skillLabel).filter(Boolean).join(' · ') },
        { label: 'Função', value: row?.funcao || '' },
        { label: 'Revives', value: String(total('revives')) }, { label: 'Knockdowns', value: String(total('knockdowns')) },
        { label: 'Paredes de gel', value: String(total('gel_usado')) }, { label: 'Kits médicos', value: String(total('kits_medicos')) },
        { label: 'Granadas', value: String(total('granadas_usadas')) }, { label: 'Distância movida', value: `${compactNumber(total('distancia_movida'))} m` },
        { label: 'Maior abate', value: `${compactNumber(total('distancia_max_abate'))} m` },
      ], trend,
    }
  }

  return {
    label: 'Elenco · dados oficiais', tier: principal?.tier || null, score: principal?.score || null,
    metrics: [
      { label: 'Pontos', value: String(total('pontos')) }, { label: 'Abates', value: String(total('abates')) },
      { label: 'Dano do elenco', value: compactNumber(total('dano')) }, { label: 'Assistências', value: String(total('assistencias')) },
      { label: 'Booyahs', value: String(total('booyahs')) }, { label: 'Quedas', value: String(aggregate('quedas') || byFall.size) },
    ],
    averages: [
      { label: 'Pontos', value: perMatch('pontos').toFixed(1) }, { label: 'Abates', value: perMatch('abates').toFixed(1) },
      { label: 'Dano', value: compactNumber(perMatch('dano')) }, { label: 'Assistências', value: perMatch('assistencias').toFixed(1) },
    ],
    highlights: [
      { label: 'Arma do elenco', value: topWeapon }, { label: 'Ativa predominante', value: skillLabel(topSkills('ativa', 1)[0]) },
      { label: 'Passivas predominantes', value: topSkills('passiva', 3).map(skillLabel).filter(Boolean).join(' · ') }, { label: 'Headshots', value: String(total('headshots')) },
      { label: 'Knockdowns', value: String(total('knockdowns')) }, { label: 'Revives', value: String(total('revives')) },
      { label: 'Paredes de gel', value: String(total('gel_usado')) }, { label: 'Kits médicos', value: String(total('kits_medicos')) },
      { label: 'Granadas', value: String(total('granadas_usadas')) }, { label: 'Distância movida', value: `${compactNumber(total('distancia_movida'))} m` },
      { label: 'Maior abate', value: `${compactNumber(total('distancia_max_abate'))} m` },
    ], trend,
  }
}
