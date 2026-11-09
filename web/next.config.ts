import type { NextConfig } from 'next'

const apiTarget = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080').replace(/\/$/, '')

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiTarget}/api/v1/:path*` }]
  },
}

export default nextConfig
