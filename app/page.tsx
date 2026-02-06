'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language } from '@/lib/translations';
import Footer from '@/components/Footer';
import InsuranceUpdateModal from '@/components/InsuranceUpdateModal';

const landingContent = {
  en: {
    title: 'Tenant Onboarding Form',
    subtitle: 'Stanton Management LLC',
    intro: 'As you may know, Stanton Management is now managing your building. We want to introduce you to a few new changes and requirements that may have not been required by the prior owner/manager.',
    whatIsChanging: 'WHAT IS CHANGING:',
    items: [
      { title: 'Pet Registration', desc: 'All dogs and cats must be registered. Pet rent is $20–$50 per month per pet.' },
      { title: 'Renters Insurance', desc: 'This is now required. It protects you and your neighbors. Cost is about $10–20 per month.' },
      { title: 'Parking Permits', desc: 'We are issuing new parking permits. The old permits will not work after February 28th. Parking costs $50 per car per month.' },
    ],
    insuranceLink: 'Already submitted? Upload insurance documents here',
    selectPrompt: 'Please select your language to continue:',
  },
  es: {
    title: 'Formulario de Incorporación de Inquilinos',
    subtitle: 'Stanton Management LLC',
    intro: 'Como ya sabe, Stanton Management ahora administra su edificio. Queremos presentarle algunos cambios y nuevos requisitos que quizás no fueron requeridos por el propietario/administrador anterior.',
    whatIsChanging: 'QUÉ ESTÁ CAMBIANDO:',
    items: [
      { title: 'Registro de Mascotas', desc: 'Todos los perros y gatos deben ser registrados. El alquiler de mascotas es de $20–$50 por mes por mascota.' },
      { title: 'Seguro de Inquilino', desc: 'Esto ahora es obligatorio. Lo protege a usted y a sus vecinos. El costo es aproximadamente $10–20 por mes.' },
      { title: 'Permisos de Estacionamiento', desc: 'Estamos emitiendo nuevos permisos. Los permisos antiguos no funcionarán después del 28 de febrero. El estacionamiento cuesta $50 por carro por mes.' },
    ],
    insuranceLink: '¿Ya envió el formulario? Suba documentos de seguro aquí',
    selectPrompt: 'Por favor seleccione su idioma para continuar:',
  },
  pt: {
    title: 'Formulário de Integração do Inquilino',
    subtitle: 'Stanton Management LLC',
    intro: 'Como você já sabe, a Stanton Management agora administra seu prédio. Queremos apresentar algumas mudanças e novos requisitos que talvez não fossem exigidos pelo proprietário/administrador anterior.',
    whatIsChanging: 'O QUE ESTÁ MUDANDO:',
    items: [
      { title: 'Registro de Animais', desc: 'Todos os cães e gatos devem ser registrados. O aluguel de animais é de $20–$50 por mês por animal.' },
      { title: 'Seguro de Locatário', desc: 'Isso agora é obrigatório. Protege você e seus vizinhos. O custo é aproximadamente $10–20 por mês.' },
      { title: 'Autorizações de Estacionamento', desc: 'Estamos emitindo novas autorizações. As autorizações antigas não funcionarão após 28 de fevereiro. O estacionamento custa $50 por carro por mês.' },
    ],
    insuranceLink: 'Já enviou? Carregar documentos de seguro aqui',
    selectPrompt: 'Por favor selecione seu idioma para continuar:',
  },
};

export default function LandingPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>('en');
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);

  const content = landingContent[language];

  const handleContinue = (lang: Language) => {
    router.push(`/form?lang=${lang}`);
  };

  return (
    <>
      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="/Stanton-logo.PNG"
                alt="Stanton Management"
                className="max-w-[280px] w-full h-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="hidden w-16 h-16 bg-[var(--primary)] rounded-sm items-center justify-center">
                <span className="text-white font-serif font-bold text-2xl">SM</span>
              </div>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--primary)] mb-1">
              {content.title}
            </h1>
            <p className="text-[var(--muted)] text-sm tracking-wide uppercase">
              {content.subtitle}
            </p>
          </div>

          {/* Language Selector Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex border border-[var(--border)] rounded-sm overflow-hidden">
              {(['en', 'es', 'pt'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-4 sm:px-6 py-2 text-sm font-medium transition-colors ${
                    language === lang
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-white text-[var(--muted)] hover:bg-[var(--bg-section)]'
                  }`}
                >
                  {lang === 'en' ? 'English' : lang === 'es' ? 'Español' : 'Português'}
                </button>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden mb-8">
            <div className="p-5 sm:p-8">
              <p className="text-sm text-[var(--ink)] leading-relaxed mb-5">
                {content.intro}
              </p>

              <p className="font-semibold text-[var(--primary)] text-sm mb-4 tracking-wide">
                {content.whatIsChanging}
              </p>

              <div className="space-y-4">
                {content.items.map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs font-bold">{idx + 1}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--ink)] text-sm">{item.title}</p>
                      <p className="text-sm text-[var(--muted)] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-[var(--divider)]">
                <button
                  type="button"
                  onClick={() => setIsInsuranceModalOpen(true)}
                  className="text-sm text-[var(--accent)] hover:text-[var(--primary)] font-medium underline transition-colors"
                >
                  {content.insuranceLink}
                </button>
              </div>
            </div>
          </div>

          {/* Continue Buttons */}
          <div className="space-y-3">
            <p className="text-center text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              {content.selectPrompt}
            </p>
            <button
              onClick={() => handleContinue('en')}
              className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base"
            >
              Continue in English
            </button>
            <button
              onClick={() => handleContinue('es')}
              className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base"
            >
              Continuar en Español
            </button>
            <button
              onClick={() => handleContinue('pt')}
              className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base"
            >
              Continuar em Português
            </button>
          </div>

          {/* Security note */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>
              {language === 'en' ? 'Your information is transmitted securely' :
               language === 'es' ? 'Su información se transmite de forma segura' :
               'Suas informações são transmitidas com segurança'}
            </span>
          </div>

        </div>
      </main>

      <InsuranceUpdateModal
        isOpen={isInsuranceModalOpen}
        onClose={() => setIsInsuranceModalOpen(false)}
        language={language}
      />

      <Footer />
    </>
  );
}
