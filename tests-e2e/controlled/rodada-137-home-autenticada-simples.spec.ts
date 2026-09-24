import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 137 — Home autenticada simples e contextual', () => {
  test('remove o hero grande e abre com resumo de atenção', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    expect(home).toContain('authenticated-home-focus')
    expect(home).toContain('Você tem algo que merece atenção agora.')
    expect(home).not.toContain('authenticated-home-intro')
    expect(home).not.toContain('Seu campeonato em movimento')
  })

  test('limita pendências visíveis e mantém acesso ao restante pela agenda', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    expect(home).toContain('const visibleTasks = homeTasks.slice(0, 3)')
    expect(home).toContain('Precisa da sua atenção')
    expect(home).toContain('href="/agenda">Ver tudo')
  })

  test('token e link ficam recolhidos em mais opções', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    expect(home).toContain('<details className="authenticated-home-more">')
    expect(home).toContain('Tenho um token ou link')
    expect(home).toContain('authenticated-home-token')
  })

  test('oportunidades são contextuais e não aparecem na home de produtora', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    expect(home).toContain('const showOpportunities = !account || isPlayer || isTeam')
    expect(home).toContain('{showOpportunities ? <section')
    expect(home).toContain('Campeonatos com vagas')
  })

  test('ações rápidas mudam por perfil', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    expect(home).toContain('isProducer ? <>')
    expect(home).toContain('isTeam ? <>')
    expect(home).toContain('isPlayer ? <>')
    expect(home).toContain("account?.profile_type === 'manager'")
    expect(home).toContain('Criar campeonato')
    expect(home).toContain('Minha equipe')
    expect(home).toContain('Meu perfil')
  })

  test('mobile usa coluna única e preserva prioridade visual', () => {
    const css = read('web/features/home/authenticated-home.css')
    expect(css).toContain('@media(max-width:620px)')
    expect(css).toContain('.authenticated-home-quick-grid{grid-template-columns:1fr')
    expect(css).toContain('.authenticated-home-now-grid{grid-template-columns:1fr}')
  })
})
