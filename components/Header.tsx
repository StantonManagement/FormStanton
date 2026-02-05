'use client';

import { Language } from '@/lib/translations';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function Header({ language, onLanguageChange }: HeaderProps) {
  return (
    <header className="border-b border-[var(--divider)] bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo and Company Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)] rounded-sm flex items-center justify-center">
              <span className="text-white font-serif font-bold text-lg">SM</span>
            </div>
            <div className="hidden sm:block border-l border-[var(--divider)] pl-3">
              <p className="text-sm font-medium text-[var(--primary)]">Stanton Management LLC</p>
              <p className="text-xs text-[var(--muted)]">Tenant Services Portal</p>
            </div>
          </div>
        </div>
        
        {/* Language Selector */}
        <select 
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
          className="text-sm border-0 bg-transparent text-[var(--muted)] focus:ring-0 focus:outline-none cursor-pointer font-medium"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
        </select>
      </div>
    </header>
  );
}
