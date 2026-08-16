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

test('card 4:5 preserva o banner inteiro sem corte', () => {
  const css = source('web/features/directory/components/championship-directory.css')
  expect(css).toContain('object-fit:contain;object-position:center')
})

test('banner da vitrine é preparado em WebP 4:5 antes do upload', () => {
  const fields = source('web/features/dropzone/components/form-fields.tsx')
  expect(fields).toContain("campeonato_banner: { width: 1200, height: 1500, kindLabel: 'banner 4:5' }")
  expect(fields).toContain("canvas.toBlob(resolve, 'image/webp', 0.82)")
})

test('vitrine faz download sob demanda e a entrega fica em cache', () => {
  const directory = source('web/features/directory/components/DirectoryListClient.tsx')
  const mediaRoute = source('web/app/api/media/[bucket]/[...path]/route.ts')
  expect(directory).toContain('loading="lazy"')
  expect(mediaRoute).toContain('public, max-age=${CACHE_SECONDS}, immutable')
})


test('proxy de mídia consegue servir bucket privado por URL assinada', () => {
  const route = source('web/app/api/media/[bucket]/[...path]/route.ts')
  expect(route).toContain("import { supabaseAdmin, supabaseUrl } from '@backend/shared/supabase-admin'")
  expect(route).toContain("supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 60)")
  expect(route).toContain("upstream = await fetch(signed.signedUrl")
})
