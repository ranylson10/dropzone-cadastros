import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const home = fs.readFileSync(path.join(root, 'web/features/dropzone/DropZoneHome.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('131 - todo cadastro operacional abre no mesmo modal sobre a home interna', () => {
  expect(home).toContain('const forcedProfileType = parseProfileType(requestedRegister) || parseProfileType(requestedLogin)')
  expect(home).toContain('<AuthenticatedHomeFeed account={account} accounts={accounts}')
  expect(home).toContain('<SystemModal')
  expect(home).toContain('title={`Cadastrar ${typeLabels[profileType].toLowerCase()}`}')
  expect(home).toContain('className="contextual-registration-form"')
  expect(home).not.toContain('className="login-stage login-stage-bg"')
  expect(css).toContain('.contextual-registration-form')
  expect(css).toContain('.system-modal-content .championship-form-stack')
})

test('131 - fechar o modal limpa o contexto sem ressuscitar a página antiga', () => {
  expect(home).toContain("url.searchParams.delete('cadastro')")
  expect(home).toContain("url.searchParams.delete('login')")
  expect(home).toContain("url.searchParams.delete('returnTo')")
  expect(home).toContain('onClose={closeContextualRegistration}')
})
