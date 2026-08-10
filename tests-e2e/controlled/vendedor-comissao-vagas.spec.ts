import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

test.describe('Comissão de venda de vagas — contrato controlado', () => {
  test('produtora define até 20%, vendedor enxerga e split usa percentual do vínculo', async () => {
    const migration = read('database/migrations/20260807_vendedor_comissao_vagas.sql')
    const payments = read('backend/src/billing/payments.ts')
    const purchase = read('backend/src/billing/vacancy-purchase.ts')
    const producerApi = read('web/app/api/produtora/vendedores/route.ts')
    const producerPanel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const sellerApi = read('web/app/api/vendedores/[managerId]/campeonatos/route.ts')
    const sellerPanel = read('web/features/dropzone/panels/manager/ManagerVendasView.tsx')

    await test.step('Banco guarda comissão por vínculo e bloqueia acima de 20%', async () => {
      expect(migration).toContain('campeonato_vendedores')
      expect(migration).toContain('comissao_bps integer')
      expect(migration).toContain('comissao_bps >= 0 and comissao_bps <= 2000')
      expect(migration).toContain('manager_comissao_bps')
    })

    await test.step('Produtora envia e salva percentual da comissão', async () => {
      expect(producerApi).toContain('sellerCommissionBps')
      expect(producerApi).toContain('pode ser no máximo 20%')
      expect(producerApi).toContain('comissao_percentual')
      expect(producerApi).toContain('comissao_bps: comissaoBps')
      expect(producerPanel).toContain('sellerComissao')
      expect(producerPanel).toContain('mgrComissao')
      expect(producerPanel).toContain('Comissão de venda (%)')
      expect(producerPanel).toContain('comissao_percentual: sellerComissao')
      expect(producerPanel).toContain('comissao_percentual: mgrComissao')
    })

    await test.step('Vendedor vê comissão liberada por campeonato', async () => {
      expect(sellerApi).toContain('comissao_bps')
      expect(sellerPanel).toContain('comissao_bps?: number | null')
      expect(sellerPanel).toContain('formatCommission')
      expect(sellerPanel).toContain('Comissão desta vaga')
    })

    await test.step('Compra de vaga carrega comissão do vínculo para o split financeiro', async () => {
      expect(purchase).toContain("select('manager_id,manager_auth_user_id,status,comissao_bps')")
      expect(purchase).toContain('vendedorCommissionBps')
      expect(purchase).toContain('comissao_vendedor_bps')
      expect(payments).toContain('meta.vendedor_bps ?? meta.comissao_vendedor_bps')
      expect(payments).toContain('Math.max(0, Math.min(2000')
      expect(payments).toContain('bps_vendedor: effectiveSellerBps')
    })
  })
})
