import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 12 — revisão mobile completa', () => {
  test('usa respiro lateral único de 10px nas páginas mobile', () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('.page{ padding: 10px;')
    expect(css).toContain('.page-authenticated .page{ padding: 12px 10px 34px;')
  })

  test('áreas autenticadas não podem ampliar a viewport horizontal', () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('.page-authenticated{ min-width: 0; overflow-x: clip;')
    expect(css).toContain('.page-authenticated .content-shell,')
    expect(css).toContain('.page-authenticated .page{ min-width: 0; max-width: 100%;')
    expect(css).toContain('overflow-x: clip;')
  })

  test('workspace do campeonato respeita o mesmo respiro mobile', () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('.panel-workspace-shell .panel-workspace-return{padding:9px 10px}')
    expect(css).toContain('gap:10px;padding:14px 10px')
  })

  test('não reintroduz margem zero no container mobile principal', () => {
    const css = read('web/app/globals.css')
    const mobileStart = css.indexOf('} @media (max-width: 760px){')
    const mobileSlice = css.slice(mobileStart, mobileStart + 700)
    expect(mobileSlice).not.toContain('.page{ padding: 0;')
  })
})
