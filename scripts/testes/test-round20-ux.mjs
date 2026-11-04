import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const nav = read('web/components/layout/nav.ts')
const header = read('web/components/layout/AppHeader.tsx')
const menu = read('web/components/workspace/WorkspaceMoreMenu.tsx')
const producer = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
const player = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
const manager = read('web/features/dropzone/panels/manager/ManagerPanel.tsx')
const css = read('web/styles/redesign-r20.css')
const layout = read('web/app/layout.tsx')
let count = 0
const check = (label, test) => { assert.ok(test, label); count++ }

for (const [label, href] of [['Início','/'],['Campeonatos','/campeonatos'],['Equipes','/equipes'],['Jogadores','/jogadores']]) {
  check(`Navegação direta: ${label}`, nav.includes(`label: '${label}', href: '${href}'`))
}
for (const href of ['/produtoras','/rank','/agenda','/central-campeonato','/carteira','/afiliados','/lili']) {
  check(`Rota avançada preservada: ${href}`, nav.includes(`href: '${href}'`))
}
const storefront = read('web/components/layout/StorefrontHeader.tsx')
check('Catálogo público mantém quatro destinos diretos', storefront.includes("{ label: 'Jogadores', href: '/jogadores'") && storefront.includes('PRIMARY_NAV.map((item) => <StoreNavLink'))
check('Menu superior conserva funções secundárias e dock abre painéis', storefront.includes("aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}") && storefront.includes('SECONDARY_NAV.map') && storefront.includes('<WorkspacePanelSwitcher'))
check('Catálogo público preserva painel autenticado', storefront.includes('className="dz-menu-account-entry"') && storefront.includes('href={profileHref}'))
check('Header navega pelas quatro áreas e abre painéis no mobile', (header.match(/<Link href="\/(?:"|campeonatos"|equipes"|jogadores")/g)||[]).length >= 4 && header.includes('<WorkspacePanelSwitcher'))
check('Bottom dock usa menu acessível', header.includes('aria-label="Navegação inferior do aplicativo"') && header.includes('aria-expanded={mobileOpen}'))
check('FAB separada das cinco áreas, acessível', header.includes('className="app-action-fab"') && header.includes('aria-label="Abrir ações rápidas"'))
check('Meu painel autenticado acessível', header.includes('className="app-dashboard-entry"') && header.includes('href="/?painel=1"'))
check('Conta e troca de perfis continuam acessíveis no celular', header.includes('app-mobile-account-trigger') && header.includes('setProfileOpen(true)'))
check('Login para visitante permanece no menu', header.includes('className="app-mobile-login"'))
check('Menu avançado é nativo e acessível', menu.includes('<details') && menu.includes('<summary') && menu.includes('aria-current='))
check('Ferramenta avançada fecha após seleção', menu.includes('detailsRef.current.open = false'))
check('Produtora abre campeonatos diretamente e mantém sua gestão explícita', producer.includes("useState<ProducerSection>('campeonatos')") && producer.includes("{ id: 'campeonatos', label: 'Campeonatos'") && producer.includes("label: 'Equipe interna'"))
check('Produtora preserva financeiro/equipe/configurações mediante permissão', producer.includes('canFinanceWorkspace || canCommercialWorkspace') && producer.includes('canManageMembers || canOperateWorkspace') && producer.includes('canAdminWorkspace'))
for (const label of ['Fases e grupos','Equipes','Elencos','Jogos e quedas','Pontuador','Tabelas','Inscrições']) check(`Campeonato: ferramenta ${label}`, producer.includes(`label: '${label}'`))
check('Regras avançadas usam o menu compartilhado', producer.includes('<WorkspaceMoreMenu label="Regras avançadas"') && producer.includes("startEditChampionship(selectedChamp, 'operation')"))
check('Pontuador abre fora do painel com escolha de fase e jogo', producer.includes('openScorerWindow(selectedChamp.id)') && producer.includes('canScoreWorkspace') && read('web/app/campeonatos/[id]/pontuador/page.tsx').includes('<ProducerScoringWorkspace'))
check('Atalho editar usa fluxo existente', producer.includes('onClick={() => startEditChampionship(selectedChamp)}'))
check('Equipe mantém acessíveis elenco, competições, treino e staff', team.includes('label="Ferramentas da equipe"') && team.includes("id: 'treinos'") && team.includes("id: 'staff'") && team.includes("id: 'campeonatos'"))
check('Jogador separa perfil/estatísticas', player.includes("id: 'perfil'") && player.includes("id: 'desempenho'") && player.includes('WorkspaceMoreMenu'))
check('Manager usa contextos de equipe/jogador no painel normal', !read('web/features/dropzone/DropZoneHome.tsx').includes('<ManagerPanel') && read('web/features/dropzone/DropZoneHome.tsx').includes('WorkspaceContextSwitcher'))
check('CSS importado depois dos estilos legados', layout.includes("import '@/styles/redesign-r20.css'"))
check('Mobile tem barra inferior adaptativa', css.includes('grid-template-columns:repeat(5,minmax(0,1fr))') && css.includes('env(safe-area-inset-bottom)'))
check('Microinterações com preferência de redução de movimento', css.includes('@media(prefers-reduced-motion:reduce)') && css.includes('animation:none'))
check('R21 preservada como fase separada', read('docs/redesign/PLANO_DROPZONE_R20_R24.md').includes('R21 — Criar primeiro, configurar depois'))
console.log(`R20: ${count} verificações de navegação e hierarquia aprovadas (estáticas; não substituem E2E).`)
