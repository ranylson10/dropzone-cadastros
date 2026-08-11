import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Broadcast e Stream — segurança de acesso e tokens', () => {
  test('rotas privadas exigem autenticação e tokens públicos são validados sem expor segredos', () => {
    const me = read('web/app/api/broadcast/me/route.ts')
    const control = read('web/app/api/broadcast/control/[token]/route.ts')
    const obs = read('web/app/api/broadcast/obs/[token]/route.ts')

    expect(me).toContain('getBearerUser(req)')
    expect(control).toContain("if (!clean || clean.length < 16)")
    expect(obs).toContain("if (!clean || clean.length < 16)")
    expect(control).toContain(".eq('controller_token', clean)")
    expect(obs).toContain(".eq('obs_token', clean)")

    // O controlador pode devolver obs_token para montar a prévia oficial, mas nunca controller_token.
    expect(control).not.toContain('controller_token: session.controller_token')
    // A saída OBS não devolve nenhum dos tokens públicos no payload da sessão.
    expect(obs).not.toContain('controller_token:')
    expect(obs).not.toContain('obs_token:')
  })
})
