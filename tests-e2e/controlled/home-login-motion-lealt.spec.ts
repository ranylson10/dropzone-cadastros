import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test('home pública abre o catálogo atual sem restaurar a landing cinematográfica', async () => {
  const source = read('web/features/home/AuthenticatedHomeFeed.tsx')
  expect(source).toContain('Encontre seu próximo campeonato')
  expect(source).toContain("fetch('/api/vagas'")
  expect(source).toContain('<VacancyCard')
  expect(source).not.toContain('<video')
  expect(fs.existsSync(path.join(root, 'web/features/home/PublicChampionshipHome.tsx'))).toBeFalsy()
})

test('login web mantém fluxo de autenticação e motion compartilhado', async () => {
  const source = read('web/app/login/page.tsx')
  expect(source).toContain('LealtMotionScene')
  expect(source).toContain('className="lealt-motion-login"')
  expect(source).toContain('supabase.auth.getSession()')
  expect(source).toContain('handleEmailAuth')
  expect(source).toContain('<SocialLogin profileType={null} returnTo={params.returnTo} />')
})

test('motion web usa ScrollTrigger sobre shell sticky e respeita redução de movimento', async () => {
  const effect = read('web/components/effects/LealtMotionScene.tsx')
  const css = read('web/app/globals.css')
  expect(effect).toContain("import('gsap')")
  expect(effect).toContain("import('gsap/ScrollTrigger')")
  expect(effect).toContain("trigger: shell")
  expect(effect).toContain("end: 'bottom bottom'")
  expect(effect).toContain("prefers-reduced-motion: reduce")
  expect(css).toContain('.drop-sequence-shell')
  expect(css).toContain('position:sticky')
  expect(css).toContain('@media (prefers-reduced-motion:reduce)')
  expect(css).toContain('.drop-sequence-transition-word')
})

test('app mobile usa Reanimated preservando home e login', async () => {
  const backdrop = read('app/src/components/LealtMotionBackdrop.tsx')
  const home = read('app/src/screens/HomeScreen.tsx')
  const login = read('app/src/screens/LoginScreen.tsx')
  expect(backdrop).toContain("from 'react-native-reanimated'")
  expect(backdrop).toContain('useReducedMotion')
  expect(home).toContain('<LealtMotionBackdrop scrollY={scrollY}/>')
  expect(home).toContain('useAnimatedScrollHandler')
  expect(login).toContain('<LealtMotionBackdrop scrollY={scrollY} compact/>')
  expect(login).toContain('auth.signInWithGoogle()')
})
