import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Commerce — carrinho e favoritos persistidos', () => {
  test('banco, APIs, web e app ficam vinculados por usuário', async () => {
    const migration = read('database/migrations/20260808_commerce_cart_wishlist.sql')
    const cartApi = read('web/app/api/me/commerce/cart/route.ts')
    const wishlistApi = read('web/app/api/me/commerce/wishlist/route.ts')
    const webList = read('web/features/directory/components/DirectoryListClient.tsx')
    const appApi = read('app/src/lib/api.ts')
    const appCommerce = read('app/src/lib/commerce.ts')
    const appVacancies = read('app/src/screens/VacanciesScreen.tsx')

    expect(migration).toContain('commerce_carrinhos')
    expect(migration).toContain('commerce_carrinho_itens')
    expect(migration).toContain('commerce_favoritos')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('auth.uid() = auth_user_id')
    expect(migration).toContain('references public.campeonatos')

    expect(cartApi).toContain('getBearerUser')
    expect(cartApi).toContain('getOrCreateCart')
    expect(cartApi).toContain('commerce_carrinho_itens')
    expect(cartApi).toContain('needs_migration')
    expect(wishlistApi).toContain('commerce_favoritos')
    expect(wishlistApi).toContain('.delete()')
    expect(wishlistApi).toContain('.insert({ auth_user_id: user.id')
    expect(wishlistApi).toContain('getBearerUser')

    expect(webList).toContain('/api/me/commerce/cart')
    expect(webList).toContain('/api/me/commerce/wishlist')
    expect(webList).toContain('Authorization: `Bearer ${accessToken}`')
    expect(webList).toContain('commerceItemFromApi')

    expect(appApi).toContain('commerceCart')
    expect(appApi).toContain('addCommerceCart')
    expect(appApi).toContain('commerceWishlist')
    expect(appApi).toContain('toggleCommerceWishlist')
    expect(appCommerce).toContain('mobileCommerceFromApi')
    expect(appVacancies).toContain('mobileApi.addCommerceCart')
    expect(appVacancies).toContain('mobileApi.toggleCommerceWishlist')
  })
})
