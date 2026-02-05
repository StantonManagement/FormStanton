'use client';

interface ProgressIndicatorProps {
  currentSection: number;
  totalSections: number;
  language: 'en' | 'es' | 'pt';
}

const sectionLabels = {
  en: ['Resident Info', 'Pet Registration', 'Insurance', 'Parking'],
  es: ['Info Residente', 'Registro Mascotas', 'Seguro', 'Estacionamiento'],
  pt: ['Info Residente', 'Registro Animais', 'Seguro', 'Estacionamento'],
};

export default function ProgressIndicator({ currentSection, totalSections, language }: ProgressIndicatorProps) {
  const progress = (currentSection / totalSections) * 100;
  const labels = sectionLabels[language];

  return (
    <div className="border-b border-[var(--divider)] px-4 sm:px-8 py-4 bg-[var(--bg-section)]">
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-[var(--muted)] font-medium">
          {language === 'en' ? 'Form Progress' : language === 'es' ? 'Progreso del Formulario' : 'Progresso do Formulário'}
        </span>
        <span className="font-medium text-[var(--primary)]">
          {language === 'en' ? 'Section' : language === 'es' ? 'Sección' : 'Seção'} {currentSection} {language === 'en' ? 'of' : language === 'es' ? 'de' : 'de'} {totalSections}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--divider)] rounded-full overflow-hidden">
        <div 
          className="h-full bg-[var(--accent)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Section labels */}
      <div className="mt-2 flex justify-between text-xs">
        {labels.map((label, idx) => (
          <span 
            key={idx}
            className={`transition-colors duration-200 ${
              currentSection > idx ? 'text-[var(--primary)] font-medium' : 'text-[var(--muted)]'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
