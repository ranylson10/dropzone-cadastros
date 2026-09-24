import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

test.describe('Rodada 139 — descoberta de campeonatos, vagas e compra', () => {
  test('campeonatos é a porta principal para descoberta e vagas abertas', () => {
    const header = read('web/components/layout/AppHeader.tsx')
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')

    expect(header).toContain("href: '/campeonatos?vagas=1'")
    expect(home).toContain('href="/campeonatos?vagas=1"')
    expect(home).toContain('`/campeonatos/${encodeURIComponent(target.id)}?comprar=1`')
  })

  test('diretório continua reconhecido como campeonatos mesmo quando a lista está vazia', () => {
    const page = read('web/features/directory/components/DirectoryPage.tsx')
    const client = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(page).toContain('<DirectoryListClient items={items} kind={kind} />')
    expect(client).toContain("kind === 'campeonatos'")
  })

  test('vagas abertas viram filtro principal e podem ser abertas por URL', () => {
    const client = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(client).toContain('openVacancies: boolean')
    expect(client).toContain("params.get('vagas') === '1'")
    expect(client).toContain('Vagas abertas')
    expect(client).toContain('if (filters.openVacancies && free <= 0) return false')
  })

  test('filtro Meus aparece apenas para usuário autenticado', () => {
    const client = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(client).toContain('setAuthenticated(Boolean(accessToken))')
    expect(client).toContain("{authenticated ? <button type=\"button\"")
    expect(client).toContain(">Meus</button> : null}")
  })

  test('cards mostram dados essenciais antes da decisão de compra', () => {
    const client = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(client).toContain('<small>por vaga</small>')
    expect(client).toContain('Inscrições até')
    expect(client).toContain('Próximo jogo')
    expect(client).toContain('Sua equipe participa')
    expect(client).toContain("price > 0 ? 'Comprar vaga' : 'Ver inscrição'")
  })

  test('preço diferencia grátis de valor sob consulta', () => {
    const client = read('web/features/directory/components/DirectoryListClient.tsx')
    const modal = read('web/features/billing/BuyVacancyModal.tsx')

    expect(client).toContain("return 'Sob consulta'")
    expect(client).toContain("if (number <= 0) return 'Grátis'")
    expect(modal).toContain("isFree ? 'Inscrição gratuita'")
    expect(modal).toContain('A inscrição é gratuita.')
  })

  test('compra pode ser aberta direto do catálogo e fechada sem sujar a URL', () => {
    const client = read('web/features/directory/components/DirectoryListClient.tsx')
    const detail = read('web/features/directory/components/ChampionshipPublicView.tsx')

    expect(client).toContain('const buyHref = `${championshipHref}?comprar=1`')
    expect(detail).toContain("params.get('comprar') === '1'")
    expect(detail).toContain("url.searchParams.delete('comprar')")
    expect(detail).toContain('onClose={closeBuyModal}')
  })

  test('campeonato lotado não apresenta ação de compra', () => {
    const detail = read('web/features/directory/components/ChampionshipPublicView.tsx')
    const client = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(detail).toContain('(enrollment?.vagas_livres == null || Number(enrollment.vagas_livres) > 0)')
    expect(client).toContain('<span className="directory-champ-cart-action is-disabled">Sem vagas</span>')
  })

  test('mobile usa uma coluna e mantém CTA de inscrição acessível', () => {
    const directoryCss = read('web/features/directory/components/championship-directory.css')
    const publicCss = read('web/features/directory/components/championship-public.css')
    const detail = read('web/features/directory/components/ChampionshipPublicView.tsx')

    expect(directoryCss).toContain('.directory-market-page .directory-champ-card-grid{grid-template-columns:1fr;gap:8px}')
    expect(publicCss).toContain('.champ-public-mobile-enroll')
    expect(publicCss).toContain('position:fixed')
    expect(detail).toContain('aria-label="Ação de inscrição"')
  })

  test('rota legada de vagas continua disponível para links de vendedor e produtora', () => {
    expect(exists('web/app/vagas/page.tsx')).toBeTruthy()
    const producer = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const manager = read('web/features/dropzone/panels/manager/ManagerPanel.tsx')

    expect(producer).toContain('/vagas?produtora=')
    expect(manager).toContain('/vagas?vendedor=')
  })
})
