import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')
const json=(file:string)=>JSON.parse(read(file))

test.describe('Rodada 101/101A — Home Cinemática DropZone',()=>{
  test('web usa GSAP + ScrollTrigger com shell sticky e fundo procedural',async()=>{
    const pkg=json('web/package.json')
    const effect=read('web/components/effects/LealtMotionScene.tsx')
    const home=read('web/features/home/PublicChampionshipHome.tsx')
    const css=read('web/app/globals.css')
    expect(pkg.dependencies.gsap).toBeTruthy()
    expect(effect).toContain("import('gsap/ScrollTrigger')")
    expect(effect).toContain('trigger: shell')
    expect(effect).toContain("end: 'bottom bottom'")
    expect(effect).toContain('scrub: 0.72')
    expect(home).toContain('data-drop-sequence-shell')
    expect(home).toContain('data-drop-transition-word')
    expect(home).toContain('drop-sequence-line-accent')
    expect(home).not.toContain('<video')
    expect(home).not.toContain('/videos/dropzone-home')
    expect(css).toContain('height:210vh')
    expect(css).toContain('position:sticky')
    expect(css).toContain('.lealt-motion-phase-b')
  })

  test('web mantém API de vagas, busca, destaque e acesso intactos',async()=>{
    const home=read('web/features/home/PublicChampionshipHome.tsx')
    expect(home).toContain("fetch('/api/vagas', { cache: 'no-store' })")
    expect(home).toContain('setFilter(value)')
    expect(home).toContain('data-drop-featured')
    expect(home).toContain('Garantir vaga')
    expect(home).toContain('onClick={onAccess}')
  })

  test('mobile fixa versões compatíveis do Expo 54 e usa UI thread',async()=>{
    const pkg=json('app/package.json')
    const home=read('app/src/screens/HomeScreen.tsx')
    const backdrop=read('app/src/components/LealtMotionBackdrop.tsx')
    expect(pkg.dependencies['react-native-reanimated']).toBe('~4.1.1')
    expect(pkg.dependencies['react-native-worklets']).toBe('0.5.1')
    expect(home).toContain('useAnimatedScrollHandler')
    expect(home).toContain('useAnimatedStyle')
    expect(home).toContain('SUA PRÓXIMA')
    expect(home).toContain('DROP / 02')
    expect(backdrop).toContain('useSharedValue')
    expect(backdrop).toContain('useReducedMotion')
  })

  test('login mobile preserva autenticação',async()=>{
    const login=read('app/src/screens/LoginScreen.tsx')
    expect(login).toContain("from 'react-native-reanimated'")
    expect(login).toContain('auth.signInWithGoogle()')
    expect(login).toContain('ENTRAR COM GOOGLE')
    expect(login).toContain('CONTINUAR SEM LOGIN')
  })
})
