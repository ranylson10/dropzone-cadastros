import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Rodada 100B — intensidade preservada após linguagem tática 101B',()=>{
  test('web mantém motion LEALT intenso sem mídia, scan ou feixe genérico',async()=>{
    const effect=read('web/components/effects/LealtMotionScene.tsx')
    const css=read('web/app/globals.css')
    const home=read('web/features/home/PublicChampionshipHome.tsx')
    expect(effect).toContain('lealt-motion-network')
    expect(effect).toContain('lealt-motion-tracer-one')
    expect(effect).toContain('lealt-motion-pulse-one')
    expect(effect).toContain('pointermove')
    expect(effect).toContain('ScrollTrigger')
    expect(effect).not.toContain('lealt-motion-beam')
    expect(effect).not.toContain('lealt-motion-scan')
    expect(css).toContain('@keyframes dropTracerOne')
    expect(css).toContain('@keyframes dropZoneFloat')
    expect(css).toContain('@media (prefers-reduced-motion:reduce)')
    expect(css).toMatch(/\.public-home-hero\{[^}]*overflow:\s*hidden/)
    expect(home).not.toContain('dropzone-home.webm')
    expect(home).not.toContain('login-dropzone-hero.png')
  })

  test('mobile mantém fundo forte e motor Reanimated sem scan/flare',async()=>{
    const backdrop=read('app/src/components/LealtMotionBackdrop.tsx')
    const home=read('app/src/screens/HomeScreen.tsx')
    const login=read('app/src/screens/LoginScreen.tsx')
    expect(backdrop).toContain('withRepeat')
    expect(backdrop).toContain('[0,420],[0,-168]')
    expect(backdrop).toContain('[0,360],[1,1.27]')
    expect(backdrop).toContain('styles.tracerOne')
    expect(backdrop).toContain('styles.pulseOne')
    expect(backdrop).not.toContain('scanBand')
    expect(backdrop).not.toContain('flare')
    expect(backdrop).toContain('borderColor:colors.brand')
    expect(home).toContain('[0,410],[0,-145]')
    expect(home).toContain('[0,410],[1,.82]')
    expect(login).toContain('[0,1],[82,0]')
    expect(login).toContain('auth.signInWithGoogle()')
  })
})
