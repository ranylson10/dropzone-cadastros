import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

test.describe('Rodada 138 — escopo do produto Web e separação do Engine', () => {
  test('a experiência Web aceita somente os quatro perfis do produto', () => {
    const types = read('web/lib/types.ts')
    const validation = read('web/lib/validation.ts')
    const register = read('web/app/api/auth/register/route.ts')

    expect(types).toContain("WEB_PROFILE_TYPES = ['produtora', 'equipe', 'jogador', 'manager']")
    expect(validation).toContain('export function assertWebProfileType')
    expect(register).toContain('assertWebProfileType(body.profile_type)')
    expect(register).not.toContain("profileType === 'broadcast'")
  })

  test('conta técnica broadcast não entra na navegação nem na seleção normal de perfil', () => {
    const shell = read('web/components/layout/AppShell.tsx')
    const header = read('web/components/layout/AppHeader.tsx')
    const home = read('web/features/dropzone/DropZoneHome.tsx')
    const authReturn = read('web/features/auth/auth-return.ts')

    expect(shell).toContain('isWebProfileType')
    expect(header).toContain('visibleAccounts = accounts.filter')
    expect(home).toContain('WEB_PROFILE_TYPES.map')
    expect(authReturn).toContain('return isWebProfileType(value) ? value : null')
  })

  test('painel da produtora não oferece transmissão, stream ou exportação técnica como aba', () => {
    const tabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(tabs).not.toContain("'stream'")
    expect(tabs).not.toContain("'exportar'")
    expect(panel).not.toContain('<CampeonatoStreamTab')
    expect(panel).not.toContain('<CampeonatoExportTab')
  })

  test('criação de campeonato cobra somente recursos pertencentes ao site', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    const adminPrice = read('web/app/api/admin/precos/route.ts')
    const admin = read('web/app/admin/page.tsx')

    expect(form).toContain('export: false')
    expect(form).toContain('stream: false')
    expect(form).toContain('broadcast: false')
    expect(form).not.toContain('Export / Spec')
    expect(form).not.toContain('Overlays Stream')
    expect(form).not.toContain('Broadcast pack')
    expect(adminPrice).toContain('export: false, stream: false')
    expect(admin).toContain("!['rec_export', 'rec_stream', 'rec_broadcast'].includes")
  })

  test('pontuador Web cuida de competição e não controla transmissão ou overlays', () => {
    const scorer = read('web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx')

    expect(scorer).toContain('Atraso do site')
    expect(scorer).not.toContain('/pontuador/transmissao')
    expect(scorer).not.toContain('setJogoTransmissao')
    expect(scorer).not.toContain('setQuedaTransmissao')
    expect(scorer).not.toContain('Definir jogo da transmissao')
    expect(scorer).not.toContain('nas overlays')
  })

  test('Lili orienta gestão competitiva sem oferecer OBS ou central de transmissão', () => {
    const types = read('web/features/lili/types.ts')
    const router = read('web/features/lili/intent-router.ts')
    const chat = read('web/app/api/lili/chat/route.ts')
    const tools = read('web/features/lili/tools.ts')

    for (const source of [types, router, chat, tools]) {
      expect(source).not.toContain('abrir_central_transmissao')
      expect(source).not.toContain('Transmissão e OBS')
    }
    expect(chat).toContain('Pontuação e resultados')
  })

  test('contratos necessários para Engine/desktop continuam preservados', () => {
    expect(exists('web/app/api/desktop/campeonatos/[id]/estatisticas/route.ts')).toBeTruthy()
    expect(exists('web/app/api/desktop/campeonatos/[id]/baseline/route.ts')).toBeTruthy()
    expect(exists('web/app/api/desktop/campeonatos/[id]/partidas/[partidaId]/resultado/route.ts')).toBeTruthy()
    expect(exists('web/app/api/stream/editor-data/route.ts')).toBeTruthy()
    expect(exists('web/app/api/campeonatos/[id]/stream/data/route.ts')).toBeTruthy()
  })

  test('frontend não captura banco em realtime nem dados brutos do SPEC diretamente', () => {
    const dirs = ['web/app', 'web/components', 'web/features']
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const relative = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(relative)
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(relative)
      }
    }
    dirs.forEach(walk)
    const source = files.map(read).join('\n')

    expect(source).not.toContain('supabase.channel(')
    expect(source).not.toContain("postgres_changes")
    expect(source).not.toContain('supabase.from(')
    expect(source).not.toContain('new WebSocket(')
  })
})
