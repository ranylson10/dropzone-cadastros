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

  test('propaga densidade compacta para perfis, token e painel interno', async () => {
    const create = read('app/src/screens/ProfileCreateScreen.tsx')
    const profile = read('app/src/screens/ProfileManagementScreen.tsx')
    const team = read('app/src/screens/TeamCreateScreen.tsx')
    const token = read('app/src/screens/TokenActionScreen.tsx')
    const control = read('app/src/screens/ControlPanelScreen.tsx')

    expect(team).toContain('ProfileCreateScreen')
    expect(create).toContain("header:{minHeight:70")
    expect(create).toContain("borderRadius:10")
    expect(create).toContain("input:{minHeight:42")
    expect(profile).toContain("header:{minHeight:68")
    expect(profile).toContain("inputWrap:{minHeight:42")
    expect(token).toContain("title:{color:'#fff',fontSize:20")
    expect(token).toContain("primaryButton:{marginHorizontal:12,minHeight:46")
    expect(control).toContain("card:{width:'48.8%',minHeight:132")
    expect(control).toContain("borderRadius:10")
  })

  test('propaga o LEALT compacto para operação, elenco, agenda e carteira', async () => {
    const championship = read('app/src/screens/ChampionshipManagementScreen.tsx')
    const games = read('app/src/screens/ChampionshipGamesPanel.tsx')
    const teams = read('app/src/screens/ChampionshipTeamsPanel.tsx')
    const lines = read('app/src/screens/LineManagementScreen.tsx')
    const roster = read('app/src/screens/TeamRosterScreen.tsx')
    const agenda = read('app/src/screens/AgendaScreen.tsx')
    const wallet = read('app/src/screens/WalletScreen.tsx')

    expect(championship).toContain("header:{minHeight:72")
    expect(championship).toContain("borderRadius:10")
    expect(games).toContain("form:{gap:7,padding:9")
    expect(games).toContain("borderRadius:10")
    expect(teams).toContain("searchBox:{gap:7,padding:9")
    expect(lines).toContain("header:{minHeight:68")
    expect(lines).toContain("input:{minHeight:42")
    expect(roster).toContain("teamHeader: { minHeight: 70")
    expect(roster).toContain("quickAction: { flex: 1, minHeight: 54")
    expect(agenda).toContain("monthBar:{marginHorizontal:spacing.md,marginTop:7,minHeight:52")
    expect(agenda).toContain("dayGroup:{gap:1,backgroundColor:colors.line,borderRadius:10")
    expect(wallet).toContain("bankCard:{backgroundColor:'#0b1320'")
    expect(wallet).toContain("borderRadius:12")
    expect(wallet).toContain("input:{minHeight:42")
  })

})
