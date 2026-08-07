import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88E — pagamento público de vaga', () => {
  test('site expõe meios seguros e preserva retorno para compra de vaga', async () => {
    const modal = read('web/features/billing/BuyVacancyModal.tsx')
    const api = read('web/app/api/pagamentos/vaga/route.ts')
    const paypal = read('backend/src/billing/paypal.ts')
    const purchase = read('backend/src/billing/vacancy-purchase.ts')
    const claimPage = read('web/app/vagas/compra/[token]/page.tsx')
    const css = read('web/app/vagas/vagas.css')

    expect(modal).toContain('Pagar com PIX')
    expect(modal).toContain('Pagar com cart')
    expect(modal).toContain('Pagar com PayPal')
    expect(modal).toContain('method,')
    expect(modal).toContain('paypal_approval_url')

    expect(api).toContain("['pix', 'cartao', 'paypal']")
    expect(api).toContain("referenceType: 'sistema_compras_vaga'")
    expect(api).toContain('/vagas/compra/')
    expect(api).toContain('paypal_approval_url')

    expect(paypal).toContain('returnUrl?: string')
    expect(paypal).toContain('cancelUrl?: string')
    expect(purchase).toContain("billingType: method === 'cartao' ? 'CREDIT_CARD' : 'PIX'")
    expect(purchase).toContain('/vagas/compra/')

    expect(claimPage).toContain("'approved'")
    expect(claimPage).toContain('purchaseId')
    expect(claimPage).toContain('/api/paypal/orders/')

    expect(css).toContain('.vacancy-buy-option-card')
    expect(css).toContain('.vacancy-buy-option-paypal')
  })
})
