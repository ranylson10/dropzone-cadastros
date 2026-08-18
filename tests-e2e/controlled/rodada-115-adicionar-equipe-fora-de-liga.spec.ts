import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('campeonato comum não consulta colunas exclusivas de Liga', async () => {
  const source = read('web/app/api/campeonatos/[id]/equipes/route.ts')
  const start = source.indexOf('async function loadLigaConfig')
  const end = source.indexOf('type LigaSeasonSuggestionCandidate', start)
  const block = source.slice(start, end)

  expect(block).toContain(".from('campeonatos')")
  expect(block).toContain(".select('tipo')")
  expect(block).toContain("!== 'liga') return null")
  expect(block).toContain(".select('liga_nome_agrupamento,liga_divisoes')")

  const typeCheck = block.indexOf("!== 'liga') return null")
  const ligaColumns = block.indexOf(".select('liga_nome_agrupamento,liga_divisoes')")
  expect(typeCheck).toBeGreaterThan(-1)
  expect(ligaColumns).toBeGreaterThan(typeCheck)
})

test('erro real do Supabase continua preservado no POST', async () => {
  const source = read('web/app/api/campeonatos/[id]/equipes/route.ts')
  expect(source).toContain("apiErrorMessage(error, 'Erro ao adicionar line.')")
})
