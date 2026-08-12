import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('90H encerra o drag quando o botão do mouse não está pressionado', () => {
  expect(workspace).toContain("if ((event.buttons & 1) === 0)")
  expect(workspace).toContain('releasePointerCapture(event.pointerId)')
  expect(workspace).toContain("onLostPointerCapture={() => { dragRef.current = null }}")
})

test('90H permite deslocar eliminados separadamente dos classificados', () => {
  expect(types).toContain('eliminatedOffsetX: number')
  expect(types).toContain('eliminatedOffsetY: number')
  expect(workspace).toContain('Deslocamento X eliminados')
  expect(workspace).toContain('Deslocamento Y eliminados')
  expect(workspace).toContain('block.x + style.eliminatedOffsetX')
})

test('90H mantém a seção e o título Eliminados visíveis mesmo antes de haver linhas', () => {
  expect(workspace).not.toContain("{eliminatedRows.length ? <div className=\"post-artworks-qualified-eliminated\"")
  expect(workspace).toContain('style.eliminatedTitle')
  expect(workspace).toContain('style.sectionGap + style.eliminatedOffsetY')
})
