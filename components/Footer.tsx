'use client';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--divider)] bg-[var(--bg-section)] mt-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <p className="font-medium text-[var(--primary)]">Stanton Management LLC</p>
            <p className="text-sm text-[var(--muted)]">421 Park Street, Hartford, CT 06106</p>
            <p className="text-sm text-[var(--muted)]">(860) 993-3401</p>
          </div>
          
          <div className="text-center sm:text-right text-xs text-[var(--muted)]">
            <div className="flex items-center justify-center sm:justify-end gap-2 mb-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>This is a secure form. Your information is encrypted.</span>
            </div>
            <p>© 2025 Stanton Management LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
