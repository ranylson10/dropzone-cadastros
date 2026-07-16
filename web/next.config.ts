import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
