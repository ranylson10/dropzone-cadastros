import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('formulário mostra progresso e confirmação antes de concluir a criação', () => {
  const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')

  expect(source).toContain("'idle' | 'preparing' | 'saving' | 'success'")
  expect(source).toContain("setCreateStatus('preparing')")
  expect(source).toContain("setCreateStatus('saving')")
  expect(source).toContain("setCreateStatus('success')")
  expect(source).toContain('Campeonato criado!')
  expect(source).toContain('championship-create-progress')
  expect(source).toContain('onCreateSuccess?.(result)')
})

test('painel da produtora fecha o formulário só após a animação de sucesso', () => {
  const source = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

  expect(source).toContain('onCreateSuccess={(result) => {')
  expect(source).toContain('setShowCreateChamp(false)')
  expect(source).toContain('setCreatedChampAction(result as DropZoneRow)')
})

test('criação pela Lili usa o mesmo fluxo visual', () => {
  const source = read('web/components/lili/LiliChampionshipHub.tsx')

  expect(source).toContain('onCreateSuccess={() => {')
  expect(source).toContain('setShowCreateChampionship(false)')
})

test('feedback visual possui barra, estado de sucesso e adaptação mobile', () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.championship-create-status{')
  expect(css).toContain('.championship-create-progress{')
  expect(css).toContain('@keyframes championshipCreateSuccess')
  expect(css).toContain('.championship-create-status-card{')
})
