import { expect, test } from '@playwright/test'

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 113 — entrada, cadastro e destino autenticado', () => {
  test('raiz sem sessão abre o login em vez da antiga landing page', async () => {
    const controller = read('web/features/dropzone/DropZoneHome.tsx')

    expect(controller).toContain("window.location.replace('/login?returnTo=%2F')")
    expect(controller).not.toContain('PublicChampionshipHome')
  })

  test('login abre diretamente no cadastro quando solicitado', async () => {
    const login = read('web/app/login/page.tsx')

    expect(login).toContain("const createRequested = search.get('mode') === 'criar'")
    expect(login).toContain("else if (createRequested) setEmailMode('criar')")
  })

  test('conta autenticada entra na home sem seletor obrigatório de perfil', async () => {
    const login = read('web/app/login/page.tsx')
    const home = read('web/features/dropzone/DropZoneHome.tsx')

    expect(login).toContain('window.location.replace(returnTo)')
    expect(login).not.toContain("new URLSearchParams({ acesso: '1' })")
    expect(home).not.toContain('Quem vai entrar?')
    expect(home).toContain('identity={authIdentity}')
    expect(home).toContain('<AuthenticatedHomeFeed account={null} accounts={[]}')
  })
})
