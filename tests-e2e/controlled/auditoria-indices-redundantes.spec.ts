import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const redundantIndexes = [
  'broadcasts_auth_user_idx',
  'campeonato_configuracoes_campeonato_id_idx',
  'campeonato_equipes_campeonato_idx',
  'campeonato_equipes_equipe_idx',
  'campeonato_fases_bonus_ranking_fase_idx',
  'campeonato_jogadores_campeonato_idx',
  'campeonato_jogadores_equipe_idx',
  'campeonato_rulebooks_campeonato_id_idx',
  'comprovantes_inscricao_codigo_idx',
  'convites_tokens_token_idx',
  'convites_tokens_token_uidx',
  'uq_equipes_auth_user_id',
  'equipes_username_unique',
  'equipes_perfis_auth_idx',
  'tokens_token_idx',
]

test('migration de índices redundantes preserva constraints UNIQUE', () => {
  const sources = [
    read('database/migrations/20260908_consolidar_indices_redundantes.sql'),
    read('supabase/migrations/20260908130000_consolidar_indices_redundantes.sql'),
  ]

  for (const source of sources) {
    for (const indexName of redundantIndexes) {
      expect(source).toContain(`drop index if exists public.${indexName}`)
    }
    expect(source).not.toMatch(/drop\s+index[^;]+(?:_key|_pkey)\b/i)
    expect(source).not.toMatch(/drop\s+constraint/i)
    expect(source).toContain('begin;')
    expect(source).toContain('commit;')
  }
})

test('inventário publicado removeu os alvos e preservou os equivalentes protegidos', () => {
  const inventory = JSON.parse(read('relatorios-testes/banco-publicado.json')) as {
    indexes?: Array<{ index_name?: string }>
  }
  const publishedNames = new Set((inventory.indexes ?? []).map((index) => index.index_name))
  const migration = read('database/migrations/20260908_consolidar_indices_redundantes.sql')
  const targets = [...migration.matchAll(/drop\s+index\s+if\s+exists\s+public\.([a-z0-9_]+)/gi)].map((match) => match[1])
  const protectedIndexes = [
    'broadcasts_auth_user_unique',
    'campeonato_configuracoes_campeonato_id_key',
    'campeonato_fases_bonus_ranking_unique',
    'campeonato_rulebooks_campeonato_id_key',
    'comprovantes_inscricao_codigo_key',
    'convites_tokens_token_key',
    'equipes_auth_user_unique',
    'equipes_username_idx',
    'equipes_perfis_auth_user_id_key',
    'tokens_token_key',
  ]

  expect(targets).toHaveLength(15)
  expect(targets.every((name) => !publishedNames.has(name))).toBe(true)
  expect(protectedIndexes.every((name) => publishedNames.has(name))).toBe(true)
})
