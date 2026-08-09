import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname, '../..')
const read = (file:string) => fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — carteira profissional estilo banco', () => {
  test('preserva dados reais e transforma a carteira em dashboard financeiro nativo', async () => {
    const screen = read('app/src/screens/WalletScreen.tsx')
    const api = read('app/src/lib/api.ts')
    const walletRoute = read('web/app/api/me/carteira/route.ts')
    const receiptRoute = read('web/app/api/me/carteira/comprovante/[id]/route.ts')

    expect(screen).toContain('DROPZONE PAY')
    expect(screen).toContain('CONTA COMPETITIVA')
    expect(screen).toContain('Saldo disponível')
    expect(screen).toContain('SALDO BLOQUEADO')
    expect(screen).toContain('balanceVisible')
    expect(screen).toContain('eye-off-outline')
    expect(screen).toContain('Entradas')
    expect(screen).toContain('Saídas')
    expect(screen).toContain('Pendências')
    expect(screen).toContain('Sua atividade financeira')
    expect(screen).toContain('AMBIENTE PROTEGIDO')
    expect(screen).toContain("setTab('saques')")
    expect(screen).toContain("setTab('pix')")
    expect(screen).toContain("setTab('extrato')")
    expect(screen).toContain('loadWallet(true)')
    expect(screen).toContain('openReceipt')

    expect(api).toContain('wallet:')
    expect(api).toContain('receipt:')
    expect(walletRoute).toContain('saldo_disponivel_centavos')
    expect(walletRoute).toContain('saldo_bloqueado_centavos')
    expect(receiptRoute).toContain('autenticacao')

    expect(screen).not.toContain('WebView')
  })
})
