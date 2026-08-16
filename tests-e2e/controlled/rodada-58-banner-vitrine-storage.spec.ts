import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('vitrine usa banner_url atual sem depender de post-art', () => {
  const directory = source('web/features/directory/components/DirectoryListClient.tsx')
  const server = source('web/features/directory/server.ts')
  expect(server).toContain('banner: first(row.banner_url)')
  expect(directory).toContain("cachedStorageMediaUrl(item.banner || item.image || '')")
  expect(directory).not.toContain('postArtUrl')
  expect(directory).not.toContain('artes-postagem')
})

test('banner do Storage passa pelo cache do próprio app', () => {
  const directory = source('web/features/directory/components/DirectoryListClient.tsx')
  const media = source('web/lib/upload-public.ts')
  expect(directory).toContain("import { cachedStorageMediaUrl } from '@/lib/upload-public'")
  expect(media).toContain("return `/api/media/${parts.map(encodeURIComponent).join('/')}`")
})

test('card 4:5 preenche a capa sem bordas de contain', () => {
  const css = source('web/features/directory/components/championship-directory.css')
  expect(css).toContain('object-fit:cover;object-position:center')
})
