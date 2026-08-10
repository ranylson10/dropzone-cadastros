import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')
test.describe('Mobile — perfil de jogador em paridade com o site',()=>{
  test('usa funções oficiais e preserva recrutamento e imagem',async()=>{
    const screen=read('app/src/screens/ProfileManagementScreen.tsx')
    const parity=read('app/src/lib/profileParity.ts')
    const api=read('web/app/api/me/perfil/route.ts')
    expect(screen).toContain('disponivel_recrutamento:boolean')
    expect(screen).toContain('body.disponivel_recrutamento=form.disponivel_recrutamento')
    expect(screen).toContain('Disponível para recrutamento')
    expect(parity).toContain("['support', 'rush', 'sniper', 'bomber']")
    expect(screen).toContain('PLAYER_ROLES.map')
    expect(parity).not.toContain("'granadeiro'")
    expect(parity).not.toContain("'flex'")
    expect(parity).not.toContain("'capitão'")
    expect(screen).not.toContain('Outra função')
    expect(screen).toContain('keyboardType="number-pad"')
    expect(screen).toContain('requestCameraPermissionsAsync()')
    expect(screen).toContain('launchImageLibraryAsync')
    expect(api).toContain("profileType === 'jogador' && body.disponivel_recrutamento !== undefined")
  })
})
