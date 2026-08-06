import path from 'node:path'
import type { NextConfig } from 'next'

const developmentOrigins = [
  '127.0.0.1',
  'localhost',
  '192.168.2.50',
  ...String(process.env.DEV_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]

const nextConfig: NextConfig = {
  // Libera o navegador do próprio PC, o Playwright e dispositivos da rede local configurados.
  allowedDevOrigins: Array.from(new Set(developmentOrigins)),
  // Garante embutir env públicas no client em monorepo (workspace web/).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
}

export default nextConfig
