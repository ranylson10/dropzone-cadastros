import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87N — diretório, notificações e resíduos E2E', () => {
  test('diretório público pagina além do antigo limite de 500 registros', () => {
    const server = read('web/features/directory/server.ts')
    expect(server).toContain('DIRECTORY_PAGE_SIZE = 1000')
    expect(server).toContain('.range(from, to)')
    expect(server).toContain("if (row.deleted_at) return false")
    expect(server).toContain("approval !== 'aprovado'")
  })

  test('correio permite arquivar todas as mensagens já lidas', () => {
    const bell = read('web/components/notifications/NotificationBell.tsx')
    expect(bell).toContain('archiveReadNotifications')
    expect(bell).toContain('/api/notificacoes?all_read=1')
    expect(bell).toContain('Arquivar lidas')
  })

  test('limpeza atua somente em registros marcados como E2E', () => {
    const sql = read('database/auditoria/limpar_residuos_e2e.sql')
    expect(sql).toContain("ilike '%[E2E]%'")
    expect(sql).toContain("ilike '[E2E]%'")
    expect(sql).not.toContain('truncate ')
    expect(sql).not.toContain('delete from public.equipes')
    expect(sql).not.toContain('delete from public.jogadores')
  })
})
