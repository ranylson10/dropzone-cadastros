import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const internalPolicies = [
  'broadcast_campeonato_links_service_all',
  'broadcast_live_sessions_service_all',
  'broadcasts_service_all',
  'campeonato_cobranca_service_all',
  'campeonato_stream_keys_service_all',
  'campeonato_stream_pack_service_all',
  'campeonato_stream_scenes_service_all',
  'lili_reservas_slot_service_all',
  'sistema_carteira_lancamentos_service_all',
  'sistema_carteiras_service_all',
  'sistema_comissoes_service_all',
  'sistema_compras_vaga_service_all',
  'sistema_pagamentos_service_all',
  'sistema_perfis_cobranca_service_all',
  'sistema_precos_service_all',
  'sistema_saques_service_all',
  'sistema_vendas_assistidas_service_all',
]

test('migration protege e remove somente policies redundantes de roles BYPASSRLS', () => {
  const migration = read('supabase/migrations/20260908205559_remover_policies_redundantes_roles_bypassrls.sql').toLowerCase()

  expect(migration).toContain("rolname in ('service_role', 'supabase_admin', 'postgres')")
  expect(migration).toContain('and rolbypassrls')
  for (const policy of internalPolicies) {
    expect(migration).toContain(`drop policy ${policy} on public.`)
  }
})

test('inventário publicado reflete policies otimizadas', () => {
  const inventory = JSON.parse(read('relatorios-testes/banco-publicado.json')) as {
    policies?: Array<{
      policyname?: string
      roles?: string[]
      qual?: string | null
      with_check?: string | null
    }>
  }
  const policies = inventory.policies ?? []
  const names = new Set(policies.map((policy) => policy.policyname))

  expect(internalPolicies.every((policy) => !names.has(policy))).toBe(true)

  for (const name of ['equipes_select_public', 'jogadores_select_public', 'managers_select_public', 'produtoras_select_public']) {
    const policy = policies.find((candidate) => candidate.policyname === name)
    expect(policy?.roles).toEqual(['anon'])
  }

  const rowExpressions = policies.map((policy) => `${policy.qual ?? ''} ${policy.with_check ?? ''}`)
  expect(rowExpressions.some((expression) => /(?<!select\s)auth\.uid\(\)/i.test(expression))).toBe(false)
})
