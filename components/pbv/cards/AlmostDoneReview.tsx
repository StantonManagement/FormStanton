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
import { getDocTitle, getDocDescription } from '@/lib/pbv/cards/docContent';

// PRD-58 Phase 3 + PRD-65: DB-driven categories matching DB column.
// identity (PRD-65), income, assets, medical_childcare, immigration,
// signed_forms + custom fallback. 'identity' sorts first.
type DocCategory =
  | 'identity'
  | 'income'
  | 'assets'
  | 'medical_childcare'
  | 'immigration'
  | 'signed_forms'
  | 'custom';

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

// PRD-58 Phase 3 / PRD-65: DB-driven categories with friendly labels.
// 'identity' is first (head-of-household photo ID, PRD-65).
const categories: CategoryInfo[] = [
  {
    key: 'identity',
    label: { en: 'Photo ID', es: 'Identificación con foto', pt: 'Identidade com foto' },
  },
  {
    key: 'income',
    label: { en: 'Income Verification', es: 'Verificación de Ingresos', pt: 'Verificação de Renda' },
  },
  {
    key: 'assets',
    label: { en: 'Bank & Assets', es: 'Banca y Activos', pt: 'Banco e Bens' },
  },
  {
    key: 'medical_childcare',
    label: { en: 'Medical & Childcare', es: 'Médico y Cuidado Infantil', pt: 'Médico e Cuidado Infantil' },
  },
  {
    key: 'immigration',
    label: { en: 'Immigration Status', es: 'Estado de Inmigración', pt: 'Status de Imigração' },
  },
  {
    key: 'signed_forms',
    label: { en: 'Forms to sign', es: 'Formularios para firmar', pt: 'Formulários para assinar' },
  },
  {
    key: 'custom',
    label: { en: 'Additional Documents', es: 'Documentos Adicionales', pt: 'Documentos Adicionais' },
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
 * PRD-58 Phase 3: Categorize a document using DB category column.
 * Maps DB category enum to display categories; no substring guessing.
 */
function categorizeDoc(docType: string, dbCategory: string | null | undefined): DocCategory {
  // Use DB category directly if available and valid
  if (dbCategory) {
    const cat = dbCategory.toLowerCase();
    // Map DB category to display category
    if (cat === 'identity') return 'identity'; // PRD-65
    if (cat === 'income') return 'income';
    if (cat === 'assets') return 'assets';
    if (cat === 'medical_childcare') return 'medical_childcare';
    if (cat === 'immigration') return 'immigration';
    if (cat === 'signed_forms') return 'signed_forms';
  }

  // PRD-65 fallback: government_id from legacy/custom rows still groups under identity
  if (docType === 'government_id') return 'identity';

  // Fallback: infer from doc_type for legacy/custom docs
  // Log these for admin attention
  console.warn(`[AlmostDoneReview] Doc with null/custom category: ${docType}`);

  // Best-effort fallback using known doc_type patterns
  const type = docType.toLowerCase();

  // Income patterns
  if (
    type.includes('paystub') ||
    type.includes('pension') ||
    type.includes('ssi_award') ||
    type.includes('ss_award') ||
    type.includes('child_support') ||
    type.includes('tanf') ||
    type.includes('unemployment') ||
    type.includes('self_employment') ||
    type.includes('digital_payment') ||
    type.includes('training')
  ) {
    return 'income';
  }

  // Asset patterns
  if (
    type.includes('bank_statement') ||
    type.includes('insurance_settlement') ||
    type.includes('cd_trust_bond') ||
    type.includes('life_insurance')
  ) {
    return 'assets';
  }

  // Medical/childcare patterns
  if (
    type.includes('medical') ||
    type.includes('pharmacy') ||
    type.includes('care4kids')
  ) {
    return 'medical_childcare';
  }

  // Immigration patterns
  if (
    type.includes('immigration') ||
    type.includes('proof_of_age_noncitizen')
  ) {
    return 'immigration';
  }

  // Signed forms patterns (always required)
  if (
    type.includes('main_application') ||
    type.includes('citizenship_declaration') ||
    type.includes('criminal_background') ||
    type.includes('hud_9886') ||
    type.includes('hud_92006') ||
    type.includes('debts_owed') ||
    type.includes('eiv_guide') ||
    type.includes('briefing') ||
    type.includes('obligations') ||
    type.includes('hach_release') ||
    type.includes('child_support_affidavit') ||
    type.includes('no_child_support') ||
    type.includes('vawa') ||
    type.includes('reasonable_accommodation')
  ) {
    return 'signed_forms';
  }

  return 'custom';
}

/**
 * PRD-58 Phase 2: Get plain language title for a document.
 * Uses getDocTitle from docContent.ts for consistent plain-language titles.
 * Falls back to the doc label only if no specialized title exists.
 */
function getDocDisplayTitle(doc: DocumentCardData, language: SupportedLanguage): string {
  // Try plain-language title from docContent first
  const plainTitle = getDocTitle(doc.doc_type, language);
  if (plainTitle && plainTitle !== doc.doc_type) {
    return plainTitle;
  }

  // Fall back to the document's label (raw DB label)
  if (doc.label) return doc.label;

  // Last resort: generate from doc_type
  return doc.doc_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * PRD-58 Phase 2: Get one-line description for a document.
 */
function getDocDisplayDescription(doc: DocumentCardData, language: SupportedLanguage): string {
  return getDocDescription(doc.doc_type, language);
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

  // PRD-58 Phase 3: Categorize uploaded docs using DB category
  const categorizedDocs = useMemo<CategorizedDoc[]>(() => {
    return uploadedDocs.map((doc) => ({
      ...doc,
      category: categorizeDoc(doc.doc_type, doc.category),
    }));
  }, [uploadedDocs]);

  // PRD-58 Phase 3: Group by DB-aligned category
  const groupedByCategory = useMemo(() => {
    const grouped: Record<DocCategory, CategorizedDoc[]> = {
      identity: [], // PRD-65
      income: [],
      assets: [],
      medical_childcare: [],
      immigration: [],
      signed_forms: [],
      custom: [],
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
                          {/* PRD-58 Phase 2: One-line description */}
                          <p className="text-xs text-[var(--muted)] mt-0.5">
                            {getDocDisplayDescription(doc, language)}
                          </p>
                          {doc.person_name && (
                            <p className="text-xs text-[var(--muted)] mt-0.5">
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
