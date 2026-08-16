import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = fs.readFileSync(path.join(root, 'web/features/produtoras/components/ProvisionalTeamsPanel.tsx'), 'utf8')
const route = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/produtoras/components/provisional-teams.css'), 'utf8')

test('96 - gestão individual separa informações, lines e campeonatos sem criar fluxo paralelo', async () => {
  expect(panel).toContain("type ManagerTab = 'dados' | 'lines' | 'campeonatos'")
  expect(panel).toContain('provisional-manager-tabs')
  expect(panel).toContain('Informações')
  expect(panel).toContain('Lines')
  expect(panel).toContain('Campeonatos')
  expect(panel).toContain('LineRosterManager')
})

test('96 - produtora pode completar dados e logo da equipe provisória', async () => {
  expect(route).toContain('email_contato,localidade,cidade,estado,pais,bio')
  expect(route).toContain('patch.email_contato')
  expect(panel).toContain('E-mail de contato')
  expect(panel).toContain('Cidade')
  expect(panel).toContain('Estado')
  expect(panel).toContain('País')
  expect(panel).toContain("uploadPublicFile(file, 'equipe')")
})

test('96 - lines podem ser criadas, editadas, receber logo e ser arquivadas pela API oficial', async () => {
  expect(panel).toContain("method: 'PATCH'")
  expect(panel).toContain("method: 'DELETE'")
  expect(panel).toContain('Salvar line')
  expect(panel).toContain('Arquivar')
  expect(panel).toContain('Logo da line')
  expect(panel).toContain('/api/equipes/${selected.id}/lines')
})

test('96 - campeonato abre a line participante para jogadores, formação e convites', async () => {
  expect(route).toContain('campeonato:campeonato_id(id,nome,logo_url)')
  expect(panel).toContain('Jogadores e convites')
  expect(panel).toContain('gerar convite de jogador diretamente para o campeonato')
  expect(panel).toContain('openLine(line)')
})

test('96 - layout mobile usa as mesmas regras do componente sem override global', async () => {
  expect(css).toContain('.provisional-manager-tabs')
  expect(css).toContain('.provisional-line-editor')
  expect(css).toContain('.provisional-championship-list')
  expect(css).toContain('@media(max-width:700px)')
  expect(panel).toContain("import './provisional-teams.css'")
})
