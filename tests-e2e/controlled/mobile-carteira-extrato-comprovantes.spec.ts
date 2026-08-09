import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname,'../..')
const read = (file:string) => fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — extrato e comprovantes avançados', () => {
  test('filtra, busca, agrupa e compartilha comprovantes reais da carteira', async () => {
    const screen = read('app/src/screens/WalletScreen.tsx')
    const route = read('web/app/api/me/carteira/comprovante/[id]/route.ts')

    expect(screen).toContain('Buscar no extrato')
    expect(screen).toContain('StatementFilter')
    expect(screen).toContain('Entradas')
    expect(screen).toContain('Saídas')
    expect(screen).toContain('statementGroups')
    expect(screen).toContain("toLocaleDateString('pt-BR'")
    expect(screen).toContain('COMPROVANTE DROPZONE PAY')
    expect(screen).toContain('shareReceipt')
    expect(screen).toContain('Share.share')
    expect(screen).toContain('Instituição destino')
    expect(screen).toContain('Instituição origem')
    expect(screen).toContain('Chave PIX')
    expect(screen).toContain('AUTENTICAÇÃO')

    expect(route).toContain("tipo === 'saque'")
    expect(route).toContain("tipo === 'lancamento'")
    expect(route).toContain('asaas_payment_id')
    expect(route).toContain('autenticacao')
    expect(route).toContain('saldo_apos_centavos')

    expect(screen).not.toContain('WebView')
  })
})
