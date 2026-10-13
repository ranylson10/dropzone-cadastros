import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Campeonato mobile — encerramento, premiação e publicação final',()=>{
  test('mantém fechamento seguro e ranking público sem ocultar o campeonato',async()=>{
    const panel=read('app/src/screens/ChampionshipFinalizationPanel.tsx')
    const lifecycle=read('app/src/screens/MobileLifecyclePanel.tsx')
    const lifecycleTransport=read('app/src/lib/lifecycle-write.ts')
    const management=read('app/src/screens/ChampionshipManagementScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const advanced=read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')

    expect(management).toMatch(/\[\s*["']final["']\s*,\s*["']Final["']\s*\]/)
    expect(management).toContain('ChampionshipFinalizationPanel')
    expect(panel).toContain('action: "create_prize"')
    expect(panel).not.toContain('action: "publish_final"')
    expect(panel).not.toContain('action: "reopen_final"')
    expect(panel).toContain('<MobileLifecyclePanel')
    expect(lifecycle).toContain("visible.board?.contract.lifecycle_write_mode === 'atomic'")
    expect(lifecycle).toContain('visible.busy || !available || !!visible.pending')
    expect(lifecycle).toContain('accessibilityState={{ disabled }}')
    expect(lifecycle).toContain('Encerramento e reabertura temporariamente indisponíveis.')
    expect(lifecycle).toContain('Todas as etapas e divisões encerradas serão ativadas.')
    expect(lifecycle).toContain('Repetir tentativa original')
    expect(lifecycleTransport).toContain('/estrutura-avancada/lifecycle-atomico')
    expect(lifecycleTransport).toContain('assertLifecycleResponse')
    expect(lifecycleTransport).not.toContain('championshipAdvancedAction')
    expect(panel).toContain('championshipFinalTeams')
    expect(panel).toContain('championshipFinalMvp')

    expect(api).toContain('/estrutura-avancada')
    expect(api).toContain('/estatisticas/equipes')
    expect(api).toContain('/estatisticas/mvp')

    expect(advanced).toContain('assertLifecycleActionSafe(action)')
    expect(advanced).not.toContain('final_publicado_em')
    expect(advanced).not.toContain('final_campeao_campeonato_equipe_id')

    expect(advanced).not.toContain("from('campeonatos').update({ status: 'encerrado'")
    expect(advanced).not.toContain("from('campeonatos').update({ status: 'encerrada'")
  })
})
