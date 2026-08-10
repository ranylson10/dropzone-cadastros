import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Mobile — LEALT compacto', () => {
  test('reduz ruído da navegação e mantém a home densa', async () => {
    const shell = read('app/src/screens/AppShell.tsx')
    const home = read('app/src/screens/HomeScreen.tsx')
    const card = read('app/src/screens/ChampionshipVacancyCard.tsx')

    expect(shell).toContain("minHeight:48")
    expect(shell).toContain("brandName")
    expect(shell).toContain("menuUtilityText}>Carteira")
    expect(shell).toContain("menuUtilityText}>Idioma")
    expect(shell).toContain("tabLabel")
    expect(shell).not.toContain('accessibilityLabel="Carteira"')
    expect(shell).not.toContain('accessibilityLabel="Selecionar idioma"')

    expect(home).not.toContain('MINHA ÁREA')
    expect(home).toContain('Convite ou inscrição guiada')
    expect(home).toContain('Próximos campeonatos')
    expect(home).toContain("borderRadius:10")

    expect(card).toContain("borderRadius:10")
    expect(card).toContain("media:{height:138")
    expect(card).toContain("cart:{width:42")
    expect(card).toContain('Lista de desejos')
  })
})
