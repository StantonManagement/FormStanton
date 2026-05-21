/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce serverless bundle size
  experimental: {
    optimizePackageImports: ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable'],
  },

  // Include field maps and source PDFs in serverless bundle for generate-forms.
  // docs/ is .vercelignore'd, so source PDFs live in assets/pbv-source-pdfs/.
  outputFileTracingIncludes: {
    '/api/t/[token]/pbv-full-app/generate-forms': [
      './scripts/field-maps/**',
      './assets/pbv-source-pdfs/**',
    ],
  },

  // Handle OpenCV.js and other native modules in webpack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
