import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88C — dados reais no pacote de overlays', () => {
  test('adapter reaproveita as fontes stream existentes sem criar endpoints paralelos', () => {
    const service = source('web/features/campeonatos/stream/services/stream-package-data.service.ts')
    expect(service).toContain("from './stream-data.service'")
    expect(service).toContain("'equipes_geral'")
    expect(service).toContain("'equipes_partida'")
    expect(service).toContain("'mvp_partida'")
    expect(service).toContain("'mvp_dia'")
    expect(service).toContain("'mvp_geral'")
    expect(service).toContain("'mapas'")
    expect(service).toContain("'proxima_queda'")
    expect(service).not.toContain('/api/campeonatos/${campeonatoId}/stream/package-data')
  })

  test('campeão usa a fonte oficial já existente e não inventa vencedor', () => {
    const service = source('web/features/campeonatos/stream/services/stream-package-data.service.ts')
    expect(service).toContain('/estatisticas/campeao')
    expect(service).toContain('payload?.final_concluida')
    expect(service).toContain('O campeão aparece automaticamente quando a final estiver concluída.')
  })

  test('editor remove dados fictícios e carrega somente a overlay selecionada', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('loadStreamPackageRenderData(props.campeonatoId, activeType)')
    expect(editor).not.toContain('setInterval(')
    expect(editor).toContain('Atualizar dados')
    expect(editor).not.toContain('PREVIEW_LOGO')
    expect(editor).not.toContain('EQUIPE 01')
    expect(editor).not.toContain('PLAYER 1')
  })

  test('equipes classificadas não recebem regra inventada enquanto a regra do campeonato não estiver definida', () => {
    const service = source('web/features/campeonatos/stream/services/stream-package-data.service.ts')
    expect(service).toContain("source: 'qualification-rule'")
    expect(service).toContain('Defina a regra de classificação do campeonato')
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain('emptyMessage')
    expect(stage).toContain('stream-package-render-empty')
  })
})
