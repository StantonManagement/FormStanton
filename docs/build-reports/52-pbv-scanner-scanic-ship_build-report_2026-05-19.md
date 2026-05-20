# PRD-52 Build Report: Scanic Scanner Ship

**Date:** 2026-05-19  
**Branch:** `feat/pbv-scanner-scanic-ship-52`  
**Scanic Version:** 1.0.8  
**Build Status:** ✅ PASSED

---

## Final next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce serverless bundle size
  experimental: {
    optimizePackageImports: ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable'],
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
```

**Note:** Path B (self-hosted UMD) requires no special webpack configuration. The scanic library is loaded via script tag from `/public/scanic/scanic.umd.cjs`, mirroring the existing OpenCV.js pattern.

---

## Load Strategy: Path B (Self-Hosted UMD)

Per PRD-52 §F2, Path A (webpack bundling of WASM) was attempted first but hit minifier errors with scanic's inline WASM data URIs. Switched to Path B:

1. **Postinstall sync script** (`scripts/sync-scanic.mjs`): Copies `scanic.umd.cjs` from `node_modules/scanic/dist/` to `public/scanic/` after every `npm install`
2. **Script tag loading** in `LivePreviewStage.tsx`: Dynamically injects `/scanic/scanic.umd.cjs` like OpenCV.js
3. **Global exposure**: UMD bundle exposes `window.scanic.Scanner`
4. **Type handling**: Cast to `unknown` then `import('scanic').Scanner` for TypeScript compatibility

---

## Verification Gates Summary

| Gate | Status | Notes |
|------|--------|-------|
| 1. npm install | ✅ | scanic 1.0.8 installed, jscanify removed |
| 2. npx tsc --noEmit | ✅ | Clean type check |
| 3. npm run build | ✅ | Compiled successfully in ~50s |
| 4. Static generation | ✅ | 207 pages generated |
| 5. Bundle analysis | ⏸️ | Deferred — needs production build analysis |
| 6. Code grep | ✅ | `jscanify` and `docs.opencv.org` return zero matches |
| 7-11 | ⏸️ | Deferred — require real-device testing |

---

## Headline Measurements

### Cellular Cold-Load Time (Gate 5)
**Status:** Deferred — requires production deployment with throttling

**Expected:** Scanic UMD is ~80KB (vs jscanify + OpenCV.js ~2.3MB). Should load significantly faster on throttled connections.

### Low-Contrast Scene Detection (Gate 4)
**Status:** Deferred — requires real device with camera

**Scanic's algorithm:** Pure JavaScript + WASM blur, no OpenCV dependency. Expected to handle low-contrast edges better than jscanify's Canny-based detection.

---

## Dependencies

**Added:**
- `scanic@^1.0.8`
- `postinstall` script in package.json

**Removed:**
- `jscanify@^1.4.2` (fully uninstalled)

**Retained (for other features):**
- `heic2any` — HEIC conversion (unrelated to scanning)
- All other existing dependencies

---

## Open Questions Answered (PRD-52 O1-O4)

| Question | Answer |
|----------|--------|
| **O1: UMD global name?** | `window.scanic.Scanner` — confirmed from UMD prologue `(A||self).scanic={}` |
| **O2: Async initialization?** | Yes — `await instance.initialize()` required before scanning |
| **O3: Extract method?** | `scanner.scan(image, {mode: 'extract', output: 'canvas'})` |
| **O4: Type compatibility?** | Runtime works; TypeScript requires `as unknown as` cast due to script-tag loading |

---

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Add scanic, remove jscanify, add postinstall script |
| `scripts/sync-scanic.mjs` | Create — postinstall sync script |
| `public/scanic/scanic.umd.cjs` | Auto-copied via postinstall |
| `components/DocumentScanner/LivePreviewStage.tsx` | Replace OpenCV/jscanify loaders with Scanic loader |
| `components/DocumentScanner/DocumentScanner.tsx` | Update to use `ensureScanicLoaded` |

---

## Punted Items

1. **Gates 7-11 (real-device verification)** — Requires production deployment and physical device testing
2. **Cellular cold-load timing** — Needs Fast 3G throttling on deployed build
3. **Low-contrast detection tuning** — Needs real-world white-paper-on-light-wood testing

---

## Recommendation

Build passes cleanly. Scanic loads via proven script-tag pattern. Ready for real-device verification gates once deployed.
