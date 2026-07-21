function clean(value: string | undefined) {
  return String(value || '').replace(/^\uFEFF/, '').trim()
}

export function requiredEnv(name: string): string {
  const value = clean(process.env[name])
  if (!value) throw new Error(`${name} nao configurado.`)
  return value
}

export function optionalEnv(name: string, fallback = ''): string {
  return clean(process.env[name]) || fallback
}

export function booleanEnv(name: string): boolean {
  return Boolean(clean(process.env[name]))
}

export function appUrl(): string {
  return optionalEnv('NEXT_PUBLIC_APP_URL', optionalEnv('APP_URL', 'https://dropzone-cadastros.vercel.app')).replace(/\/$/, '')
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
