import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('migration oficial valida a identidade do elenco sem alterar dados', () => {
  const official = read('supabase/migrations/20260908120000_validar_identidade_equipe_jogadores.sql')
  const archive = read('database/migrations/20260908_validar_identidade_equipe_jogadores.sql')

  for (const source of [official, archive]) {
    expect(source).toContain('alter table public.equipe_jogadores')
    expect(source).toContain('validate constraint equipe_jogadores_identidade_check')
    expect(source).not.toMatch(/\b(update|delete|insert)\b/i)
  }
})
