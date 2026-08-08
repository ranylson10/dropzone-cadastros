import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test.describe('Prazo de escalação por jogo', () => {
  test('schema e serviço aceitam abertura e fechamento em horas antes do jogo', async () => {
    const migration = await readFile(path.join(process.cwd(), 'database/migrations/20260807_prazo_escalacao_por_jogo.sql'), 'utf8')
    const service = await readFile(path.join(process.cwd(), 'backend/src/campeonatos/jogos/jogos.service.ts'), 'utf8')

    expect(migration).toContain('escalacao_abre_horas_antes')
    expect(migration).toContain('escalacao_fecha_horas_antes')
    expect(service).toContain('escalacao_abre_horas_antes')
    expect(service).toContain('A escalação precisa abrir antes de fechar')
  })

  test('formulário de jogos envia a configuração nova', async () => {
    const home = await readFile(path.join(process.cwd(), 'web/features/dropzone/DropZoneHome.tsx'), 'utf8')
    const tab = await readFile(path.join(process.cwd(), 'web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx'), 'utf8')

    expect(home).toContain('escalacao_abre_horas_antes')
    expect(home).toContain('escalacao_fecha_horas_antes')
    expect(tab).toContain('Abre escalação (h antes)')
    expect(tab).toContain('Fecha escalação (h antes)')
  })

  test('backend bloqueia escalação fora da janela e jogador duplicado', async () => {
    const helper = await readFile(path.join(process.cwd(), 'backend/src/campeonatos/lineup-window.ts'), 'utf8')
    const lineApi = await readFile(path.join(process.cwd(), 'web/app/api/equipes/[id]/lines/[lineId]/route.ts'), 'utf8')
    const tokenApi = await readFile(path.join(process.cwd(), 'web/app/api/escalacoes/[token]/route.ts'), 'utf8')

    expect(helper).toContain('resolveLineupWindow')
    expect(helper).toContain('assertPlayerNotInAnotherTeam')
    expect(helper).toContain('assertLineupSwapAllowed')
    expect(helper).toContain('Troca de jogadores bloqueada')
    expect(lineApi).toContain('assertLineupWindowOpen')
    expect(lineApi).toContain('assertLineupSwapAllowed')
    expect(tokenApi).toContain('prazo_escalacao')
    expect(tokenApi).toContain('assertPlayerNotInAnotherTeam')
  })
})
