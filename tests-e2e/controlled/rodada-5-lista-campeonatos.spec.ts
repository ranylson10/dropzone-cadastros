import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ruleBodies = (css: string, selector: string) => {
  const matcher = new RegExp(`${escaped(selector)}\\s*\\{([^}]*)\\}`, 'g')
  return [...css.matchAll(matcher)].map((match) => match[1].replace(/\s+/g, ' ').trim())
}
const expectRule = (css: string, selector: string, declarations: string[]) => {
  const bodies = ruleBodies(css, selector)
  expect(bodies.length, `regra ${selector} não encontrada`).toBeGreaterThan(0)
  expect(bodies.some((body) => declarations.every((item) => body.includes(item)))).toBeTruthy()
}

test.describe('Rodada 5 — lista de campeonatos', () => {
  test('campeonatos deixa de usar hero publicitário e começa pela tarefa do usuário', () => {
    const page = source('web/features/directory/components/DirectoryPage.tsx')
    expect(page).toContain('className="champ-directory-heading"')
    expect(page).toContain('<h1>Campeonatos</h1>')
    expect(page).toContain('Encontre a competição certa e garanta sua vaga.')
    expect(page).toContain("kind === 'campeonatos' ? 'directory-market-page' : ''")
  })

  test('busca, filtros e comércio ficam compactos e sem caixas de dashboard', () => {
    const list = source('web/features/directory/components/DirectoryListClient.tsx')
    expect(list).toContain('className="champ-directory-tools"')
    expect(list).toContain('placeholder="Buscar campeonato"')
    expect(list).toContain('className="directory-market-cart-link"')
    expect(list).toContain('className="directory-market-tool directory-wishlist-preview"')
    expect(list).toContain('className="directory-create-championship"')
    expect(list).toContain("/?painel=1&perfil=produtora&acao=criar-campeonato")
    expect(list).toContain('className="directory-market-more"')
    expect(list).not.toContain('className="directory-commerce-strip"')
  })

  test('card remove métricas em mini caixas e mantém ação principal clara', () => {
    const list = source('web/features/directory/components/DirectoryListClient.tsx')
    expect(list).toContain('className="directory-champ-facts"')
    expect(list).toContain("'Garantir vaga'")
    expect(list).toContain('Ver campeonato')
    expect(list).not.toContain('className="directory-champ-metrics"')
  })

  test('carrinho e favoritos respondem no clique e persistem com intenção explícita', () => {
    const list = source('web/features/directory/components/DirectoryListClient.tsx')
    const cartApi = source('web/app/api/me/commerce/cart/route.ts')
    const wishlistApi = source('web/app/api/me/commerce/wishlist/route.ts')
    expect(list).toContain('const handleCartToggle = async')
    expect(list).toContain('campeonato_id=${encodeURIComponent(item.id)}')
    expect(list).toContain('favorito: shouldFavorite')
    expect(list).toContain("className={`directory-champ-cart-icon ${isInCart ? 'active' : ''}`}")
    expect(list).toContain("aria-label={isInCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}")
    expect(list).toContain('setCommerceError(payload?.error')
    expect(cartApi).toContain("const campeonatoId = String(params.get('campeonato_id')")
    expect(cartApi).toContain('quantidade,')
    expect(cartApi).not.toContain('Number(existing.quantidade || 1) + quantidade')
    expect(wishlistApi).toContain("const favorito = typeof body.favorito === 'boolean' ? body.favorito : true")
    expect(wishlistApi).toContain('if (favorito) {')
    expect(wishlistApi).toContain("if (error && error.code !== '23505') throw error")
    expect(wishlistApi).toContain('if (!favorito) {')
  })

  test('estilo do diretório fica isolado em uma única folha e não continua duplicado no globals', () => {
    const css = source('web/features/directory/components/championship-directory.css')
    const globals = source('web/app/globals.css')
    expect(css).toContain('Rodada 5 — diretório de campeonatos: uma fonte de estilo')
    expect(globals).not.toContain('Filtros comerciais do diretorio de campeonatos')
    expect(globals).not.toContain('Diretório de campeonatos em formato de cards comerciais')
    expect(globals).not.toContain('.directory-champ-card-grid{')
  })

  test('mobile usa quase toda a largura e lista campeonatos em linhas compactas', () => {
    const css = source('web/features/directory/components/championship-directory.css')
    expectRule(css, '.directory-champ-card-grid', ['display:grid', 'grid-template-columns:repeat(auto-fill,minmax(285px,1fr))'])
    expect(css).toContain('.directory-champ-card-grid{grid-template-columns:1fr;gap:7px;width:calc(100% - 20px)}')
    expect(css).toContain('.directory-champ-card{display:grid;grid-template-columns:96px minmax(0,1fr);min-height:126px;border-radius:8px}')
    expect(css).toContain('.champ-directory-tools{grid-template-columns:minmax(0,1fr) auto auto auto;width:calc(100% - 20px);gap:5px;margin-bottom:8px}')
  })
})
