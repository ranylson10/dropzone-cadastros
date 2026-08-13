import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 5 — commerce usa schema real do campeonato', () => {
  test('carrinho lê preço em campeonato_configuracoes e não em campeonatos', () => {
    const source = read('web/app/api/me/commerce/cart/route.ts')
    expect(source).toContain(".from('campeonato_configuracoes')")
    expect(source).toContain(".select('valor_inscricao')")
    expect(source).toContain(".select('id,nome,logo_url,banner_url')")
    expect(source).not.toContain("select('id,valor_inscricao,vagas_livres,total_vagas')")
    expect(source).toContain("params.get('campeonato_id')")
  })

  test('favoritos lê dados comerciais em campeonato_configuracoes e aceita estado explícito', () => {
    const source = read('web/app/api/me/commerce/wishlist/route.ts')
    expect(source).toContain(".from('campeonato_configuracoes')")
    expect(source).toContain("typeof body.favorito === 'boolean'")
    expect(source).toContain('if (favorito && !existing.data)')
    expect(source).toContain('if (!favorito && existing.data)')
    expect(source).not.toContain('PGRST204')
    expect(source).not.toContain('42703')
  })

  test('erro de coluna não é mais tratado como migration ausente', () => {
    const cart = read('web/app/api/me/commerce/cart/route.ts')
    const wish = read('web/app/api/me/commerce/wishlist/route.ts')
    expect(cart).not.toContain('PGRST204')
    expect(cart).not.toContain('42703')
    expect(wish).not.toContain('PGRST204')
    expect(wish).not.toContain('42703')
  })
})
