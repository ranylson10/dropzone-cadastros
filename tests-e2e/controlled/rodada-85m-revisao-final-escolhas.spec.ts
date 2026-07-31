import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test('rodada 85M preserva consistência e estados locais das escolhas', async () => {
  const api = read('web/app/api/campeonatos/[id]/escolha-grupo/route.ts')
  const central = read('web/components/campeonatos/ChampionshipCentral.tsx')

  expect(api).toContain("slot_numero: participation.slot_numero || null")
  expect(api).toContain("status: 'ocupado' }).eq('id', oldSlotId")
  expect(api).toContain("grupo_id: null, slot_id: null, slot_numero: null")
  expect(central).toContain("participationId: string; kind: 'cancel' | 'restore'")
  expect(central).toContain("choice.blocks.some")
  expect(central).toContain("choiceAction?.participationId === row.id")
  expect(central).toContain('Nenhum grupo ou slot é definido automaticamente')
})
