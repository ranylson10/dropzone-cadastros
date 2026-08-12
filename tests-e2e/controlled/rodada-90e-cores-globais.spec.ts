import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const colorRoute = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/artes-postagem/colors/route.ts'), 'utf8')

test('90E biblioteca visual separa imagens e cores sem abrir o editor', () => {
  expect(workspace).toContain("useState<'images' | 'colors'>('images')")
  expect(workspace).toContain("setLibrarySection('images')")
  expect(workspace).toContain("setLibrarySection('colors')")
  expect(workspace).toContain('Cores usadas nas artes')
})

test('90E inventário detecta apenas cores hex configuradas nos templates', () => {
  expect(colorRoute).toContain('const HEX_COLOR = /^#[0-9a-f]{6}$/i')
  expect(colorRoute).toContain('collectColors(artwork.background_color, counts)')
  expect(colorRoute).toContain('collectColors(artwork.blocks || [], counts)')
  expect(colorRoute).toContain('sort((a, b) => b.references - a.references')
})

test('90E troca global substitui fundo e cores internas dos blocos', () => {
  expect(colorRoute).toContain('function replaceExactColor')
  expect(colorRoute).toContain('background_color: backgroundChanged ? to : artwork.background_color')
  expect(colorRoute).toContain('blocks: replacedBlocks.value')
  expect(colorRoute).toContain('updated_references: updatedReferences')
})

test('90E usuário confere usos e confirma substituição em todas as artes', () => {
  expect(workspace).toContain('ONDE ESTA COR É USADA')
  expect(workspace).toContain('replaceLibraryColor(entry)')
  expect(workspace).toContain('Substituir em todas')
  expect(workspace).toContain('Cor substituída em ${body.updated_references || 0} uso(s)')
})
