import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')
const json=(file:string)=>JSON.parse(read(file))
const exists=(file:string)=>fs.existsSync(path.join(root,file))
const size=(file:string)=>fs.statSync(path.join(root,file)).size

test.describe('Rodada 101C/101D/101E — BG em vídeo local e otimizado',()=>{
  test('web usa somente assets locais com fallback, data saver e reduced motion',async()=>{
    const effect=read('web/components/effects/LealtMotionScene.tsx')
    const css=read('web/app/globals.css')
    expect(effect).toContain("'/media/dropzone-bg-desktop.webm'")
    expect(effect).toContain("'/media/dropzone-bg-desktop.mp4'")
    expect(effect).toContain("'/media/dropzone-bg-mobile.mp4'")
    expect(effect).toContain("'/media/dropzone-bg-poster.webp'")
    expect(effect).not.toContain('videos.pexels.com')
    expect(effect).not.toContain('images.pexels.com')
    expect(effect).not.toContain('cdn.pixabay.com')
    expect(effect).toContain('media="(max-width: 900px)"')
    expect(effect).toContain('saveData')
    expect(effect).toContain('prefers-reduced-motion: reduce')
    expect(effect).toContain('preload="metadata"')
    expect(effect).toContain('visibilitychange')
    expect(css).toContain('.lealt-motion-video-poster,.lealt-motion-video')
    expect(css).toContain('.lealt-motion-video-tint')
  })

  test('assets gerados existem e respeitam teto de peso',async()=>{
    const webm='web/public/media/dropzone-bg-desktop.webm'
    const desktop='web/public/media/dropzone-bg-desktop.mp4'
    const mobile='web/public/media/dropzone-bg-mobile.mp4'
    const poster='web/public/media/dropzone-bg-poster.webp'
    const appMobile='app/assets/media/dropzone-bg-mobile.mp4'
    for(const file of [webm,desktop,mobile,poster,appMobile])expect(exists(file),`${file} precisa ser gerado pelo script`).toBeTruthy()
    expect(size(webm)).toBeLessThan(6*1024*1024)
    expect(size(desktop)).toBeLessThan(7*1024*1024)
    expect(size(mobile)).toBeLessThan(5*1024*1024)
    expect(size(poster)).toBeLessThan(500*1024)
    expect(size(appMobile)).toBe(size(mobile))
  })

  test('GSAP continua controlando profundidade do próprio vídeo no scroll',async()=>{
    const effect=read('web/components/effects/LealtMotionScene.tsx')
    expect(effect).toContain("scene.querySelector<HTMLVideoElement>('.lealt-motion-video')")
    expect(effect).toContain('scale: 1.16')
    expect(effect).toContain('xPercent: -2.4')
    expect(effect).toContain('ScrollTrigger')
  })

  test('app usa expo-video com arquivo local e mantém Reanimated',async()=>{
    const pkg=json('app/package.json')
    const backdrop=read('app/src/components/LealtMotionBackdrop.tsx')
    expect(String(pkg.dependencies['expo-video']||'')).toMatch(/^~?3\.0\./)
    expect(backdrop).toContain("from 'expo-video'")
    expect(backdrop).toContain("require('../../assets/media/dropzone-bg-mobile.mp4')")
    expect(backdrop).not.toContain('videos.pexels.com')
    expect(backdrop).not.toContain('cdn.pixabay.com')
    expect(backdrop).not.toContain('useCaching:true')
    expect(backdrop).toContain('instance.muted=true')
    expect(backdrop).toContain('instance.playbackRate=.92')
    expect(backdrop).toContain('useReducedMotion')
    expect(backdrop).toContain('withRepeat')
  })

  test('script prepara o Red HUD Digital do Pixabay e gera variantes locais',async()=>{
    const script=read('scripts/prepare-dropzone-bg-video.ps1')
    expect(script).toContain('https://pixabay.com/videos/red-hud-digital-background-243825/')
    expect(script).toContain('243825')
    expect(script).not.toContain('cdn.pixabay.com')
    expect(script).toContain('SourcePath')
    expect(script).toContain('nao vai tentar contornar essa protecao')
    expect(script).not.toContain('pexels.com')
    expect(script).toContain('libvpx-vp9')
    expect(script).toContain('libx264')
    expect(script).toContain('-stream_loop -1')
    expect(script).toContain('-t 8')
    expect(script).toContain('fps=24')
    expect(script).toContain('dropzone-bg-mobile.mp4')
    expect(script).toContain('dropzone-bg-poster.webp')
  })

  test('proveniência local identifica exatamente o vídeo escolhido',async()=>{
    const webSource=read('web/public/media/dropzone-bg-source.txt')
    const appSource=read('app/assets/media/dropzone-bg-source.txt')
    for(const source of [webSource,appSource]){
      expect(source).toContain('red-hud-digital-background-243825')
      expect(source).toContain('Red, Hud, Digital')
      expect(source).toContain('olenchic')
      expect(source).not.toContain('pexels.com')
    }
  })
})
