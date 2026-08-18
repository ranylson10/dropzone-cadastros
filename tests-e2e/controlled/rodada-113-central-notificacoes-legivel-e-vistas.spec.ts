import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('badge conta notificações ainda não visualizadas, não pendências antigas', () => {
  const route = read('web/app/api/notificacoes/route.ts')

  expect(route).toContain(".neq('status', 'arquivada')")
  expect(route).toContain(".is('read_at', null)")
  expect(route).toContain('const markAllSeen = Boolean(body.mark_all_seen)')
  expect(route).toContain(".update({ read_at: new Date().toISOString() })")
})

test('abrir a central registra visualização sem resolver convites pendentes', () => {
  const source = read('web/components/notifications/NotificationBell.tsx')

  expect(source).toContain("body: JSON.stringify({ mark_all_seen: true })")
  expect(source).not.toContain("body: JSON.stringify({ mark_all_read: true }),\n      })\n    } catch {\n      // A listagem")
  expect(source).toContain("'convite_escalacao_jogador'")
  expect(source).toContain("const actionable = ACTIONABLE_NOTIFICATION_TYPES.has(item.tipo)")
  expect(source).toContain("item.status === 'nao_lida'")
})

test('central organiza tipo, título, texto e horário em hierarquia legível', () => {
  const source = read('web/components/notifications/NotificationBell.tsx')
  const css = read('web/app/globals.css')

  expect(source).toContain('className="notif-inbox-kind"')
  expect(source).toContain('className="notif-inbox-title"')
  expect(source).toContain("<strong>Notificações</strong>")
  expect(source).toContain("'Tudo visto'")
  expect(css).toContain('font-family: Arial,Helvetica,sans-serif')
  expect(css).toContain('.notif-inbox-title{ display:block;')
})

test('somente itens novos recebem destaque visual sutil', () => {
  const source = read('web/components/notifications/NotificationBell.tsx')
  const systemCss = read('web/app/system.css')

  expect(source).toContain("${!item.read_at ? 'is-unseen' : ''}")
  expect(systemCss).toContain('body .notif-inbox-item.is-unseen{background:rgba(201,183,102,.055);box-shadow:inset 2px 0 0 var(--ui-accent)}')
  expect(systemCss).toContain('body .notif-inbox-item.is-pending .notif-inbox-kind{color:var(--ui-accent)}')
})
