import fs from 'node:fs'
import path from 'node:path'
import { hasResponsiveCss } from './lib/project-source.mjs'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const checks = []
const check = (label, condition) => checks.push({ label, condition: Boolean(condition) })

const storefront = read('web/components/layout/StorefrontHeader.tsx')
const systemNav = read('web/components/layout/nav.ts')
const vacancies = read('web/app/vagas/page.tsx')
const directoryPage = read('web/features/directory/components/DirectoryPage.tsx')
const directoryClient = read('web/features/directory/components/DirectoryListClient.tsx')
const listRow = read('web/components/championship/ChampionshipListRow.tsx')
const catalogCss = read('web/features/directory/components/championship-directory.css')
const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const dropzoneHome = read('web/features/dropzone/DropZoneHome.tsx')

check('storefront remove aba VAGAS', !storefront.includes("{ label: 'VAGAS', href: '/vagas' }"))
check('atalho de vagas aponta para filtro de Campeonatos', storefront.includes('href="/campeonatos?vagas=1"'))
check('nav global não expõe Vagas como área separada', !systemNav.includes("{ label: 'Vagas abertas', href: '/vagas' }"))
check('/vagas preserva compatibilidade via redirect', vacancies.includes("redirect(`/campeonatos?") && vacancies.includes("params.set('vagas', '1')"))
check('/campeonatos usa o mesmo hero dos diretórios', directoryPage.includes('directory-hero-banner') && directoryPage.includes('directory-championship-page'))
check('vitrine antiga de campeonatos foi removida da página', !directoryPage.includes('ChampionshipMarketplaceIntro') && !directoryPage.includes('champ-market-intro'))
check('catálogo usa ChampionshipListRow', directoryClient.includes('<ChampionshipListRow') && !directoryClient.includes('<ChampionshipCard'))
check('lista mostra vagas, inscrição, premiação e próxima data', ['Vagas', 'Inscrição', 'Premiação', 'Próxima data'].every((label) => listRow.includes(label)))
check('catálogo inteiro usa componente canônico sem linha duplicada', !directoryClient.includes('dz-champ-table-row') && !directoryClient.includes('championshipCardView'))
check('filtros cobrem vagas, premiação e transmissão', directoryClient.includes('openVacancies') && directoryClient.includes('withPrize') && directoryClient.includes('live'))
check('filtros cobrem faixa de inscrição e premiação', ['minPrice', 'maxPrice', 'minPrize', 'maxPrize'].every((field) => directoryClient.includes(field)))
check('filtros cobrem plataforma e servidor', directoryClient.includes('platformOptions') && directoryClient.includes('serverOptions'))
check('favoritos e meus campeonatos continuam filtráveis', directoryClient.includes('favorites') && directoryClient.includes('mine'))
check('escopo de vendedor preserva atribuição comercial', directoryClient.includes('sellerScopeId') && directoryClient.includes("origin = sellerManagerId ? 'vendedor' : 'direto'"))
check('componente de lista possui raiz canônica', listRow.includes('data-championship-list-row'))
check('lista possui layout responsivo dedicado', hasResponsiveCss(catalogCss, '.dz-champ-list-row'))
check('Home continua com ChampionshipCard', home.includes('<ChampionshipCard'))
check('Home não duplica AppHeader sobre StorefrontHeader', dropzoneHome.includes('header="never"') && dropzoneHome.includes("workspaceMode === 'home' ? 'never'"))

console.log('Auditoria R208 — catálogo único de Campeonatos')
for (const item of checks) console.log(`${item.condition ? 'OK ' : 'ERRO'} ${item.label}`)
const failed = checks.filter((item) => !item.condition)
if (failed.length) {
  console.error(`ERRO: ${failed.length} verificação(ões) falharam.`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
