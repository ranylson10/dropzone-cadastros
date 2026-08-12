import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')
const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
const editor = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const api = read('web/app/api/campeonatos/[id]/stream/pack/route.ts')
const migration = read('database/migrations/20260811_stream_output_layouts.sql')

test('89D cria layouts de saída no mesmo pacote sem tabela paralela', () => {
  expect(types).toContain('export type StreamOutputLayout')
  expect(types).toContain('output_layouts: StreamOutputLayout[]')
  expect(migration).toContain('alter table if exists public.campeonato_stream_pack')
  expect(migration).toContain('add column if not exists output_layouts jsonb')
  expect(migration).not.toContain('create table')
})

test('89D permite canvas customizado e fundo transparente cor ou imagem', () => {
  expect(types).toContain("export type StreamOutputBackgroundType = 'transparent' | 'color' | 'image'")
  expect(outputs).toContain('Post vertical 4:5')
  expect(outputs).toContain('Story / Reels 9:16')
  expect(outputs).toContain('Atual / personalizado')
  expect(outputs).toContain('Enviar imagem de fundo')
})

test('89D composição aceita múltiplas áreas reutilizando overlays oficiais', () => {
  expect(types).toContain('areas: StreamOutputArea[]')
  expect(outputs).toContain('Adicionar área')
  expect(outputs).toContain('STREAM_SYSTEM_OVERLAYS.map')
  expect(outputs).toContain('Use a mesma overlay quantas vezes quiser')
})

test('89D cada área define faixa de dados independente para 1–12 e 13–24', () => {
  expect(types).toContain('dataStart: number')
  expect(types).toContain('dataEnd: number')
  expect(outputs).toContain('next.items.slice(start, end)')
  expect(outputs).toContain('dataStart')
  expect(outputs).toContain('dataEnd')
})

test('89D prévia reaproveita o mesmo StreamPackageStage e variantes existentes', () => {
  expect(outputs).toContain('<StreamPackageStage')
  expect(outputs).toContain('outputProfileId={props.area.profileId}')
  expect(outputs).toContain('loadStreamPackageRenderData')
  expect(outputs).not.toContain('StreamOutputStage')
})

test('89D salva layouts no pack com normalização e schema 3', () => {
  expect(config).toContain('normalizeStreamOutputLayouts')
  expect(api).toContain('output_layouts')
  expect(editor).toContain('output_layouts: pack.output_layouts')
  expect(editor).toContain('schema_version: 3')
  expect(editor).toContain('>Postagens</button>')
})
