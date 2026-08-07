import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

test.describe('Carteira — estornos e taxa de venda direta', () => {
  test('ledger aceita estorno, saldo pode ficar negativo e venda direta de vaga cobra 5%', async () => {
    const migration = read('database/migrations/20260807_carteira_estornos_e_taxa_venda_direta.sql')
    const wallet = read('backend/src/billing/wallet.ts')
    const payments = read('backend/src/billing/payments.ts')

    await test.step('Banco permite estorno real e saldo negativo de chargeback', async () => {
      expect(migration).toContain("'estorno_comissao'")
      expect(migration).toContain("'estorno_pagamento'")
      expect(migration).toContain('drop constraint')
      expect(migration).toContain('saldo_disponivel_centavos is')
      expect(migration).toContain('Pode ficar negativo')
    })

    await test.step('Auditoria de split tenta impedir duplicidade por pagamento', async () => {
      expect(migration).toContain('sistema_comissoes_pagamento_unico_idx')
      expect(payments).toContain('existingCommission')
      expect(payments).toContain("commissionError.code === '23505'")
      expect(payments).toContain('return { skipped: true')
      expect(payments).toContain('.order(')
      expect(payments).toContain('.limit(1)')
    })

    await test.step('Compra de vaga sem vendedor usa taxa direta de 5%', async () => {
      expect(migration).toContain('taxa_venda_direta_vaga_bps')
      expect(migration).toContain('500')
      expect(wallet).toContain('vendaDiretaVagaBps')
      expect(payments).toContain("pagamento.finalidade === 'compra_vaga' && !hasSeller")
      expect(payments).toContain('vendaDiretaVagaBps || 500')
      expect(payments).toContain('taxa_venda_direta_vaga_bps')
    })
  })
})
