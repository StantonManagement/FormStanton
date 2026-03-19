'use client';

import { ReactNode } from 'react';

interface FormLayoutProps {
  children: ReactNode;
  className?: string;
}

export default function FormLayout({ children, className = '' }: FormLayoutProps) {
  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className={`bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden ${className}`}>
          {children}
        </div>
      </div>
    </main>
  );
}
