import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8').toLowerCase()

test('funções internas da agenda não ficam executáveis pela API pública', () => {
  const migration = read('supabase/migrations/20260908204329_bloquear_execucao_publica_funcoes_agenda.sql')
  const functions = [
    'public.sync_agenda_compromissos_jogo(uuid)',
    'public.trg_rebuild_agenda_campeonato()',
    'public.trg_sync_agenda_jogo()',
  ]

  for (const functionName of functions) {
    expect(migration).toContain(`revoke execute on function ${functionName} from public, anon, authenticated`)
    expect(migration).toContain(`grant execute on function ${functionName} to service_role`)
  }
})
