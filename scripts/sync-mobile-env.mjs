import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readEnv(file) {
  const target = path.join(root, file)
  if (!fs.existsSync(target)) return {}
  return Object.fromEntries(
    fs.readFileSync(target, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const source = {
  ...readEnv('.env.local'),
  ...readEnv('web/.env.local'),
}

const supabaseUrl = source.EXPO_PUBLIC_SUPABASE_URL || source.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = source.EXPO_PUBLIC_SUPABASE_ANON_KEY || source.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Nao encontrei NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local.')
  process.exit(1)
}

const content = [
  'EXPO_PUBLIC_DROPZONE_API_URL=https://dropzone-cadastros.vercel.app',
  `EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}`,
  'EXPO_PUBLIC_AUTH_REDIRECT_URL=https://dropzone-cadastros.vercel.app/auth/mobile-callback',
  '',
].join('\n')

fs.writeFileSync(path.join(root, 'app/.env'), content)
console.log('OK - app/.env sincronizado com variaveis publicas do Supabase.')
