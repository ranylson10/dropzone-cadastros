import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname, '../..')
const read = (file:string) => fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — produtora privada e vendedores por campeonato', () => {
  test('usa o painel nativo e a API oficial para liberar/remover vendedores dos campeonatos', async () => {
    const screen = read('app/src/screens/ProducerOverviewScreen.tsx')
    const api = read('app/src/lib/api.ts')
    const route = read('web/app/api/produtora/vendedores/route.ts')

    expect(screen).toContain('CENTRAL DA PRODUTORA')
    expect(screen).toContain('Gerenciar campeonatos')
    expect(screen).toContain('Vendedor liberado')
    expect(screen).toContain('Sem acesso comercial')
    expect(screen).toContain('toggleSellerChampionship')
    expect(screen).toContain('attachProducerSellerToChampionship')
    expect(screen).toContain('detachProducerSellerFromChampionship')

    expect(api).toContain('attachProducerSellerToChampionship:')
    expect(api).toContain("action:'attach'")
    expect(api).toContain('detachProducerSellerFromChampionship:')
    expect(api).toContain("action:'detach'")
    expect(api).toContain("'/api/produtora/vendedores'")

    expect(route).toContain("if (action === 'attach')")
    expect(route).toContain("if (action === 'detach')")
    expect(route).toContain("from('campeonato_vendedores')")
    expect(route).toContain("from('produtora_vendedores')")
    expect(route).toContain('requireProdutoraAccount')

    expect(screen).not.toContain('WebView')
  })
})
