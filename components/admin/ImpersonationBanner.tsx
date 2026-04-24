'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, X } from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuthContext';

export default function ImpersonationBanner() {
  const { impersonator, user, stopImpersonate } = useAdminAuth();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  if (!impersonator || !user) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      await stopImpersonate();
      router.refresh();
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="text-amber-900 truncate">
          Viewing as{' '}
          <span className="font-semibold">{user.displayName}</span>
          {user.username && (
            <span className="text-amber-700 font-mono text-xs"> ({user.username})</span>
          )}
          <span className="text-amber-700"> — you are {impersonator.displayName}</span>
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-900 text-amber-50 text-xs font-medium rounded-none hover:bg-amber-950 transition-colors duration-200 ease-out disabled:opacity-50 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
        {exiting ? 'Exiting...' : 'Exit View As'}
      </button>
    </div>
  );
}
