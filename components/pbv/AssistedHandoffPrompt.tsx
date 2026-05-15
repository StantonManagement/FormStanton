'use client';

/**
 * components/pbv/AssistedHandoffPrompt.tsx
 *
 * Shown immediately before the signature pad in an assisted session.
 * Requires the tenant to tap a confirmation before the pad appears.
 *
 * Copy: "Please hand the phone to {tenantName} so they can sign for themselves."
 * CTA:  "I have the phone — ready to sign"
 *
 * Usage:
 *   <AssistedHandoffPrompt
 *     tenantName="Maria Santos"
 *     staffName="Will Esposito"
 *     onConfirm={() => setHandoffConfirmed(true)}
 *   />
 */

interface Props {
  tenantName: string;
  staffName: string;
  onConfirm: () => void;
}

export default function AssistedHandoffPrompt({ tenantName, staffName, onConfirm }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="handoff-title"
      className="w-full max-w-md mx-auto px-6 py-8 text-center space-y-6"
      style={{ color: 'var(--ink)' }}
    >
      <div className="text-4xl" aria-hidden>📱</div>

      <h2
        id="handoff-title"
        className="text-xl font-semibold"
        style={{ fontFamily: 'var(--font-serif, serif)' }}
      >
        Hand the phone to {tenantName}
      </h2>

      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        <strong>{staffName}</strong> has completed your application information.
        Only <strong>{tenantName}</strong> can sign — please pass the phone now.
      </p>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-3 text-sm font-medium"
        style={{
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        I have the phone — ready to sign
      </button>
    </div>
  );
}
