'use client';

import { useState } from 'react';
import TenantSigningView from '@/components/tenant-signing/TenantSigningView';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FormLayout } from '@/components/form';
import type { Language } from '@/lib/translations';

export default function TenantSigningPage() {
  const [language, setLanguage] = useState<Language>('en');

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <FormLayout>
        <TenantSigningView />
      </FormLayout>
      <Footer />
    </>
  );
}
