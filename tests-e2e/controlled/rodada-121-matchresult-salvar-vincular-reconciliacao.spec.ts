import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('pontuador usa um unico salvar quando existe MatchResult em previa', async () => {
  const source = read('web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx')
  expect(source).toContain('async function saveCurrentDrop()')
  expect(source).toContain('if (preview) return confirmMatch()')
  expect(source).toContain('onClick={() => void saveCurrentDrop()}')
  expect(source).toContain("{preview ? 'Salvar e vincular' : 'Salvar'} Q{selectedDrop?.numero_partida}")
  expect(source).not.toContain('Aplicar equipes vinculadas')
})

test('troca de MatchResult reconcilia resultados e jogadores obsoletos da queda anterior', async () => {
  const source = read('backend/src/campeonatos/estatisticas/matchresult.service.ts')
  expect(source).toContain('async function carregarImportacaoConfirmadaAnterior')
  expect(source).toContain('async function reconciliarSubstituicaoMatchResult')
  expect(source).toContain("from('campeonato_resultados_jogadores')")
  expect(source).toContain(".eq('origem', 'matchresult')")
  expect(source).toContain("from('campeonato_resultados_equipes')")
  expect(source).toContain("from('campeonato_partidas_equipes_presenca')")
  expect(source).toContain("status: 'deletado'")
  expect(source).toContain("from('equipe_line_jogadores')")
  expect(source).toContain("status: 'inativo'")
})

test('limpeza preserva jogador usado em outra queda, formacao ou substituicao', async () => {
  const source = read('backend/src/campeonatos/estatisticas/matchresult.service.ts')
  expect(source).toContain("from('matchresult_importacoes_jogadores')")
  expect(source).toContain(".eq('status', 'confirmada')")
  expect(source).toContain("from('campeonato_substituicoes')")
  expect(source).toContain("from('equipe_formacao_historico')")
  expect(source).toContain("from('campeonato_resultados_jogadores').select('campeonato_jogador_id')")
})

test('substituicao cancela importacao anterior e confirma somente a nova', async () => {
  const source = read('backend/src/campeonatos/estatisticas/matchresult.service.ts')
  expect(source).toContain(".update({ status: 'cancelada'")
  expect(source).toContain(".update({ status: 'confirmada', confirmado_por: userId")
  expect(source).toContain('reconciliacao')
})

test('MatchResult nao sobrescreve a origem de um jogador que ja existia no elenco', async () => {
  const source = read('backend/src/campeonatos/estatisticas/matchresult.service.ts')
  expect(source).toContain(".select('id,origem,created_at').eq('equipe_id', equipeId)")
  expect(source).toContain(".insert({ equipe_id: equipeId, ...rosterPayload, origem: 'matchresult' })")
  expect(source).not.toContain("origem: 'matchresult',\n    status: 'ativo',")
})
