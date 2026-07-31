import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('85K mantém avisos operacionais manuais e confirmações do fluxo de escolha', async () => {
  const adminRoute = read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
  const teamRoute = read('web/app/api/campeonatos/[id]/escolha-grupo/route.ts')
  const component = read('web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx')

  expect(adminRoute).toContain("action === 'send_group_choice_notifications'")
  expect(adminRoute).toContain("from('notificacoes').insert")
  expect(adminRoute).toContain('remetente_auth_user_id: input.senderId')
  expect(adminRoute).toContain("escolha_grupo_cancelada_admin")
  expect(adminRoute).toContain("escolha_grupo_restaurada_admin")
  expect(teamRoute).toContain("escolha_grupo_confirmada")
  expect(teamRoute).toContain("escolha_grupo_editada")
  expect(teamRoute).toContain("escolha_grupo_cancelada")
  expect(teamRoute).toContain("escolha_grupo_restaurada")
  expect(component).toContain('Avisar apenas pendentes')
  expect(component).toContain('Prazo próximo')
  expect(component).not.toContain('distribuir automaticamente')
})
