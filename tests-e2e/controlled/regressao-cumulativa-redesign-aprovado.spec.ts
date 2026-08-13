import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Regressão cumulativa — redesign aprovado', () => {
  test('fundação premium continua presente no globals', () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('--ui-bg: #0c0d0f')
    expect(css).toContain('--ui-surface: #141518')
    expect(css).toContain('--ui-text: #f5f3ed')
    expect(css).toContain('--ui-accent: #c9b766')
    expect(css).toContain('--ui-radius-lg: 14px')
  })

  test('novo campeonato não pode voltar ao modal claro antigo', () => {
    const css = read('web/app/globals.css')
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(css).toContain('.system-modal{ --surface: var(--ui-surface)')
    expect(css).toContain('background: var(--ui-surface); color: var(--ui-text); box-shadow: none')
    expect(css).toContain('.championship-type-card{ width: 100%; min-height: 76px;')
    expect(css).toContain('border: 0; border-radius: 0; background: transparent; color: var(--ui-text);')
    expect(css).not.toContain('background: rgba(10, 15, 25, .58); backdrop-filter: blur(9px)')
    expect(css).not.toContain('.championship-type-card{ width: 100%; min-height: 86px;')
    expect(form).toContain('<span className="championship-step-index">1 de 2</span>')
    expect(form).toContain('<h3>Escolha o formato</h3>')
    expect(form).toContain('<strong>Nova edição</strong>')
  })

  test('central e diretório usam seus CSS próprios sem camada legada no globals', () => {
    const globalCss = read('web/app/globals.css')
    const central = read('web/components/campeonatos/ChampionshipCentral.tsx')
    const directoryPage = read('web/app/campeonatos/page.tsx')
    expect(globalCss).not.toContain('.championship-central-header')
    expect(globalCss).not.toContain('.championship-choice-panel')
    expect(globalCss).not.toContain('.smart-alert-actions')
    expect(globalCss).not.toContain('Diretório de campeonatos em formato de cards comerciais')
    expect(globalCss).not.toContain('.directory-champ-card-grid{')
    expect(central).toContain("import './championship-central.css'")
    expect(directoryPage).toContain("import '@/features/directory/components/championship-directory.css'")
  })

  test('módulos redesenhados continuam conectados aos CSS próprios', () => {
    expect(read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')).toContain("import '../campeonato-equipes.css'")
    expect(read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')).toContain("import '../campeonato-jogos.css'")
    expect(read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')).toContain("import '../campeonato-estatisticas.css'")
    expect(read('web/features/billing/WalletPanel.tsx')).toContain("import './wallet-panel.css'")
  })
})
