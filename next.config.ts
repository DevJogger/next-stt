import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['ffmpeg-static'],
  output: 'standalone',
}

export default nextConfig
