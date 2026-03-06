'use client';

import { motion } from 'framer-motion';
import { Language } from '@/lib/translations';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface SuccessScreenProps {
  title: string;
  message: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function SuccessScreen({
  title,
  message,
  language,
  onLanguageChange,
}: SuccessScreenProps) {
  return (
    <>
      <Header language={language} onLanguageChange={onLanguageChange} />
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white border border-[var(--border)] rounded-sm shadow-sm p-8 max-w-md w-full text-center"
        >
          <div className="mb-6">
            <motion.svg
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto h-16 w-16 text-[var(--success)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </motion.svg>
          </div>
          <h2 className="font-serif text-2xl text-[var(--primary)] mb-3">
            {title}
          </h2>
          <p className="text-[var(--muted)] leading-relaxed">
            {message}
          </p>
          <div className="mt-6 pt-6 border-t border-[var(--divider)]">
            <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Your information is transmitted securely</span>
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
