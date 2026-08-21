import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Rodada 101B — Home e Login vivos',()=>{
  test('login web usa cenário procedural e corrige colisão mobile do topo',async()=>{
    const login=read('web/app/login/page.tsx')
    const css=read('web/app/globals.css')
    expect(login).toContain('<LealtMotionScene className="lealt-motion-login" />')
    expect(login).toContain('className="login-portal-intro"')
    expect(login).toContain('login-title-accent')
    expect(login).toContain('login-live-telemetry')
    expect(login).not.toContain('login-portal-media')
    const portalCss=css.slice(css.indexOf('.login-portal{'),css.indexOf('.team-dashboard,',css.indexOf('.login-portal{')))
    expect(portalCss).not.toContain('login-dropzone-hero.png')
    expect(portalCss).not.toContain('login-portal-media')
    expect(css).toContain('.login-portal-brand{position:relative')
    expect(css).toContain('font-size:clamp(38px,12vw,52px)')
  })

  test('web mantém vídeo limpo, sem rede/raio/scan, com rastreadores e pulsos leves',async()=>{
    const effect=read('web/components/effects/LealtMotionScene.tsx')
    const css=read('web/app/globals.css')
    const home=read('web/features/home/PublicChampionshipHome.tsx')
    expect(effect).not.toContain('lealt-motion-network')
    expect(effect).not.toContain('lealt-motion-grid')
    expect(effect).not.toContain('lealt-motion-orbit-one')
    expect(effect).not.toContain('data-scene-network')
    expect(effect).toContain('lealt-motion-tracer-one')
    expect(effect).toContain('lealt-motion-pulse-two')
    expect(effect).not.toContain('lealt-motion-beam')
    expect(effect).not.toContain('lealt-motion-scan')
    expect(css).toContain('@keyframes dropTracerOne')
    expect(home).toContain('drop-sequence-live-status')
    expect(home).toContain('LIVE FEED')
  })

  test('app acompanha linguagem viva sem scan e login entra em linhas cinéticas',async()=>{
    const backdrop=read('app/src/components/LealtMotionBackdrop.tsx')
    const home=read('app/src/screens/HomeScreen.tsx')
    const login=read('app/src/screens/LoginScreen.tsx')
    expect(backdrop).toContain('tracerOneStyle')
    expect(backdrop).toContain('pulseStyle')
    expect(backdrop).not.toContain('scanBand')
    expect(backdrop).not.toContain('flare')
    expect(home).toContain('FIELD ACTIVE')
    expect(login).toContain('ENTRE.</Animated.Text>')
    expect(login).toContain('ESCOLHA.</Animated.Text>')
    expect(login).toContain('COMPITA.</Animated.Text>')
    expect(login).toContain('auth.signInWithGoogle()')
  })
})
