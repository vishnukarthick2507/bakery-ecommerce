/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production'

let backendUrl =
  process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL

if (!backendUrl) {
  if (isProduction) {
    throw new Error(
      'Missing backend URL configuration: set BACKEND_INTERNAL_URL or NEXT_PUBLIC_API_URL in production.',
    )
  }
  backendUrl = 'http://localhost:5000'
}

const nextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    unoptimized: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/+$/, '')}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
