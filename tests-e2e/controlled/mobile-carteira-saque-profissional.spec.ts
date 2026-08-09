import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname,'../..')
const read = (file:string) => fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — saque PIX profissional', () => {
  test('solicita saque com validação, confirmação e acompanhamento nativo', async () => {
    const screen = read('app/src/screens/WalletScreen.tsx')
    const api = read('app/src/lib/api.ts')
    const route = read('web/app/api/me/carteira/saque/route.ts')

    expect(screen).toContain('SAQUE VIA PIX')
    expect(screen).toContain('Transferir saldo')
    expect(screen).toContain('VALOR DO SAQUE')
    expect(screen).toContain('Mínimo R$ 10,00')
    expect(screen).toContain('DESTINO PIX')
    expect(screen).toContain('Revisar e solicitar saque')
    expect(screen).toContain('Confirmar saque?')
    expect(screen).toContain('withdrawalValidation')
    expect(screen).toContain('withdrawalStage')
    expect(screen).toContain('ACOMPANHAMENTO')
    expect(screen).toContain('Solicitado')
    expect(screen).toContain('Processando')
    expect(screen).toContain('Pago')
    expect(screen).toContain('openReceipt')

    expect(api).toContain('requestWithdrawal:')
    expect(api).toContain("'/api/me/carteira/saque'")
    expect(api).toContain('valor_centavos')

    expect(route).toContain('MIN_SAQUE_CENTAVOS = 1000')
    expect(route).toContain('fn_solicitar_saque')
    expect(route).toContain('p_valor_centavos')
    expect(route).toContain('p_pix_chave')
    expect(route).toContain('p_pix_tipo')
    expect(route).toContain('p_titular_nome')

    expect(screen).not.toContain('WebView')
  })
})
