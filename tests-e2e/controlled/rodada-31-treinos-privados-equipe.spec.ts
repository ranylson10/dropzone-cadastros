import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 31 — Treinos privados no painel da equipe', () => {
  test('painel da equipe ganha aba Treinos', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain("'campeonatos' | 'treinos' | 'lines'")
    expect(panel).toContain("tab === 'treinos'")
    expect(panel).toContain('Treinos da equipe')
  })

  test('Treinos são derivados do tipo Xtreino já existente', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain("String(item.tipo || '').toLowerCase() === 'xtreino'")
    expect(route).toContain("from('campeonato_equipes')")
    expect(route).toContain("from('campeonatos')")
  })

  test('endpoint só consulta equipes controladas pelo usuário', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain('getBearerUser(req)')
    expect(route).toContain('listControllableEquipes')
    expect(route).toContain(".in('equipe_id', teamIds)")
  })

  test('análise privada agrega resultado e telemetria já disponíveis', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain("from('campeonato_estatisticas_equipes_detalhe')")
    expect(route).toContain("from('campeonato_estatisticas_mvp_detalhe')")
    expect(route).toContain('colocacao_media')
    expect(route).toContain('dano:')
    expect(route).toContain('assistencias:')
    expect(route).toContain('revives:')
  })

  test('painel diferencia explicitamente resultado público e análise privada', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('Análise privada')
    expect(panel).toContain('Privado da equipe')
    expect(panel).toContain('Dano, assistências, revives')
  })

  test('detalhe individual não é colocado na classificação pública', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain("export async function GET(req: NextRequest)")
    expect(route).not.toContain("NextResponse.json({ publico:")
  })

  test('próximas análises ficam preparadas sem inventar dados', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('Armas, habilidades, safes e análise por mapa entram nas próximas rodadas')
  })
})
