import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 142 — agenda, notificações e realtime seguro', () => {
  test('notificações usam Broadcast privado e continuam buscando conteúdo pela API', () => {
    const source = read('web/components/notifications/NotificationBell.tsx')
    expect(source).toContain(".channel(`user:${userId}:notifications`, { config: { private: true } })")
    expect(source).toContain(".on('broadcast', { event: 'notification_changed' }")
    expect(source).toContain("fetch('/api/notificacoes?limit=30'")
    expect(source).not.toContain(".on('postgres_changes'")
    expect(source).not.toContain(".from('notificacoes')")
  })

  test('realtime tem fallback de polling e atualização ao voltar para a página', () => {
    const source = read('web/components/notifications/NotificationBell.tsx')
    expect(source).toContain('window.setInterval(refresh, 90_000)')
    expect(source).toContain("window.addEventListener('focus', refresh)")
    expect(source).toContain("document.addEventListener('visibilitychange', onVisibility)")
    expect(source).toContain("realtimeState === 'live' ? 'Atualização instantânea' : 'Atualização automática'")
  })

  test('migration transmite apenas id/operação e autoriza somente o tópico do próprio usuário', () => {
    const migration = read('supabase/migrations/20260924173500_notificacoes_realtime_privado.sql')
    expect(migration).toContain('realtime.send(')
    expect(migration).toContain("'notification_changed'")
    expect(migration).toContain("'user:' || recipient::text || ':notifications'")
    expect(migration).toContain("realtime.messages.extension = 'broadcast'")
    expect(migration).toContain("(select realtime.topic()) = 'user:' || (select auth.uid())::text || ':notifications'")
    expect(migration).not.toContain("'titulo'")
    expect(migration).not.toContain("'corpo'")
    expect(migration).not.toContain("'payload'")
  })

  test('agenda força atualização sem depender do cache quando necessário', () => {
    const service = read('web/features/agenda/services/agenda-client.ts')
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    expect(service).toContain('force?: boolean')
    expect(service).toContain('if (!params.force && cached')
    expect(calendar).toContain('window.setInterval(refresh, 60_000)')
    expect(calendar).toContain('void load(true)')
  })

  test('agenda pessoal destaca próximos compromissos antes da grade completa', () => {
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    expect(calendar).toContain('Próximos compromissos')
    expect(calendar).toContain('Atualização automática')
    expect(calendar).toContain('upcomingItems')
    expect(calendar.indexOf('Próximos compromissos')).toBeLessThan(calendar.indexOf('agenda-content-grid'))
  })

  test('agendas contextuais usam lista de datas úteis em vez de planilha mensal', () => {
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    expect(calendar).toContain("const contextualMode = props.compact || props.scope !== 'me'")
    expect(calendar).toContain('data-testid="agenda-event-only"')
    expect(calendar).toContain('const sourceItems = contextualMode ? allItems : items')
  })

  test('mobile mantém próximos compromissos em uma coluna', () => {
    const css = read('web/features/agenda/agenda.css')
    expect(css).toContain('.agenda-next-list { grid-template-columns: 1fr; }')
    expect(css).toContain('.agenda-next-item { border-right: 0; }')
  })

  test('rodada 138 continua proibindo captura direta do banco/SPEC', () => {
    const contract = read('tests-e2e/controlled/rodada-138-escopo-web-core.spec.ts')
    expect(contract).toContain('Broadcast privado pode ser usado')
    expect(contract).toContain('expect(source).not.toContain("postgres_changes")')
    expect(contract).toContain("expect(source).not.toContain('supabase.from(')")
    expect(contract).toContain("expect(source).not.toContain('new WebSocket(')")
  })
})
