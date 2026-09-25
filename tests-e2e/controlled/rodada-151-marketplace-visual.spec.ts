import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const homeCss = read('web/features/home/authenticated-home.css')
const vacancyCard = read('web/features/vacancies/VacancyCard.tsx')
const vacancyCss = read('web/features/vacancies/vacancy-card.css')
const directoryPage = read('web/features/directory/components/DirectoryPage.tsx')
const directory = read('web/features/directory/components/DirectoryListClient.tsx')
const directoryCss = read('web/features/directory/components/championship-directory.css')
const directoryBuilder = read('web/features/directory/championship-directory.ts')
const directoryServer = read('web/features/directory/server.ts')
const vacanciesRoute = read('web/app/api/vagas/route.ts')
const dropZoneHome = read('web/features/dropzone/DropZoneHome.tsx')
const headerCss = read('web/app/header.css')

test.describe('Rodada 151 — marketplace visual', () => {
  test('home passa a abrir como marketplace com busca antes das ferramentas de gestão', () => {
    expect(home).toContain('DROPZONE FREE FIRE')
    expect(home).toContain('Encontre seu próximo campeonato de Free Fire.')
    expect(home).toContain('Buscar copa, sala, liga, produtora ou formato...')
    expect(home).toContain('market-home-search-zone')
    expect(home.indexOf('market-home-search-zone')).toBeLessThan(home.indexOf('market-home-account-strip'))
  })

  test('home usa campeonatos reais da API em vez de catálogo demonstrativo', () => {
    expect(home).toContain("fetch('/api/vagas'")
    expect(home).toContain('setVacancies(items.filter')
    expect(home).toContain('featured.banner_url')
    expect(home).toContain('featured.produtora_nome')
    expect(home).not.toContain('productsData')
    expect(home).not.toContain('Smartphone')
  })

  test('vitrine oferece categorias comerciais adequadas a campeonatos', () => {
    expect(home).toContain("marketHref({ vagas: '1' })")
    expect(home).toContain("marketHref({ gratis: '1' })")
    expect(home).toContain("marketHref({ ordem: 'premio' })")
    expect(home).toContain("marketHref({ ultimas: '1' })")
    expect(home).toContain("marketHref({ hoje: '1' })")
    expect(home).toContain("marketHref({ meus: '1' })")
  })

  test('home tem hero e vitrines de destaque sem esconder acesso ao painel', () => {
    expect(home).toContain('market-home-hero-main')
    expect(home).toContain('Campeonatos em destaque')
    expect(home).toContain('Vagas acabando')
    expect(home).toContain('Maiores premiações')
    expect(home).toContain("label: 'Painel da produtora'")
    expect(home.indexOf('Campeonatos em destaque')).toBeLessThan(home.indexOf('Precisa da sua atenção'))
  })

  test('home e catálogo usam header horizontal enquanto gestão preserva sidebar', () => {
    expect(dropZoneHome).toContain('mainClassName="page marketplace-shell-page"')
    expect(dropZoneHome).toContain("workspaceMode === 'home' ? 'marketplace-shell-page'")
    expect(dropZoneHome).toContain("'page-authenticated'")
    expect(headerCss).toContain('.app-header:has(+ .app-shell-main.marketplace-shell-page)')
    expect(headerCss).toContain('margin-left:0')
  })

  test('página de campeonatos ganhou hero e categorias de marketplace', () => {
    expect(directoryPage).toContain('MARKETPLACE DROPZONE')
    expect(directoryPage).toContain('Compare vagas, preço, premiação e próxima data.')
    expect(directoryPage).toContain('champ-market-feature')
    expect(directoryPage).toContain('champ-market-categories')
    expect(directoryPage).toContain('Vagas abertas')
    expect(directoryPage).toContain('Maior premiação')
  })

  test('busca e filtros por URL suportam a entrada direta das vitrines', () => {
    expect(directory).toContain("params.get('q')")
    expect(directory).toContain("params.get('gratis') === '1'")
    expect(directory).toContain("params.get('hoje') === '1'")
    expect(directory).toContain("params.get('ultimas') === '1'")
    expect(directory).toContain("params.get('ordem')")
    expect(directory).toContain('Buscar campeonato, produtora ou formato')
  })

  test('cards tratam campeonato como oferta de vaga e não como produto genérico', () => {
    expect(vacancyCard).toContain('VAGA A PARTIR DE')
    expect(vacancyCard).toContain('premiação')
    expect(vacancyCard).toContain('vagas livres')
    expect(vacancyCard).toContain('item.produtora_nome')
    expect(vacancyCard).toContain('Garantir vaga')
    expect(vacancyCard).not.toContain('Frete')
    expect(vacancyCard).not.toContain('Avaliação')
  })

  test('API e diretório carregam a identidade real da produtora', () => {
    expect(vacanciesRoute).toContain('produtora_nome')
    expect(vacanciesRoute).toContain('produtora_logo_url')
    expect(directoryServer).toContain('produtora_id')
    expect(directoryBuilder).toContain('producerById')
    expect(directoryBuilder).toContain('producerName:')
    expect(directoryBuilder).toContain('producer.nome, producer.username')
  })

  test('grade mantém densidade de marketplace e adaptação responsiva', () => {
    expect(vacancyCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))')
    expect(directoryCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))!important')
    expect(directoryCss).toContain('grid-template-columns:repeat(3,minmax(0,1fr))!important')
    expect(directoryCss).toContain('grid-template-columns:repeat(2,minmax(0,1fr))!important')
    expect(homeCss).toContain('@media(max-width:760px)')
  })

  test('marketplace prioriza conteúdo comercial e reduz grandes vazios do dashboard', () => {
    expect(homeCss).toContain('.market-home{')
    expect(homeCss).toMatch(/\.market-home-hero\s*\{[\s\S]*?display:grid/)
    expect(homeCss).toMatch(/\.market-home-prize-list\s*\{[\s\S]*?display:grid/)
    expect(homeCss).toContain('--market-accent:#ff6a1f')
    expect(homeCss).toContain('--market-accent-strong:#ff3d5a')
    expect(directoryCss).toContain('.directory-market-page .directory-champ-card-grid{display:grid!important')
  })

  test('marketplace continua separado da captura ao vivo do DPZ Live Engine', () => {
    const marketplaceSources = [home, vacancyCard, directoryPage, directory].join('\n')
    expect(marketplaceSources).not.toContain('dpz_engine_resultados')
    expect(marketplaceSources).not.toContain('/api/desktop/')
    expect(marketplaceSources).not.toContain('SPEC')
  })
})
