'use client';

interface PacketLockBannerProps {
  submittedAt: string | null;
  submittedByName?: string | null;
  revision: number;
  onReopen?: () => void;
  canReopen: boolean;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PacketLockBanner({
  submittedAt,
  submittedByName,
  revision,
  onReopen,
  canReopen,
}: PacketLockBannerProps) {
  return (
    <div className="border border-indigo-300 bg-indigo-50 px-5 py-3 flex items-center justify-between gap-4">
      <div className="text-sm text-indigo-900">
        <span className="font-semibold">Packet locked.</span>{' '}
        Submitted to HACH on {fmtDate(submittedAt)}
        {submittedByName ? ` by ${submittedByName}` : ''}.
        {' '}Revision {revision}.{' '}
        <span className="text-indigo-700">Reopen to make changes.</span>
      </div>
      {canReopen && onReopen && (
        <button
          type="button"
          onClick={onReopen}
          className="shrink-0 px-4 py-1.5 text-xs font-medium border border-indigo-400 text-indigo-800 hover:bg-indigo-100 transition-colors"
        >
          Reopen Packet
        </button>
      )}
    </div>
  );
}
