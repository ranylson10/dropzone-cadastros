import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — participação nativa após compra de vaga',()=>{
  test('confirma pagamento, equipe, line e slot sem abrir claim web',async()=>{
    const screen=read('app/src/screens/PurchaseClaimScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/pagamentos/vaga/claim/route.ts')
    const backend=read('backend/src/billing/vacancy-purchase.ts')

    expect(screen).toContain('Verificar pagamento')
    expect(screen).toContain('2 · Confirmar participação')
    expect(screen).toContain('EQUIPE')
    expect(screen).toContain('LINE')
    expect(screen).toContain('Criar nova line')
    expect(screen).toContain('SLOT ·')
    expect(screen).toContain('Confirmar vaga no campeonato')
    expect(screen).toContain("onNavigate('my_championships')")

    expect(api).toContain('vacancyClaimContext:')
    expect(api).toContain('claimVacancyPurchase:')
    expect(api).toContain('/api/pagamentos/vaga/claim?token=')
    expect(api).toContain("dropzoneFetch<any>('/api/pagamentos/vaga/claim'")

    expect(route).toContain('export async function GET')
    expect(route).toContain('loadClaimContext')
    expect(route).toContain('export async function POST')
    expect(route).toContain('claimVacancyPurchase')

    expect(backend).toContain('export async function loadClaimContext')
    expect(backend).toContain('listLinesDisponiveisNoCampeonato')
    expect(backend).toContain('slots_livres')
    expect(backend).toContain('export async function claimVacancyPurchase')

    expect(screen).not.toContain('claimUrl')
    expect(screen).not.toContain('Continuar inscrição')
    expect(screen).not.toContain('WebView')
  })
})
