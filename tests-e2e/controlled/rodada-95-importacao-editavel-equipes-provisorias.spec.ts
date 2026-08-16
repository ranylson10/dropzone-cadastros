import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = fs.readFileSync(path.join(root, 'web/features/produtoras/components/ProvisionalTeamsPanel.tsx'), 'utf8')
const route = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/produtoras/components/provisional-teams.css'), 'utf8')

 test('95 - colagem de planilha ignora cabeçalho comum e continua aceitando tabulação', async () => {
  expect(panel).toContain("line.includes('\\t')")
  expect(panel).toContain("normalizedName === 'nome'")
  expect(panel).toContain("normalizedName === 'nome da equipe'")
  expect(panel).toContain("normalizedTag === 'tag'")
})

test('95 - prévia do lote pode ser corrigida e ter linhas removidas antes de salvar', async () => {
  expect(panel).toContain('updateBulkRow')
  expect(panel).toContain('removeBulkRow')
  expect(panel).toContain('provisional-preview editable')
  expect(panel).toContain('Edite a prévia se a planilha precisar de correção.')
  expect(css).toContain('.provisional-preview.editable input')
  expect(css).toContain('.provisional-remove-row')
})

test('95 - cadastro continua sendo uma única confirmação para todo o lote', async () => {
  expect(panel).toContain('body: JSON.stringify({ equipes: bulkRows })')
  expect(panel).toContain('Criar {bulkRows.length')
  expect(panel).toContain('Nada é salvo até você confirmar.')
})

test('95 - edição não permite quebrar constraint obrigatória de nome e TAG', async () => {
  expect(panel).toContain("!String(draft.nome || '').trim()")
  expect(panel).toContain("!String(draft.tag || '').trim()")
  expect(route).toContain("TAG da equipe é obrigatória.")
  expect(panel).toContain('TAG *')
})
