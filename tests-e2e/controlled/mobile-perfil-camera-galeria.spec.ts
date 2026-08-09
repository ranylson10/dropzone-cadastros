import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — perfil com câmera e galeria',()=>{
  test('oferece as duas origens e reaproveita o upload oficial',async()=>{
    const screen=read('app/src/screens/ProfileManagementScreen.tsx')
    const pkg=JSON.parse(read('app/package.json'))

    expect(pkg.dependencies['expo-image-picker']).toBeTruthy()
    expect(pkg.dependencies['expo-image-manipulator']).toBeTruthy()

    expect(screen).toContain('requestCameraPermissionsAsync()')
    expect(screen).toContain('launchCameraAsync')
    expect(screen).toContain('requestMediaLibraryPermissionsAsync()')
    expect(screen).toContain('launchImageLibraryAsync')
    expect(screen).toContain('uploadPickedImage')
    expect(screen).toContain('mobileApi.uploadProfileImage')
    expect(screen).toContain("text:'Câmera'")
    expect(screen).toContain("text:'Galeria'")
    expect(screen).toContain('Câmera ou galeria')
    expect(screen).toContain('allowsEditing:true')
    expect(screen).toContain('aspect:[1,1]')
    expect(screen).toContain('resize:{width:800}')
    expect(screen).not.toContain('WebView')
  })
})
