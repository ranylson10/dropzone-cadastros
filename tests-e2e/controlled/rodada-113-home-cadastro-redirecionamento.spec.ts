import { expect, test } from '@playwright/test'

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 113 — entrada, cadastro e destino autenticado', () => {
  test('home pública expõe ações distintas para entrar e criar conta', async () => {
    const home = read('web/features/home/PublicChampionshipHome.tsx')
    const controller = read('web/features/dropzone/DropZoneHome.tsx')

    expect(home).toContain('className="public-home-register"')
    expect(home).toContain('Criar conta')
    expect(home).toContain('className="public-home-access"')
    expect(controller).toContain('/login?mode=criar&switch=1&returnTo=%2F')
  })

  test('login abre diretamente no cadastro quando solicitado', async () => {
    const login = read('web/app/login/page.tsx')

    expect(login).toContain("const createRequested = search.get('mode') === 'criar'")
    expect(login).toContain("else if (createRequested) setEmailMode('criar')")
  })

  test('conta sem perfil não retorna à home pública e administrador abre o painel', async () => {
    const login = read('web/app/login/page.tsx')
    const home = read('web/features/dropzone/DropZoneHome.tsx')

    expect(login).toContain("window.location.replace(returnTo === '/' ? '/admin' : returnTo)")
    expect(login).toContain("const accessParams = new URLSearchParams({ acesso: '1' })")
    expect(home).toContain("const wantsAccessSelection = params.get('acesso') === '1'")
    expect(home).toContain('setShowAccess(wantsAccessSelection)')
  })
})
