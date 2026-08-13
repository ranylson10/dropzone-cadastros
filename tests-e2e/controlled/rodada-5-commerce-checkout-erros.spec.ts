import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 5 — checkout não mascara erros do banco', () => {
  test('migration ausente só é reportada para tabelas de commerce realmente ausentes', () => {
    const checkout = read('web/app/api/me/commerce/cart/checkout/route.ts')
    expect(checkout).toContain("['42P01', 'PGRST205'].includes(code)")
    expect(checkout).toContain('/commerce_carrinhos|commerce_carrinho_itens/i.test(message)')
    expect(checkout).not.toContain('PGRST204')
    expect(checkout).not.toContain('42703')
    expect(checkout).not.toContain('Rode a migration 20260808_commerce_cart_wishlist.sql.')
    expect(checkout).toContain('code: error?.code || null')
  })
})
