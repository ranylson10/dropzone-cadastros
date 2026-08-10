import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Uploads de imagem — salvar somente no submit final', () => {
  test('web prepara a imagem localmente e só envia no salvamento final', async () => {
    const fields = read('web/features/dropzone/components/form-fields.tsx')
    const profile = read('web/components/forms/ProfileEditForm.tsx')
    const championship = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    const manager = read('web/features/dropzone/panels/manager/ManagerContextsView.tsx')

    expect(fields).toContain('pendingImageUploads.set(previewUrl')
    expect(fields).toContain('export async function resolvePendingImageUpload')
    expect(fields).not.toContain('const url = await onUpload(croppedFile, bucket)')
    expect(profile).toContain('await resolvePendingImageUpload(logo)')
    expect(championship).toContain('async function submitWithImages()')
    expect(championship).toContain('await resolvePendingImageUpload(value.logo_url)')
    expect(championship).toContain('await resolvePendingImageUpload(value.banner_url)')
    expect(team).toContain('await resolvePendingImageUpload(logoUrl)')
    expect(manager).toContain('await resolvePendingImageUpload(logoUrl)')
  })

  test('mobile só chama upload depois do botão de salvar/criar', async () => {
    const profile = read('app/src/screens/ProfileManagementScreen.tsx')
    const championship = read('app/src/screens/ChampionshipManagementScreen.tsx')
    const line = read('app/src/screens/LineManagementScreen.tsx')

    expect(profile).toContain("set('imagem')(`data:image/png;base64,${converted.base64}`)")
    expect(profile).toContain("if(imageUrl.startsWith('data:image/'))")
    expect(championship).toContain("setLogo(`data:image/png;base64,${png.base64}`)")
    expect(championship).toContain("if(logoUrl.startsWith('data:image/'))")
    expect(line).toContain("setLogo(`data:image/png;base64,${png.base64}`)")
    expect(line).toContain("if(logoUrl.startsWith('data:image/'))")
  })
})
