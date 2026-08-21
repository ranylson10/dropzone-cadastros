import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — home e login com motion LEALT',()=>{
  test('home usa Reanimated e scroll cinematográfico sem trocar o fluxo funcional',async()=>{
    const home=read('app/src/screens/HomeScreen.tsx')
    expect(home).toContain("from 'react-native-reanimated'")
    expect(home).toContain('useAnimatedScrollHandler')
    expect(home).toContain('useSharedValue(0)')
    expect(home).toContain('LealtMotionBackdrop scrollY={scrollY}')
    expect(home).toContain('SUA PRÓXIMA')
    expect(home).toContain('COMEÇA AQUI.')
    expect(home).toContain('Convite ou inscrição guiada')
    expect(home).toContain('Próximos campeonatos')
    expect(home).toContain('mobileApi.vacancies')
    expect(home).toContain('Number(item.vagas_livres||0)>0')
  })

  test('login usa o mesmo motor preservando Google e modo visitante',async()=>{
    const login=read('app/src/screens/LoginScreen.tsx')
    const backdrop=read('app/src/components/LealtMotionBackdrop.tsx')
    expect(login).toContain('LealtMotionBackdrop scrollY={scrollY} compact')
    expect(login).toContain('useAnimatedScrollHandler')
    expect(login).toContain('ENTRAR COM GOOGLE')
    expect(login).toContain('CONTINUAR SEM LOGIN')
    expect(login).toContain('auth.signInWithGoogle()')
    expect(backdrop).toContain('withRepeat')
    expect(backdrop).toContain('useReducedMotion')
    expect(backdrop).toContain('colors.brand')
  })
})
