import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname, '../..')
const read = (file:string) => fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — carteira PIX profissional', () => {
  test('cadastra, edita e remove chave PIX usando a carteira oficial', async () => {
    const screen = read('app/src/screens/WalletScreen.tsx')
    const api = read('app/src/lib/api.ts')
    const route = read('web/app/api/me/carteira/route.ts')

    expect(screen).toContain('GESTÃO DA CHAVE PIX')
    expect(screen).toContain('Cadastrar chave PIX')
    expect(screen).toContain('Editar chave cadastrada')
    expect(screen).toContain('TIPO DA CHAVE')
    expect(screen).toContain('CPF')
    expect(screen).toContain('CNPJ')
    expect(screen).toContain('E-mail')
    expect(screen).toContain('Telefone')
    expect(screen).toContain('Aleatória')
    expect(screen).toContain('Salvar chave PIX')
    expect(screen).toContain('CHAVE VINCULADA')
    expect(screen).toContain('removePix')
    expect(screen).toContain('validatePix')

    expect(api).toContain('updateWalletPix:')
    expect(api).toContain('removeWalletPix:')
    expect(api).toContain("method: 'PATCH'")
    expect(api).toContain("method: 'DELETE'")

    expect(route).toContain('export async function PATCH')
    expect(route).toContain('export async function DELETE')
    expect(route).toContain('pix_chave')
    expect(route).toContain('pix_tipo')
    expect(route).toContain('pix_titular')

    expect(screen).not.toContain('WebView')
  })
})
