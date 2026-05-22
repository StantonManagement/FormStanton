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
    // Content-Security-Policy in REPORT-ONLY mode (PRP-001 / D1).
    // Directive notes:
    //   default-src 'self'                  baseline
    //   script-src ... 'wasm-unsafe-eval'   OpenCV.js / Scanic / jscanify wasm in the live scanner
    //   img-src/media-src 'self' blob: data:  scanner blob previews + base64 fallbacks (D8)
    //   frame-src 'self' blob:              <iframe src=blob:> PDF preview in signing modals (D8)
    //   frame-ancestors 'none'              clickjack defense for signing pages
    //   worker-src 'self' blob:             future-proof for scanner worker chunks
    //   connect-src 'self' https://*.supabase.co  Supabase REST/Storage/Realtime
    // 'unsafe-inline' is kept on script-src/style-src for now; dropping requires
    // a nonce rework — tracked as future hardening (PRP-001 non-goal).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.supabase.co",
      "media-src 'self' blob:",
      "frame-src 'self' blob:",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      // Global: report-only CSP on every route (D1).
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: csp,
          },
        ],
      },
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
