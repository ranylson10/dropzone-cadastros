import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — perfis de equipe, produtora e broadcast',()=>{
  test('estrutura os perfis sem criar campos ou APIs paralelas',async()=>{
    const screen=read('app/src/screens/ProfileManagementScreen.tsx')

    expect(screen).toContain('IDENTIDADE DA EQUIPE')
    expect(screen).toContain('Bio da equipe')
    expect(screen).toContain('IDENTIDADE DA PRODUTORA')
    expect(screen).toContain('Bio da produtora')
    expect(screen).toContain('PERFIL DE BROADCAST')
    expect(screen).toContain('Bio profissional')
    expect(screen).toContain('PERFIL PROFISSIONAL')

    expect(screen).toContain("/^[A-Za-z0-9]{1,6}$/")
    expect(screen).toContain('A tag deve ter no máximo 6 letras ou números.')
    expect(screen).toContain('maxLength={6}')
    expect(screen).toContain("onChangeText={set('tag')}")
    expect(screen).not.toContain("set('tag')(value.toUpperCase())")

    expect(screen).toContain("form.estado.trim().length>2")
    expect(screen).toContain('Câmera ou galeria')
    expect(screen).toContain('Disponível para recrutamento')
    expect(screen).not.toContain('WebView')
  })
})
