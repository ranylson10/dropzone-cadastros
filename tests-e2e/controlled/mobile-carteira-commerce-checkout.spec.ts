import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — carrinho, checkout e inscrição integrados à carteira',()=>{
  test('mantém checkout oficial e conclui a inscrição nativamente após o pagamento',async()=>{
    const commerce=read('app/src/screens/CommerceScreen.tsx')
    const claim=read('app/src/screens/PurchaseClaimScreen.tsx')
    const flow=read('app/src/lib/purchase-flow.ts')
    const checkoutRoute=read('web/app/api/me/commerce/cart/checkout/route.ts')

    expect(commerce).toContain('DROPZONE PAY')
    expect(commerce).toContain('CARTEIRA INTEGRADA')
    expect(commerce).toContain('RESUMO DO PEDIDO')
    expect(commerce).toContain('FORMA DE PAGAMENTO')
    expect(commerce).toContain('Concluir inscrição no app')
    expect(commerce).toContain('savePendingVacancyPurchase')
    expect(commerce).toContain("onNavigate('purchase_claim')")
    expect(commerce).toContain('mobileApi.wallet')
    expect(commerce).toContain('checkoutCommerceCartItem')

    expect(flow).toContain('AsyncStorage')
    expect(flow).toContain('PendingVacancyPurchase')
    expect(flow).toContain('payment?.compra?.token')
    expect(claim).toContain('getPendingVacancyPurchase')
    expect(claim).toContain('Compra recuperada do carrinho')
    expect(claim).toContain('clearPendingVacancyPurchase')
    expect(claim).toContain('Confirmar vaga no campeonato')

    expect(checkoutRoute).toContain('createVacancyPurchase')
    expect(checkoutRoute).toContain('createLiliPayPalOrder')
    expect(checkoutRoute).toContain('claim_url')

    expect(commerce).not.toContain('Abrir inscrição liberada')
    expect(commerce).not.toContain('WebView')
    expect(claim).not.toContain('WebView')
  })
})
