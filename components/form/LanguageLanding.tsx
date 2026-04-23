'use client';

import React from 'react';
import { Language } from '@/lib/translations';
import Footer from '@/components/Footer';

interface LanguageLandingProps {
  title: string;
  subtitle?: string;
  description?: string;
  onSelect: (lang: Language) => void;
  bottomSlot?: React.ReactNode;
}

export default function LanguageLanding({
  title,
  subtitle = 'Stanton Management LLC',
  description,
  onSelect,
  bottomSlot,
}: LanguageLandingProps) {
  return (
    <>
      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="/Stanton-logo.PNG"
                alt="Stanton Management"
                className="max-w-[280px] w-full h-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--primary)] mb-1">
              {title}
            </h1>
            <p className="text-[var(--muted)] text-sm tracking-wide uppercase">
              {subtitle}
            </p>
          </div>

          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden mb-8 p-6 sm:p-8">
            {description && (
              <p className="text-sm text-[var(--ink)] leading-relaxed mb-6">
                {description}
              </p>
            )}
            <p className="text-center text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Please select your language to continue:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => onSelect('en')}
                className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base"
              >
                Continue in English
              </button>
              <button
                onClick={() => onSelect('es')}
                className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base"
              >
                Continuar en Español
              </button>
              <button
                onClick={() => onSelect('pt')}
                className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base"
              >
                Continuar em Português
              </button>
            </div>
            {bottomSlot}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Your information is transmitted securely</span>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
