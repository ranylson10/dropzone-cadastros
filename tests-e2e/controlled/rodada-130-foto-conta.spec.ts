import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('130 - menu da conta permite adicionar e alterar a foto pessoal', () => {
  const header = read('web/components/layout/AppHeader.tsx')

  expect(header).toContain('Adicionar foto de perfil')
  expect(header).toContain('Alterar foto de perfil')
  expect(header).toContain("uploadPublicFile(file, 'account')")
  expect(header).toContain("fetch('/api/me/account'")
})

test('130 - upload da conta independe de cadastro operacional', () => {
  const access = read('backend/src/uploads/upload-access.ts')
  const upload = read('web/app/api/upload/route.ts')
  const signed = read('web/app/api/upload/signed/route.ts')
  const account = read('web/app/api/me/account/route.ts')

  expect(access).toContain("if (input.bucket === 'account') return")
  expect(upload).toContain("'account', 'produtora'")
  expect(signed).toContain("'account', 'produtora'")
  expect(account).toContain('updateUserById(user.id')
})

