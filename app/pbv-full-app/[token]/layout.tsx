'use client';

/**
 * app/pbv-full-app/[token]/layout.tsx
 *
 * Shared layout for all tenant-facing PBV full-app pages under a given token.
 * Mounts AssistedBanner when a staff-assisted session is active for this application.
 * The banner requires knowing both the token (for API lookup) and the application ID.
 * Application ID is resolved lazily by AssistedBanner via the assisted-mode endpoint.
 *
 * PRP-009 / A7: hosts the page <main id="main"> landmark + a visually-hidden
 * focusable "Skip to main content" link as the first focusable element on
 * every tenant page. Page bodies (IntakeShell, dashboard, etc.) no longer
 * render their own <main> — they render <section> instead — so the document
 * still has exactly one main landmark.
 */

import { use } from 'react';
import AssistedBanner from '@/components/pbv/AssistedBanner';
import DebugErrorOverlay from '@/components/pbv/DebugErrorOverlay';

interface Props {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default function PbvFullAppLayout({ children, params }: Props) {
  const { token } = use(params);

  return (
    <>
      {/* Skip-link: visually hidden until focused; first focusable element
          on the page. Keyboard users press Tab → Enter to jump into the
          main content past the header / assisted banner. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1000] focus:bg-white focus:text-[var(--primary)] focus:border-2 focus:border-[var(--primary)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <AssistedBannerWrapper token={token} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <DebugErrorOverlay />
    </>
  );
}

function AssistedBannerWrapper({ token }: { token: string }) {
  return <AssistedBanner token={token} />;
}
