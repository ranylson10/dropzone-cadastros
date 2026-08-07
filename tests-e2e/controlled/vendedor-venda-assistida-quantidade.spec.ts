import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

test.describe('Venda assistida do vendedor — contrato controlado', () => {
  test('vendedor gera cobrança nova por quantidade e não preenche vaga manualmente', async () => {
    const route = read('web/app/api/vendedores/[managerId]/vendas/route.ts')
    const view = read('web/features/dropzone/panels/manager/ManagerVendasView.tsx')
    const billing = read('backend/src/billing/vacancy-purchase.ts')
    const claimPage = read('web/app/vagas/compra/[token]/page.tsx')

    await test.step('API força uma compra nova e registra quantidade de vagas', async () => {
      expect(route).toContain('quantidade_vagas')
      expect(route).toContain('forceNew: true')
      expect(route).toContain('flexibleCheckout: true')
      expect(route).toContain('Pagamento de ${quantity} vaga')
      expect(route).toContain('este link libera ${quantity} inscrição')
      expect(route).not.toContain("throw new Error('Informe o CPF/CNPJ do comprador")
      expect(route).not.toContain("throw new Error('Informe o WhatsApp do comprador")
    })

    await test.step('Painel do vendedor remove preenchimento direto e pede só referência + quantidade', async () => {
      expect(view).toContain('saleQuantity')
      expect(view).toContain('Referência da venda')
      expect(view).toContain('Quantidade de vagas')
      expect(view).toContain('Gerar venda')
      expect(view).not.toContain('buyerWhatsapp')
      expect(view).not.toContain('buyerEmail')
      expect(view).not.toContain('buyerCpf')
      expect(view).not.toContain('cpf_cnpj')
      expect(view).not.toContain('>Preencher<')
    })

    await test.step('Link interno de compra também oferece saída para o checkout seguro', async () => {
      expect(claimPage).toContain('externalPaymentUrl')
      expect(claimPage).toContain('Abrir pagamento seguro')
    })

    await test.step('Backend reserva e consome o link conforme quantidade comprada', async () => {
      expect(billing).toContain('quantity?: number')
      expect(billing).toContain('forceNew?: boolean')
      expect(billing).toContain('vagas_usadas')
      expect(billing).toContain('vagas_restantes')
      expect(billing).toContain('expectedVacancyPaymentCents')
      expect(billing).toContain('assertVacancyPaymentAmount')
      expect(billing).toContain('valor_unitario_centavos')
      expect(billing).toContain("remainingAfter > 0 ? 'liberado' : 'consumido'")
      expect(billing).toContain('nextGroup.vagas_livres - activeCommercialReservations < quantity')
    })
  })
})
