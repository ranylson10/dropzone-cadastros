import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Playwright usa 127.0.0.1; libera somente origens locais durante o desenvolvimento.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
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
