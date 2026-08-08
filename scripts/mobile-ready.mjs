import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const appDir = path.join(root, 'app')

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function parseEnv(file) {
  if (!exists(file)) return {}
  return Object.fromEntries(
    read(file)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const checks = []
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail })
}

const appJson = JSON.parse(read('app/app.json'))
const pkg = JSON.parse(read('app/package.json'))
const envExample = parseEnv('app/.env.example')
const envFile = parseEnv('app/.env')
const appEnv = { ...envExample, ...envFile }

check('app/index.ts registra o root component', read('app/index.ts').includes('registerRootComponent'))
check('package main aponta para index.ts', pkg.main === 'index.ts')
check('Expo scheme dropzone configurado', appJson.expo?.scheme === 'dropzone')
check('Android package configurado', appJson.expo?.android?.package === 'com.dropzone.mobile')
check('iOS bundleIdentifier configurado', appJson.expo?.ios?.bundleIdentifier === 'com.dropzone.mobile')
check('EAS build configurado', exists('app/eas.json') && read('app/eas.json').includes('"buildType": "apk"'))
check('Supabase URL preenchida', Boolean(appEnv.EXPO_PUBLIC_SUPABASE_URL && !appEnv.EXPO_PUBLIC_SUPABASE_URL.includes('SEU-PROJETO')), 'preencha app/.env')
check('Supabase anon key preenchida', Boolean(appEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY && !appEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY.includes('SUA_CHAVE')), 'preencha app/.env')
check('Redirect mobile correto', appEnv.EXPO_PUBLIC_AUTH_REDIRECT_URL === 'dropzone://auth/callback')
check('API de produção configurada', appEnv.EXPO_PUBLIC_DROPZONE_API_URL === 'https://dropzone-cadastros.vercel.app')
check('API mobile tem timeout contra rede travada', read('app/src/lib/api.ts').includes('DEFAULT_TIMEOUT_MS') && read('app/src/lib/api.ts').includes('AbortController'))
check('Auth mobile usa PKCE', read('app/src/lib/supabase.ts').includes("flowType: 'pkce'"))
check('Login troca deep link por sessão', read('app/src/lib/auth.tsx').includes('exchangeCodeForSession'))
check('App protege contra tela branca', read('app/src/App.tsx').includes('AppErrorBoundary'))
check('Helper aceita URL relativa ou absoluta', read('app/src/config/env.ts').includes('externalUrl'))
check('Carrinho abre inscrição com URL segura', read('app/src/screens/CommerceScreen.tsx').includes('externalUrl(payload.claim_url)'))
check('Compra direta abre inscrição com URL segura', read('app/src/screens/PurchaseClaimScreen.tsx').includes('externalUrl(payment.claim_url)'))
check('Lili mobile chama API real', read('app/src/screens/LiliScreen.tsx').includes('mobileApi.lili'))
check('Escalação abre link público', read('app/src/screens/LineupScreen.tsx').includes('Abrir link de escalação'))

let failed = 0
for (const item of checks) {
  const status = item.pass ? 'OK' : 'PENDENTE'
  if (!item.pass) failed += 1
  console.log(`${status} - ${item.name}${item.detail && !item.pass ? ` (${item.detail})` : ''}`)
}

if (failed) {
  console.log(`\n${failed} pendência(s) impedem chamar o app de pronto para login/teste real.`)
  process.exit(1)
}

console.log('\nApp mobile pronto para teste real em aparelho/dev build.')
