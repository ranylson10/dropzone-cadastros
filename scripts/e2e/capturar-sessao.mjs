import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const PERFIS = new Set(['admin', 'produtora', 'manager', 'equipe', 'jogador'])
const perfil = String(process.argv[2] || '').trim().toLowerCase()

if (!PERFIS.has(perfil)) {
  console.error('Uso: npm run test:e2e:auth:capture -- <admin|produtora|manager|equipe|jogador>')
  process.exit(1)
}

const baseURL = String(process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const expectedOrigin = new URL(baseURL).origin
if (expectedOrigin.includes('127.0.0.1')) {
  throw new Error('Use http://localhost:3000. 127.0.0.1 não compartilha a sessão OAuth de localhost.')
}

const authDir = path.resolve('tests-e2e/.auth')
const output = path.join(authDir, `${perfil}.json`)
const chromeProfileDir = path.resolve('tests-e2e/.chrome-auth-profile', perfil)
const debugPort = 9330 + [...PERFIS].indexOf(perfil)
const cdpURL = `http://127.0.0.1:${debugPort}`

await fs.mkdir(authDir, { recursive: true })
await fs.mkdir(chromeProfileDir, { recursive: true })

function chromeCandidates() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || ''
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    return [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
  }
  if (process.platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
}

async function locateChrome() {
  for (const candidate of chromeCandidates()) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Tenta o próximo caminho conhecido.
    }
  }
  throw new Error('Google Chrome não foi localizado no computador.')
}

async function waitForCdp(timeoutMs = 30_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${cdpURL}/json/version`)
      if (response.ok) return
    } catch {
      // Chrome ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('O Chrome não liberou a porta de depuração dentro do prazo.')
}

function tokenFromPage() {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !key.includes('auth-token')) continue
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null')
      const token = value?.access_token || value?.currentSession?.access_token
      if (typeof token === 'string' && token.length > 20) return token
    } catch {
      // Continua procurando.
    }
  }
  return null
}

const chromePath = await locateChrome()
const profileType = perfil === 'admin' ? '' : `&profileType=${encodeURIComponent(perfil)}`
const loginURL = `${baseURL}/login?returnTo=%2F${profileType}`
const chromeProcess = spawn(
  chromePath,
  [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    loginURL,
  ],
  { detached: false, stdio: 'ignore' },
)

let browser
try {
  await waitForCdp()
  browser = await chromium.connectOverCDP(cdpURL)
  const context = browser.contexts()[0]
  const page = context.pages().find((item) => item.url().startsWith(expectedOrigin)) || (await context.newPage())
  if (!page.url().startsWith(expectedOrigin)) await page.goto(loginURL, { waitUntil: 'domcontentloaded' })

  console.log(`\nFaça login manualmente com a conta de ${perfil.toUpperCase()} no Google Chrome aberto.`)
  console.log('A sessão só será salva depois que /api/me confirmar a autenticação.')
  console.log('Tempo limite: 5 minutos.\n')

  const deadline = Date.now() + 300_000
  let confirmedToken = null
  let confirmedStorage = null
  while (Date.now() < deadline) {
    const localPages = context.pages().filter((item) => item.url().startsWith(expectedOrigin))
    for (const candidate of localPages) {
      try {
        await candidate.waitForLoadState('domcontentloaded', { timeout: 2_000 }).catch(() => undefined)
        const snapshot = await candidate.evaluate(() => {
          const localStorageEntries = []
          for (let index = 0; index < localStorage.length; index += 1) {
            const name = localStorage.key(index)
            if (!name) continue
            localStorageEntries.push({ name, value: localStorage.getItem(name) || '' })
          }
          return { token: (tokenFromPage)(), localStorageEntries }
        })
        const token = snapshot.token
        if (!token) continue
        const response = await context.request.get(`${baseURL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status() === 200) {
          confirmedToken = token
          confirmedStorage = snapshot.localStorageEntries
          break
        }
      } catch {
        // Página navegou durante a leitura; tenta novamente.
      }
    }
    if (confirmedToken) break
    await new Promise((resolve) => setTimeout(resolve, 700))
  }

  if (!confirmedToken) throw new Error('A autenticação não foi confirmada pela API /api/me dentro do prazo.')

  if (!confirmedStorage) {
    throw new Error('A sessão foi confirmada, mas o localStorage não pôde ser capturado.')
  }

  // Em conexões CDP com Chrome persistente, context.storageState() pode omitir
  // localStorage de algumas origens mesmo quando a página já o possui. Montamos
  // o storageState explicitamente a partir da página que /api/me confirmou.
  const cookies = await context.cookies(expectedOrigin)
  const state = {
    cookies,
    origins: [
      {
        origin: expectedOrigin,
        localStorage: confirmedStorage,
      },
    ],
  }
  await fs.writeFile(output, `${JSON.stringify(state, null, 2)}\n`, 'utf8')

  const savedOrigin = state.origins.find((item) => item.origin === expectedOrigin)
  const hasAuthToken = savedOrigin.localStorage.some((item) => item.name.includes('auth-token'))
  if (!hasAuthToken) {
    await fs.rm(output, { force: true })
    throw new Error(`A sessão confirmada não contém auth-token em ${expectedOrigin}.`)
  }

  console.log(`Sessão confirmada e salva em: ${output}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível capturar a sessão.')
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => undefined)
  if (!chromeProcess.killed) chromeProcess.kill()
}
