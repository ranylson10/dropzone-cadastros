import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('POST de equipes preserva a mensagem real de erros do Supabase', async () => {
  const source = read('web/app/api/campeonatos/[id]/equipes/route.ts')

  expect(source).toContain('function apiErrorMessage(error: unknown, fallback: string)')
  expect(source).toContain("const dbError = error as { message?: unknown; code?: unknown }")
  expect(source).toContain("return code ? `${message} [${code}]` : message")
  expect(source).toContain("apiErrorMessage(error, 'Erro ao adicionar line.')")
  expect(source).not.toContain("error instanceof Error ? error.message : 'Erro ao adicionar line.'")
})
