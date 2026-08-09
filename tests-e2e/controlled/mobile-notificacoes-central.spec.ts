import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — central de notificações',()=>{
  test('usa leitura, resposta, marcação em massa e arquivamento oficiais',async()=>{
    const screen=read('app/src/screens/InvitesScreen.tsx')
    const lib=read('app/src/lib/notifications.ts')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/notificacoes/route.ts')

    expect(screen).toContain('NotificationFilter')
    expect(screen).toContain("['todas','nao_lidas','acoes','lidas']")
    expect(screen).toContain('notificationMatchesFilter')
    expect(screen).toContain('mobileApi.respondNotification')
    expect(screen).toContain('mobileApi.markAllNotificationsRead')
    expect(screen).toContain('mobileApi.archiveNotification')
    expect(screen).toContain('mobileApi.archiveAllReadNotifications')
    expect(screen).toContain('RefreshControl')

    expect(lib).toContain("filter==='acoes'")
    expect(lib).toContain('notificationCategory')

    expect(api).toContain('mark_all_read:true')
    expect(api).toContain('include_actionable:includeActionable')
    expect(api).toContain('/api/notificacoes?all_read=1')

    expect(route).toContain('const markAll = Boolean(body.mark_all_read)')
    expect(route).toContain('include_actionable')
    expect(route).toContain("const archiveAllRead = req.nextUrl.searchParams.get('all_read') === '1'")
    expect(route).toContain(".neq('status', 'arquivada')")
    expect(screen).not.toContain('WebView')
  })
})
