import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')
test.describe('Mobile — perfis em paridade com o site',()=>{
  test('mantém somente campos persistidos e identidade oficial',async()=>{
    const screen=read('app/src/screens/ProfileManagementScreen.tsx')
    const create=read('app/src/screens/ProfileCreateScreen.tsx')
    expect(screen).toContain('Câmera ou galeria')
    expect(screen).toContain('maxLength={12}')
    expect(screen).toContain("set('tag')(value.toUpperCase())")
    expect(screen).toContain('Nome público de vendas')
    expect(screen).toContain('PAPEL NA TRANSMISSÃO')
    expect(screen).not.toContain('Bio da produtora')
    expect(screen).not.toContain('PERFIL PROFISSIONAL')
    expect(screen).not.toContain('PERFIL DE BROADCAST')
    expect(create).toContain("upload_intent:'create_profile'")
    expect(screen).toContain("form.estado.trim().length>2")
    expect(screen).not.toContain('WebView')
  })
})
