'use client';

/**
 * app/pbv-full-app/[token]/layout.tsx
 *
 * Shared layout for all tenant-facing PBV full-app pages under a given token.
 * Mounts AssistedBanner when a staff-assisted session is active for this application.
 * The banner requires knowing both the token (for API lookup) and the application ID.
 * Application ID is resolved lazily by AssistedBanner via the assisted-mode endpoint.
 */

import { use } from 'react';
import AssistedBanner from '@/components/pbv/AssistedBanner';

interface Props {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default function PbvFullAppLayout({ children, params }: Props) {
  const { token } = use(params);

  return (
    <>
      <AssistedBannerWrapper token={token} />
      {children}
    </>
  );
}

function AssistedBannerWrapper({ token }: { token: string }) {
  return <AssistedBanner token={token} />;
}
