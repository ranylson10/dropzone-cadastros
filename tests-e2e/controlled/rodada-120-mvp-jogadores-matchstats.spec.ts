import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('MatchStats consolida estatísticas detalhadas no resultado oficial do jogador', async () => {
  const source = read('backend/src/campeonatos/estatisticas/garena-matchstats.service.ts')
  expect(source).toContain('async function persistirResultadosJogadoresOficiais')
  expect(source).toContain("from('campeonato_resultados_jogadores')")
  expect(source).toContain("upsert(officialRows, { onConflict: 'partida_id,campeonato_jogador_id' })")
  expect(source).toContain('dano: Number(row.dano || 0)')
  expect(source).toContain('assistencias: Number(row.assistencias || 0)')
  expect(source).toContain('revives: Number(row.revives || 0)')
})

test('consolidação usa vínculo real de campeonato jogador e equipe', async () => {
  const source = read('backend/src/campeonatos/estatisticas/garena-matchstats.service.ts')
  expect(source).toContain("select('id,campeonato_equipe_id,jogador_id,jogador_temporario_id,equipe_id,line_id,nick,id_jogo')")
  expect(source).toContain('campeonato_jogador_id: row.campeonato_jogador_id')
  expect(source).toContain('campeonato_equipe_id: row.campeonato_equipe_id')
})

test('pontuação oficial da equipe não é recalculada pelos kills individuais', async () => {
  const source = read('backend/src/campeonatos/estatisticas/garena-matchstats.service.ts')
  expect(source).not.toContain("from('campeonato_resultados_equipes').upsert")
  expect(source).not.toContain("from('campeonato_resultados_equipes')\n    .upsert")
})

test('MVP usa MatchStats como fallback para importações antigas já concluídas', async () => {
  const source = read('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
  expect(source).toContain('async function listarMvpGarenaFallback')
  expect(source).toContain("from('garena_matchstats_importacoes')")
  expect(source).toContain("from('garena_matchstats_jogadores')")
  expect(source).toContain('return listarMvpGarenaFallback(campeonatoId, filters)')
})

test('fallback preserva abates dano assistências e revives por jogador', async () => {
  const source = read('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
  for (const field of ['abates', 'dano', 'assistencias', 'revives']) {
    expect(source).toContain(`current.${field} += Number(row.${field} || 0)`)
  }
})
