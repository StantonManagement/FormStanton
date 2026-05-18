'use client';

/**
 * components/pbv/cards/AlmostDoneReview.tsx
 *
 * PRD-44 F2 — "Almost done" review screen before signing.
 * Shows all uploaded documents grouped by category with Retake exits.
 * Hands off to MagicLinkSigningFlow.
 */

import { useState, useMemo, useCallback } from 'react';
import type { DocumentCardData } from './DocumentCard';
import type { SupportedLanguage } from '@/lib/pbv/cards/docContent';

type DocCategory =
  | 'income'
  | 'banking'
  | 'medical_childcare'
  | 'citizenship_immigration'
  | 'identity'
  | 'other';

interface CategorizedDoc extends DocumentCardData {
  category: DocCategory;
}

interface AlmostDoneReviewProps {
  /** Application token */
  token: string;
  /** Tenant's first name */
  firstName: string;
  /** All documents (uploaded and missing) */
  documents: DocumentCardData[];
  /** Preferred language */
  language: SupportedLanguage;
  /** Navigate to signing flow */
  onProceedToSign: () => void;
  /** Navigate back to card stack at specific card */
  onRetake: (docId: string) => void;
  /** Go back to card stack (general back) */
  onBackToCards: () => void;
}

interface CategoryInfo {
  key: DocCategory;
  label: Record<SupportedLanguage, string>;
}

const categories: CategoryInfo[] = [
  {
    key: 'income',
    label: { en: 'Income Verification', es: 'Verificación de Ingresos', pt: 'Verificação de Renda' },
  },
  {
    key: 'banking',
    label: { en: 'Banking & Assets', es: 'Banca y Activos', pt: 'Bancos e Ativos' },
  },
  {
    key: 'medical_childcare',
    label: { en: 'Medical & Childcare', es: 'Médico y Cuidado Infantil', pt: 'Médico e Cuidado Infantil' },
  },
  {
    key: 'citizenship_immigration',
    label: { en: 'Citizenship & Immigration', es: 'Ciudadanía e Inmigración', pt: 'Cidadania e Imigração' },
  },
  {
    key: 'identity',
    label: { en: 'Identity', es: 'Identidad', pt: 'Identidade' },
  },
  {
    key: 'other',
    label: { en: 'Other Documents', es: 'Otros Documentos', pt: 'Outros Documentos' },
  },
];

const translations = {
  en: {
    heading: "Here's everything you sent. Look right?",
    retake: 'Retake',
    optional: 'optional',
    deferredNote: (count: number) =>
      `${count} doc${count === 1 ? '' : 's'} still deferred — they're optional for submission.`,
    ctaPrimary: "Looks good — let's sign →",
    ctaBack: 'Back to documents',
    uploaded: 'Uploaded',
    pageLabel: (current: number, total: number) => `${current} of ${total}`,
  },
  es: {
    heading: 'Aquí está todo lo que envió. ¿Se ve bien?',
    retake: 'Volver a tomar',
    optional: 'opcional',
    deferredNote: (count: number) =>
      `${count} documento${count === 1 ? '' : 's'} aún diferido${count === 1 ? '' : 's'} — son opcionales para el envío.`,
    ctaPrimary: 'Se ve bien — vamos a firmar →',
    ctaBack: 'Volver a documentos',
    uploaded: 'Subido',
    pageLabel: (current: number, total: number) => `${current} de ${total}`,
  },
  pt: {
    heading: 'Aqui está tudo o que você enviou. Parece certo?',
    retake: 'Tirar novamente',
    optional: 'opcional',
    deferredNote: (count: number) =>
      `${count} documento${count === 1 ? '' : 's'} ainda adiado${count === 1 ? '' : 's'} — são opcionais para envio.`,
    ctaPrimary: 'Parece certo — vamos assinar →',
    ctaBack: 'Voltar aos documentos',
    uploaded: 'Enviado',
    pageLabel: (current: number, total: number) => `${current} de ${total}`,
  },
};

/**
 * Categorize a document by its doc_type.
 * Maps doc types to logical categories for the review screen.
 */
function categorizeDoc(docType: string): DocCategory {
  const type = docType.toLowerCase();

  // Income documents
  if (
    type.includes('paystub') ||
    type.includes('w2') ||
    type.includes('w-2') ||
    type.includes('1099') ||
    type.includes('income') ||
    type.includes('employment') ||
    type.includes('ss_award') ||
    type.includes('ssi_award')
  ) {
    return 'income';
  }

  // Banking documents
  if (
    type.includes('bank') ||
    type.includes('statement') ||
    type.includes('asset') ||
    type.includes('investment')
  ) {
    return 'banking';
  }

  // Medical/childcare
  if (
    type.includes('medical') ||
    type.includes('childcare') ||
    type.includes('disability') ||
    type.includes('insurance_settlement')
  ) {
    return 'medical_childcare';
  }

  // Citizenship/immigration
  if (
    type.includes('citizenship') ||
    type.includes('immigration') ||
    type.includes('declaration') ||
    type.includes('passport') ||
    type.includes('visa')
  ) {
    return 'citizenship_immigration';
  }

  // Identity
  if (
    type.includes('id') ||
    type.includes('license') ||
    type.includes('birth') ||
    type.includes('social_security') ||
    type.includes('photo')
  ) {
    return 'identity';
  }

  return 'other';
}

/**
 * Get plain language title for a document.
 * Falls back to the doc label if no specialized title exists.
 */
function getDocDisplayTitle(doc: DocumentCardData, _language: SupportedLanguage): string {
  // Use the document's label or generate from doc_type
  if (doc.label) return doc.label;

  // Generate from doc_type
  return doc.doc_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AlmostDoneReview({
  firstName,
  documents,
  language,
  onProceedToSign,
  onRetake,
  onBackToCards,
}: AlmostDoneReviewProps) {
  const t = translations[language];
  const [retakingId, setRetakingId] = useState<string | null>(null);

  // Filter to only uploaded/approved documents
  const uploadedDocs = useMemo(
    () => documents.filter((d) => d.status === 'submitted' || d.status === 'approved'),
    [documents]
  );

  // Count deferred docs
  const deferredCount = useMemo(
    () => documents.filter((d) => d.is_deferred && d.status === 'missing').length,
    [documents]
  );

  // Categorize uploaded docs
  const categorizedDocs = useMemo<CategorizedDoc[]>(() => {
    return uploadedDocs.map((doc) => ({
      ...doc,
      category: categorizeDoc(doc.doc_type),
    }));
  }, [uploadedDocs]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    const grouped: Record<DocCategory, CategorizedDoc[]> = {
      income: [],
      banking: [],
      medical_childcare: [],
      citizenship_immigration: [],
      identity: [],
      other: [],
    };

    for (const doc of categorizedDocs) {
      grouped[doc.category].push(doc);
    }

    return grouped;
  }, [categorizedDocs]);

  const handleRetake = useCallback(
    (docId: string) => {
      setRetakingId(docId);
      onRetake(docId);
    },
    [onRetake]
  );

  // Get non-empty categories in order
  const nonEmptyCategories = useMemo(() => {
    return categories.filter((cat) => groupedByCategory[cat.key].length > 0);
  }, [groupedByCategory]);

  return (
    <div
      className="min-h-screen bg-[var(--paper)] flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="bg-white border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={onBackToCards}
            className="
              text-sm text-[var(--primary)] font-medium
              hover:opacity-80 transition-opacity duration-200
              min-h-[44px] px-2 -ml-2 flex items-center
            "
            style={{ touchAction: 'manipulation' }}
          >
            ← {t.ctaBack}
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-32">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Heading */}
          <div className="space-y-2">
            <h1
              className="text-2xl font-normal text-[var(--ink)] leading-tight"
              style={{ fontFamily: 'Libre Baskerville, serif' }}
            >
              {t.heading}
            </h1>
          </div>

          {/* Documents by category */}
          {nonEmptyCategories.map((category) => (
            <section key={category.key} className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
                {category.label[language]}
              </h2>
              <div className="space-y-3">
                {groupedByCategory[category.key].map((doc) => (
                  <div
                    key={doc.id}
                    className="
                      bg-white border border-[var(--border)]
                      p-4
                      flex items-start gap-3
                    "
                  >
                    {/* Thumbnail placeholder */}
                    <div
                      className="
                        w-16 h-16
                        bg-[var(--bg-section)]
                        border border-[var(--border)]
                        flex items-center justify-center
                        flex-shrink-0
                      "
                    >
                      <span className="text-2xl text-[var(--muted)]">📄</span>
                    </div>

                    {/* Doc info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[var(--ink)]">
                            {getDocDisplayTitle(doc, language)}
                          </p>
                          {doc.person_name && (
                            <p className="text-xs text-[var(--muted)]">
                              {doc.person_name}
                            </p>
                          )}
                          <p className="text-xs text-green-700 mt-1">
                            ✓ {t.uploaded}
                            {doc.current_revision > 1 && ` (v${doc.current_revision})`}
                          </p>
                        </div>
                        {!doc.required && (
                          <span className="text-xs text-[var(--muted)] bg-[var(--bg-section)] px-2 py-1">
                            {t.optional}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Retake button */}
                    <button
                      type="button"
                      onClick={() => handleRetake(doc.id)}
                      disabled={retakingId === doc.id}
                      className="
                        text-sm text-[var(--primary)]
                        hover:underline
                        min-h-[44px] px-2
                        disabled:opacity-50
                      "
                      style={{ touchAction: 'manipulation' }}
                    >
                      {t.retake}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Deferred note */}
          {deferredCount > 0 && (
            <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4">
              <p className="text-sm text-[var(--muted)]">{t.deferredNote(deferredCount)}</p>
            </div>
          )}
        </div>
      </main>

      {/* Sticky footer */}
      <footer
        className="
          fixed bottom-0 left-0 right-0
          bg-white border-t border-[var(--border)]
          px-4 py-4
          safe-area-pb
        "
        style={{
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-lg mx-auto space-y-3">
          <button
            type="button"
            onClick={onProceedToSign}
            className="
              w-full min-h-[48px] px-4 py-3
              bg-[var(--primary)] text-white
              text-base font-medium
              rounded-none
              hover:opacity-90
              transition-opacity duration-200 ease-out
            "
            style={{ touchAction: 'manipulation' }}
          >
            {t.ctaPrimary}
          </button>

          <button
            type="button"
            onClick={onBackToCards}
            className="
              w-full min-h-[44px] px-4 py-2
              bg-transparent text-[var(--primary)]
              text-sm font-medium
              rounded-none
              hover:bg-[var(--bg-section)]
              transition-colors duration-200
            "
            style={{ touchAction: 'manipulation' }}
          >
            {t.ctaBack}
          </button>
        </div>
      </footer>
    </div>
  );
}
