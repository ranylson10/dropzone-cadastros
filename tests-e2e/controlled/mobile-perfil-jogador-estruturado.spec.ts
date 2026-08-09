import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — perfil de jogador estruturado',()=>{
  test('preserva recrutamento e organiza identidade competitiva do jogador',async()=>{
    const screen=read('app/src/screens/ProfileManagementScreen.tsx')
    const api=read('web/app/api/me/perfil/route.ts')

    expect(screen).toContain('disponivel_recrutamento:boolean')
    expect(screen).toContain('Boolean(data.disponivel_recrutamento)')
    expect(screen).toContain('body.disponivel_recrutamento=form.disponivel_recrutamento')
    expect(screen).toContain('Disponível para recrutamento')
    expect(screen).toContain('Recrutamento desativado')

    expect(screen).toContain("'rush','support','granadeiro','sniper','flex','capitão'")
    expect(screen).toContain('FUNÇÃO PRINCIPAL')
    expect(screen).toContain('Outra função')
    expect(screen).toContain('keyboardType="number-pad"')
    expect(screen).toContain("O ID no jogo deve conter apenas números.")

    expect(screen).toContain('requestCameraPermissionsAsync()')
    expect(screen).toContain('launchCameraAsync')
    expect(screen).toContain('launchImageLibraryAsync')
    expect(screen).toContain('Câmera ou galeria')

    expect(api).toContain("profileType === 'jogador' && body.disponivel_recrutamento !== undefined")
    expect(api).toContain('patch.disponivel_recrutamento = Boolean(body.disponivel_recrutamento)')
    expect(screen).not.toContain('WebView')
  })
})
