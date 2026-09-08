import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 10 — shell da transmissão ao vivo', () => {
  test('workspace de transmissão remove textura e glass do cabeçalho', () => {
    const css = read('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('background: var(--ui-bg, #0c0d0f);')
    expect(css).toContain('border-bottom: 1px solid rgba(245, 243, 237, .07);')
    expect(css).not.toContain('background: color-mix(in srgb, var(--surface) 94%, transparent);')
    expect(css).not.toContain('backdrop-filter: blur(10px);')
  })

  test('abas principais da transmissão seguem destaque dourado', () => {
    const css = read('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('.stream-package-header-tabs button.active{background:var(--ui-primary,#c9b766);color:#111214}')
  })

  test('mantém dados no site e encaminha o editor para o aplicativo local', () => {
    const workspace = read('web/features/campeonatos/stream/components/StreamWorkspace.tsx')
    const tab = read('web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx')
    expect(workspace).toContain('<LocalStudioHandoff campeonatoId={props.campeonatoId} kind="live" />')
    expect(tab).toContain('<StreamSpreadsheetPanel')
    expect(tab).toContain('triggerLabel="Dados"')
    expect(tab).toContain('O editor de artes e overlays permanece no app local.')
  })
})
