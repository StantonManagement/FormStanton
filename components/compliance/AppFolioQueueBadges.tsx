'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BadgeData {
  permits: number;
  ids: number;
  petFees: number;
  permitFees: number;
  moveOuts: number;
  tow: number;
}

export default function AppFolioQueueBadges() {
  const [data, setData] = useState<BadgeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/compliance/appfolio-queue');
        const json = await res.json();
        if (!cancelled && json.success) {
          setData({
            permits: json.permit_pickups_awaiting_appfolio.count,
            ids: json.permit_ids_awaiting_appfolio.count,
            petFees: json.pet_fees_awaiting_appfolio.count,
            permitFees: json.permit_fees_awaiting_appfolio.count,
            moveOuts: json.auto_flagged_moveouts.count,
            tow: json.tow_list.count,
          });
        }
      } catch {
        // silent fail — badges are supplementary
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!data) return null;

  const total = data.permits + data.ids + data.petFees + data.permitFees;
  const urgent = data.moveOuts + data.tow;
  if (total === 0 && urgent === 0) return null;

  const badge = (label: string, count: number, urgentStyle = false) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border ${
        count > 0
          ? urgentStyle
            ? 'border-[var(--error)]/50 text-[var(--error)] bg-[var(--error)]/5'
            : 'border-[var(--primary)]/40 text-[var(--primary)] bg-white'
          : 'border-[var(--divider)] text-[var(--muted)] bg-[var(--bg-section)]'
      }`}
    >
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
    </span>
  );

  return (
    <div className="p-3 border border-[var(--border)] bg-white flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mr-2">AppFolio queue</span>
      <Link href="/admin/appfolio-queue" className="hover:opacity-80 transition-opacity duration-200 ease-out">
        {badge('permits awaiting', data.permits)}
      </Link>
      <Link href="/admin/appfolio-queue" className="hover:opacity-80 transition-opacity duration-200 ease-out">
        {badge('IDs awaiting', data.ids)}
      </Link>
      <Link href="/admin/appfolio-queue" className="hover:opacity-80 transition-opacity duration-200 ease-out">
        {badge('pet fees', data.petFees)}
      </Link>
      <Link href="/admin/appfolio-queue" className="hover:opacity-80 transition-opacity duration-200 ease-out">
        {badge('permit fees', data.permitFees)}
      </Link>
      <span className="mx-1 text-[var(--divider)]">·</span>
      <Link href="/admin/tow-list" className="hover:opacity-80 transition-opacity duration-200 ease-out">
        {badge('move-outs', data.moveOuts, true)}
      </Link>
      <Link href="/admin/tow-list" className="hover:opacity-80 transition-opacity duration-200 ease-out">
        {badge('on tow list', data.tow, true)}
      </Link>
    </div>
  );
}
