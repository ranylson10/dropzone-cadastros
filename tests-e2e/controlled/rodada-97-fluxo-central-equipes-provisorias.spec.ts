import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = fs.readFileSync(path.join(root, 'web/features/produtoras/components/ProvisionalTeamsPanel.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/produtoras/components/provisional-teams.css'), 'utf8')

test('97 - central permite buscar rapidamente equipes provisórias por nome tag ou localidade', async () => {
  expect(panel).toContain("const [query, setQuery] = useState('')")
  expect(panel).toContain('Buscar equipe, TAG ou localidade')
  expect(panel).toContain('visibleTeams.map')
  expect(panel).toContain('team.localidade')
})

test('97 - edição de line não abre automaticamente o gerenciador pesado de jogadores', async () => {
  expect(panel).toContain("const [rosterOpen, setRosterOpen] = useState(false)")
  expect(panel).toContain('openLine(line, false)')
  expect(panel).toContain("rosterOpen ? 'Fechar jogadores' : 'Jogadores e convites'")
  expect(panel).toContain('selectedLine && rosterOpen && accessToken')
})

test('97 - acesso pelo campeonato continua abrindo diretamente jogadores e convites', async () => {
  expect(panel).toContain('openLine(line, true)')
  expect(panel).toContain('LineRosterManager')
  expect(panel).toContain('setManagerTab(\'lines\')')
})

test('97 - fechar ou trocar equipe também fecha o gerenciador da line', async () => {
  expect(panel).toContain('setRosterOpen(false)')
  expect(panel).toContain('onBack={() => setRosterOpen(false)}')
})

test('97 - busca e roster usam o css do próprio componente inclusive no mobile', async () => {
  expect(css).toContain('.provisional-toolbar')
  expect(css).toContain('.provisional-search')
  expect(css).toContain('.provisional-roster-wrap')
  expect(css).toContain('@media(max-width:700px)')
  expect(panel).toContain("import './provisional-teams.css'")
})
