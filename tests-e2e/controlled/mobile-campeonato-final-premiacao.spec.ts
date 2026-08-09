import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Campeonato mobile — encerramento, premiação e publicação final',()=>{
  test('mantém fechamento seguro e ranking público sem ocultar o campeonato',async()=>{
    const panel=read('app/src/screens/ChampionshipFinalizationPanel.tsx')
    const management=read('app/src/screens/ChampionshipManagementScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const advanced=read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')

    expect(management).toContain("['final','Final']")
    expect(management).toContain('ChampionshipFinalizationPanel')
    expect(panel).toContain("action:'create_prize'")
    expect(panel).toContain("action:'publish_final'")
    expect(panel).toContain("action:'reopen_final'")
    expect(panel).toContain('championshipFinalTeams')
    expect(panel).toContain('championshipFinalMvp')

    expect(api).toContain('/estrutura-avancada')
    expect(api).toContain('/estatisticas/equipes')
    expect(api).toContain('/estatisticas/mvp')

    expect(advanced).toContain("action === 'publish_final'")
    expect(advanced).toContain("action === 'reopen_final'")
    expect(advanced).toContain(".neq('status', 'finalizada')")
    expect(advanced).toContain("status: 'encerrada'")
    expect(advanced).toContain('final_publicado_em')
    expect(advanced).toContain('final_campeao_campeonato_equipe_id')

    const publishBlock=advanced.slice(advanced.indexOf("action === 'publish_final'"),advanced.indexOf("action === 'reopen_final'"))
    expect(publishBlock).not.toContain("from('campeonatos').update({ status: 'encerrado'")
    expect(publishBlock).not.toContain("from('campeonatos').update({ status: 'encerrada'")
  })
})
