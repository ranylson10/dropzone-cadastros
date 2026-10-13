import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const homeCss = read('web/features/home/authenticated-home.css')
const homeConfig = read('web/features/home/home-config.ts')
const homeAdmin = read('web/features/admin/HomePageEditor.tsx')
const vacancyCard = read('web/features/vacancies/VacancyCard.tsx')
const vacancyCss = read('web/features/vacancies/vacancy-card.css')
const directoryPage = read('web/features/directory/components/DirectoryPage.tsx')
const directory = read('web/features/directory/components/DirectoryListClient.tsx')
const directoryCss = read('web/features/directory/components/championship-directory.css')
const directoryBuilder = read('web/features/directory/championship-directory.ts')
const directoryServer = read('web/features/directory/server.ts')
const vacanciesRoute = read('web/app/api/vagas/route.ts')
const dropZoneHome = read('web/features/dropzone/DropZoneHome.tsx')


test.describe('Rodada 151 — marketplace visual', () => {
  test('home segue a composição storefront de referência sem misturar dashboard', () => {
    expect(home).toContain('store-home-topbar')
    expect(home).toContain('store-home-header')
    expect(home).toContain('store-home-hero')
    expect(home).toContain('store-home-benefits')
    expect(home).toContain('store-home-categories')
    expect(home).toContain('store-home-products')
    expect(home).toContain('store-home-promos')
    expect(home).toContain('store-home-newsletter')
    expect(home).toContain('store-home-footer')
    expect(home).not.toContain('market-home-account-strip')
    expect(home).not.toContain('market-home-task-grid')
  })

  test('home continua usando campeonatos reais da API', () => {
    expect(home).toContain("fetch('/api/vagas'")
    expect(home).toContain('vacancyData.announcements')
    expect(home).toContain('item.banner_url || item.logo_url')
    expect(home).toContain('item.produtora_nome')
    expect(home).not.toContain('productsData')
    expect(home).not.toContain('Smartphone')
  })

  test('vitrine configurável possui 3 banners, 6 categorias e 2 promos', () => {
    expect(homeConfig).toContain('hero_slides: [')
    expect(homeConfig).toContain("title: 'COPAS'")
    expect(homeConfig).toContain("title: 'VAGAS ABERTAS'")
    expect(homeConfig).toContain('promos: [')
    expect(homeAdmin).toContain('Banner principal')
    expect(homeAdmin).toContain('Categorias')
    expect(homeAdmin).toContain('Banners inferiores')
    expect(homeAdmin).toContain("uploadPublicFile(file, 'site')")
  })

  test('home usa header próprio somente na vitrine e preserva header do painel', () => {
    expect(dropZoneHome).toContain('storefront-shell-page')
    expect(dropZoneHome).toContain("workspaceMode === 'home' ? 'never'")
    expect(dropZoneHome).toContain("workspaceMode === 'home' ? 'storefront-home-shell' : 'shell panel-workspace-shell'")
    expect(dropZoneHome).toContain("'page-authenticated'")
  })

  test('página de campeonatos mantém hero e categorias do marketplace', () => {
    expect(directoryPage).toContain('MARKETPLACE DROPZONE')
    expect(directoryPage).toContain('Compare vagas, preço, premiação e próxima data.')
    expect(directoryPage).toContain('champ-market-feature')
    expect(directoryPage).toContain('champ-market-categories')
    expect(directoryPage).toContain('Vagas abertas')
    expect(directoryPage).toContain('Maior premiação')
  })

  test('busca e filtros por URL continuam suportando entrada direta', () => {
    expect(directory).toContain("params.get('q')")
    expect(directory).toContain("params.get('gratis') === '1'")
    expect(directory).toContain("params.get('hoje') === '1'")
    expect(directory).toContain("params.get('ultimas') === '1'")
    expect(directory).toContain("params.get('ordem')")
    expect(directory).toContain('Buscar campeonato, produtora ou formato')
  })

  test('cards do catálogo continuam tratando campeonato como oferta de vaga', () => {
    expect(vacancyCard).toContain('VAGA A PARTIR DE')
    expect(vacancyCard).toContain('premiação')
    expect(vacancyCard).toContain('vagas livres')
    expect(vacancyCard).toContain('item.produtora_nome')
    expect(vacancyCard).toContain('Garantir vaga')
  })

  test('API e diretório carregam a identidade real da produtora', () => {
    expect(vacanciesRoute).toContain('produtora_nome')
    expect(vacanciesRoute).toContain('produtora_logo_url')
    expect(directoryServer).toContain('produtora_id')
    expect(directoryBuilder).toContain('producerById')
    expect(directoryBuilder).toContain('producerName:')
  })

  test('grade mantém densidade de marketplace e adaptação responsiva', () => {
    expect(vacancyCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))')
    expect(directoryCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))!important')
    expect(homeCss).toContain('grid-template-columns:repeat(6,minmax(0,1fr))')
    expect(homeCss).toContain('@media(max-width:760px)')
  })

  test('home segue base branca/preta e acento verde da referência', () => {
    expect(homeCss).toContain('--store-black:#0d0d0c')
    expect(homeCss).toContain('--store-accent:#c7e900')
    expect(homeCss).toContain('.store-home-topbar')
    expect(homeCss).toContain('.store-home-footer')
  })

  test('marketplace continua separado da captura ao vivo do DPZ Live Engine', () => {
    const marketplaceSources = [home, vacancyCard, directoryPage, directory].join('\n')
    expect(marketplaceSources).not.toContain('dpz_engine_resultados')
    expect(marketplaceSources).not.toContain('/api/desktop/')
    expect(marketplaceSources).not.toContain('SPEC')
  })
})
