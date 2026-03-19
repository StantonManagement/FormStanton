'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { tenantForms } from '@/lib/formsData';

const SUFFIX = ' - Stanton Management';
const DEFAULT_TITLE = `Stanton Management`;

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const match = tenantForms.find((f) => f.path && pathname === f.path);
    document.title = match ? `${match.title}${SUFFIX}` : DEFAULT_TITLE;
  }, [pathname]);

  return null;
}
