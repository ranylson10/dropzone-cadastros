import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function source(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

test.describe('Rodada 56 — limpeza de produção', () => {
  test('painel não exibe contador de jogadores falso', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).not.toContain('const totalPlayers = 0')
    expect(panel).not.toContain("{ label: 'Jogadores', value: totalPlayers }")
    expect(panel).toContain('<CampeonatoJogadoresTab campeonatoId={selectedChamp.id} />')
  })

  test('textos visíveis da produtora não carregam mojibake conhecido', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    for (const broken of ['RevisÃ', 'bÃ¡sicos', 'DivulgaÃ', 'PublicaÃ', 'PÃ¡gina', 'concluÃ', 'RevisÃµes', 'pendÃªncia', 'HistÃ³rico', 'Ãšltimas', 'Â·']) {
      expect(panel).not.toContain(broken)
    }
    expect(panel).toContain('Revisão financeira atualizada.')
    expect(panel).toContain('Página de vagas')
    expect(panel).toContain('Últimas decisões')
  })

  test('erros públicos de mídia e upload usam português válido', () => {
    const media = source('web/app/api/media/[bucket]/[...path]/route.ts')
    const upload = source('web/lib/upload-public.ts')
    expect(media).toContain('Não encontrado.')
    expect(media).not.toContain('NÃ£o encontrado.')
    expect(upload).toContain('Não foi possível preparar a imagem.')
    expect(upload).not.toContain('NÃ£o foi possÃ­vel preparar a imagem.')
  })

  test('estrutura avançada antiga continua fora da UI ativa', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).not.toContain('CampeonatoStructureWorkspace')
    expect(panel).not.toContain('AdvancedStructureTab')
    expect(panel).toContain("rawSection === 'estrutura' || rawSection === 'estrutura_avancada' ? 'grupos'")
  })
})
