import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const norm = (value) => value.replaceAll('\\', '/')
let failures = 0
let checks = 0

function check(label, ok, detail = '') {
  checks += 1
  if (ok) console.log(`OK  ${label}${detail ? ` — ${detail}` : ''}`)
  else {
    failures += 1
    console.log(`ERRO ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(rel))
    else out.push(rel)
  }
  return out
}

console.log('Auditoria R204 — marketplace/commerce integrado')

const required = [
  'web/features/commerce/CommerceProvider.tsx',
  'web/features/commerce/commerce-items.ts',
  'web/features/commerce/local-commerce.ts',
  'web/features/commerce/index.ts',
]
for (const file of required) check(`existe ${file}`, exists(file))

const layout = read('web/app/layout.tsx') + read('web/components/layout/ApplicationRuntime.tsx')
const provider = read('web/features/commerce/CommerceProvider.tsx')
const commerceItems = read('web/features/commerce/commerce-items.ts')
const localCommerce = read('web/features/commerce/local-commerce.ts')
const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const directory = read('web/features/directory/components/DirectoryListClient.tsx')
const vacancy = read('web/features/vacancies/VacancyCard.tsx')
const vacanciesPage = read('web/app/vagas/page.tsx')
const sellerPage = read('web/app/vendedores/[managerId]/page.tsx')
const cartPage = read('web/app/carrinho/page.tsx')
const cartApi = read('web/app/api/me/commerce/cart/route.ts')
const checkoutApi = read('web/app/api/me/commerce/cart/checkout/route.ts')

check('layout monta CommerceProvider uma única vez', (layout.match(/<CommerceProvider>/g) || []).length === 1)
check('CommerceProvider expõe useCommerce', /export function useCommerce\(/.test(provider))
check('provider integra carrinho local e remoto', /getCartItems\(\)/.test(provider) && /\/api\/me\/commerce\/cart/.test(provider))
check('provider integra favoritos local e remoto', /getWishlistItems\(\)/.test(provider) && /\/api\/me\/commerce\/wishlist/.test(provider))
check('provider sincroniza estado guest após login', /syncGuestState/.test(provider) && /cartToSync/.test(provider) && /wishlistToSync/.test(provider))
check('provider preserva origem comercial', /origem: item\.origin \|\| 'direto'/.test(provider))
check('provider preserva vendedor no carrinho', /vendedor_manager_id: item\.sellerManagerId \|\| null/.test(provider))
check('modelo local guarda atribuição do vendedor', /sellerManagerId\?: string \| null/.test(localCommerce) && /origin\?: CommerceOrigin/.test(localCommerce))
check('normalizador de campeonato é compartilhado', /export function championshipCommerceItem/.test(commerceItems))
check('Home usa useCommerce', /useCommerce\(\)/.test(home) && !/getCartItems|getWishlistItems|addToCart|removeFromCart/.test(home))
check('diretório usa useCommerce', /useCommerce\(\)/.test(directory) && !/getCartItems|getWishlistItems|addToCart|removeFromCart/.test(directory))
check('VacancyCard usa o mesmo estado de comércio', /useCommerce\(\)/.test(vacancy) && /toggleCart/.test(vacancy) && /toggleWishlist/.test(vacancy))
check('carrinho usa o mesmo provider', /useCommerce\(\)/.test(cartPage) && !/getCartItems|setCartQuantity|removeFromCart/.test(cartPage))
check('/campeonatos preserva atribuição de vendedor no carrinho', /sellerScopeId/.test(directory) && /sellerManagerId/.test(directory) && /origin = sellerManagerId \? 'vendedor' : 'direto'/.test(directory))
check('/vagas virou alias para /campeonatos com filtro de vagas', /redirect\(`\/campeonatos\?/.test(vacanciesPage) && /params\.set\('vagas', '1'\)/.test(vacanciesPage))
check('portfólio do vendedor atribui comissão', /origin="vendedor"/.test(sellerPage) && /sellerManagerId=\{managerId\}/.test(sellerPage))
check('API do carrinho persiste vendedor e origem', /vendedor_manager_id/.test(cartApi) && /origem/.test(cartApi))
check('checkout usa vendedor salvo no item', /vendedorManagerId: item\.vendedor_manager_id \|\| null/.test(checkoutApi))

const files = walk('web').filter((file) => /\.(ts|tsx)$/.test(file))
const offenders = []
for (const file of files) {
  const n = norm(file)
  if (n === 'web/features/commerce/CommerceProvider.tsx' || n === 'web/features/commerce/local-commerce.ts') continue
  const source = read(n)
  if (/features\/commerce\/local-commerce/.test(source)) offenders.push(n)
}
check('nenhuma página importa local-commerce diretamente', offenders.length === 0, offenders.join(', '))

const directOps = []
for (const file of files) {
  const n = norm(file)
  if (n === 'web/features/commerce/CommerceProvider.tsx' || n === 'web/features/commerce/local-commerce.ts') continue
  const source = read(n)
  if (/\b(getCartItems|getWishlistItems|addToCart|removeFromCart|setCartQuantity)\s*\(/.test(source)) directOps.push(n)
}
check('operações de carrinho/favorito passam pela camada única', directOps.length === 0, directOps.join(', '))

if (failures) {
  console.log(`\nFalhou: ${failures} verificação(ões).`)
  process.exit(1)
}
console.log(`\nOK: ${checks}/${checks} verificações passaram. Marketplace usa uma única camada de comércio.`)
