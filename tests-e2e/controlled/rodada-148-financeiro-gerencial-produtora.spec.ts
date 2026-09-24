import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const financePanel = read('web/features/produtoras/components/ProducerFinancePanel.tsx')
const financeRoute = read('web/app/api/produtora/financeiro/route.ts')
const financeBackend = read('backend/src/produtora/finance.ts')
const migration = read('supabase/migrations/20260924213031_produtora_financeiro_gerencial.sql')
const styles = read('web/app/globals.css')
const rlsClassification = read('database/rls-classification.json')

test.describe('Rodada 148 — financeiro gerencial da produtora', () => {
  test('financeiro deixa de ser atalho e vira painel gerencial real', () => {
    expect(panel).toContain('<ProducerFinancePanel')
    expect(panel).toContain('scope="workspace"')
    expect(panel).toContain('scope="championship"')
    expect(panel).toContain('Resumo gerencial')
  })

  test('carteira continua separada da gestão financeira', () => {
    expect(financePanel).toContain('Carteira é saldo. Aqui ficam desempenho, custos, metas e projeções.')
    expect(financePanel).toContain('href="/carteira"')
    expect(financePanel).toContain('Financeiro gerencial')
  })

  test('dashboard mostra os indicadores financeiros pedidos', () => {
    expect(financePanel).toContain('Receita bruta')
    expect(financePanel).toContain('Receita líquida')
    expect(financePanel).toContain('Custos')
    expect(financePanel).toContain('Lucro estimado')
    expect(financePanel).toContain('ticket médio')
    expect(financePanel).toContain('recebível(is)')
    expect(financePanel).toContain('premiação comprometida')
    expect(financePanel).toContain('Receitas previstas')
    expect(financePanel).toContain('Despesas previstas')
    expect(financePanel).toContain('Lucro projetado')
    expect(financeBackend).toContain('lucro_projetado_centavos')
  })

  test('metas mensais acompanham receita lucro e vagas', () => {
    expect(financePanel).toContain('Meta mensal')
    expect(financePanel).toContain('Receita alvo')
    expect(financePanel).toContain('Lucro alvo')
    expect(financePanel).toContain('Vagas alvo')
    expect(financeBackend).toContain('progresso_meta_receita_percentual')
    expect(financeBackend).toContain('progresso_meta_lucro_percentual')
    expect(financeBackend).toContain('progresso_meta_vagas_percentual')
  })

  test('vendas online entram automaticamente pelo split financeiro existente', () => {
    expect(financeBackend).toContain("from('sistema_comissoes')")
    expect(financeBackend).toContain("row.status === 'creditada'")
    expect(financeBackend).toContain('valor_bruto_centavos')
    expect(financeBackend).toContain('valor_liquido_produtora_centavos')
    expect(financeBackend).toContain('comissao_vendedor_centavos')
    expect(financeBackend).toContain('comissao_plataforma_centavos')
    expect(financeBackend).toContain("from('sistema_pagamentos')")
    expect(financeBackend).toContain(".in('status', ['pendente', 'aguardando'])")
  })

  test('receitas e despesas externas podem ser lançadas manualmente', () => {
    expect(financePanel).toContain('Lançamentos manuais')
    expect(financePanel).toContain('Patrocínio')
    expect(financePanel).toContain('Premiação')
    expect(financePanel).toContain('Design')
    expect(financePanel).toContain('Narração')
    expect(financePanel).toContain('Servidor')
    expect(financePanel).toContain('Produção')
    expect(financeRoute).toContain('createProducerFinanceEntry')
    expect(financeRoute).toContain('updateProducerFinanceEntry')
    expect(financeRoute).toContain('deleteProducerFinanceEntry')
  })

  test('financeiro consolida desempenho por campeonato e vendedor', () => {
    expect(financePanel).toContain('Receita, custo e ocupação')
    expect(financePanel).toContain('Desempenho dos vendedores')
    expect(financeBackend).toContain('ocupacao_percentual')
    expect(financeBackend).toContain('vendedor_manager_id')
  })

  test('backend exige capacidade financeira do workspace em todas as operações', () => {
    const checks = financeBackend.match(/requireProducerWorkspaceAccess\([^\n]+[\s\S]{0,80}'financeiro'\)/g) || []
    expect(checks.length).toBeGreaterThanOrEqual(5)
    expect(financeRoute).toContain('getBearerUser(req)')
    expect(financeRoute).toContain("req.headers.get('x-produtora-id')")
  })

  test('campeonato informado é validado contra a produtora antes da escrita', () => {
    expect(financeBackend).toContain(".eq('produtora_id', produtoraId)")
    expect(financeBackend).toContain("throw new Error('Campeonato não pertence a esta produtora.')")
    expect(financeBackend).toContain('await ensureChampionship(input.produtoraId, input.campeonatoId)')
  })

  test('tabelas gerenciais são privadas e service-role-only', () => {
    expect(migration).toContain('create table public.produtora_financeiro_lancamentos')
    expect(migration).toContain('create table public.produtora_financeiro_metas')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('revoke all on table public.produtora_financeiro_lancamentos from anon, authenticated')
    expect(migration).toContain('revoke all on table public.produtora_financeiro_metas from anon, authenticated')
    expect(rlsClassification).toContain('"produtora_financeiro_lancamentos": "service_role_only"')
    expect(rlsClassification).toContain('"produtora_financeiro_metas": "service_role_only"')
  })

  test('premiação configurada é compromisso separado e não saldo de carteira', () => {
    expect(financeBackend).toContain("select('campeonato_id,premiacao,numero_vagas,valor_inscricao')")
    expect(financeBackend).toContain('premiacao_comprometida_centavos')
    expect(financePanel).toContain('vem da configuração dos campeonatos e aparece separada dos custos realizados')
  })

  test('layout financeiro continua responsivo em desktop e mobile', () => {
    expect(styles).toContain('.producer-finance-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))')
    expect(styles).toContain('.producer-finance-secondary-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr))')
    expect(styles).toContain('@media(max-width:760px)')
    expect(styles).toContain('.producer-finance-entry-form{grid-template-columns:1fr 1fr}')
    expect(styles).toContain('@media(max-width:520px)')
  })
})
