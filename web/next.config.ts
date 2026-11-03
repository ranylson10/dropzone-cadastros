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
  images: {
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256],
    remotePatterns: [{
      protocol: 'https',
      hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co').hostname,
      pathname: '/storage/v1/object/public/**',
    }],
    minimumCacheTTL: 3600,
  },
  outputFileTracingIncludes: {
    '/api/stream/image': ['./public/ui/**/*', './public/branding/**/*'],
  },
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
