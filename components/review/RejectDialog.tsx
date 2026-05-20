'use client';

import { useState, useEffect, useCallback } from 'react';

interface PbvRejectionTemplate {
  key: string;
  doc_type: string | null;
  reason_en: string;
  reason_es: string;
  reason_pt: string;
}

interface Document {
  id: string;
  label: string;
  doc_type?: string;
  file_name?: string | null;
}

interface Application {
  head_of_household_name: string;
  building_address?: string | null;
  unit_number?: string | null;
  preferred_language?: string | null;
}

interface RejectDialogProps {
  document: Document;
  application: Application;
  context: 'stanton' | 'hach';
  onClose: () => void;
  onSubmit: (documentId: string, reasonKey: string | null, reasonText: string | undefined, internalNotes?: string) => Promise<void>;
}

function getLocalizedReason(tpl: PbvRejectionTemplate, lang: string): string {
  if (lang === 'es') return tpl.reason_es;
  if (lang === 'pt') return tpl.reason_pt;
  return tpl.reason_en;
}

function getGenericFallback(lang: string): string {
  if (lang === 'es') return 'Por favor contacte la oficina para detalles sobre por qué este documento fue rechazado.';
  if (lang === 'pt') return 'Por favor entre em contato com o escritório para detalhes sobre por que este documento foi rejeitado.';
  return 'Please contact the office for details on why this document was rejected.';
}

function langDisplayName(lang: string): string {
  const names: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
  return names[lang] || 'English';
}

const CUSTOM_KEY = '__custom__';

export default function RejectDialog({
  document,
  application,
  context,
  onClose,
  onSubmit,
}: RejectDialogProps) {
  const [templates, setTemplates] = useState<PbvRejectionTemplate[]>([]);
  const [genericTemplates, setGenericTemplates] = useState<PbvRejectionTemplate[]>([]);
  const [docSpecificTemplates, setDocSpecificTemplates] = useState<PbvRejectionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [internalNotes, setInternalNotes] = useState(''); // Stanton only
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const lang = (['en', 'es', 'pt'].includes(application.preferred_language ?? '')
    ? application.preferred_language
    : 'en') as 'en' | 'es' | 'pt';

  // Load PBV rejection templates filtered by doc_type
  useEffect(() => {
    const docType = document.doc_type || 'all';
    const apiUrl = `/api/admin/pbv-rejection-templates?doc_type=${encodeURIComponent(docType)}`;

    fetch(apiUrl)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setTemplates(d.data);
          setGenericTemplates(d.grouped?.generic || []);
          setDocSpecificTemplates(d.grouped?.doc_specific || []);
          // Default to first template if available
          if (d.data.length > 0) {
            setSelectedKey(d.data[0].key);
          }
        }
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, [document.doc_type]);

  // Esc closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedTemplate = useCustom ? null : templates.find((t) => t.key === selectedKey);

  // Build preview message
  const previewMessage = useCustom
    ? customText.trim() || getGenericFallback(lang)
    : selectedTemplate
    ? getLocalizedReason(selectedTemplate, lang)
    : '';

  const canSubmit = useCustom
    ? customText.trim().length > 0
    : selectedKey !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // If using custom, pass null key and custom text
      // If using template, pass key and optional custom text as override
      await onSubmit(
        document.id,
        useCustom ? null : selectedKey,
        useCustom ? customText.trim() : undefined,
        context === 'stanton' ? internalNotes.trim() || undefined : undefined
      );
    } catch (e: any) {
      setSubmitError(e.message ?? 'Rejection failed');
      setSubmitting(false);
    }
  }, [canSubmit, document.id, selectedKey, customText, internalNotes, context, onSubmit, useCustom]);

  if (context === 'hach') {
    const COLORS = {
      bg: '#fafaf9',
      panel: '#ffffff',
      border: '#e7e5e4',
      borderStrong: '#d6d3d1',
      text: '#1c1917',
      textMuted: '#78716c',
      accent: '#0f4c5c',
      accentLight: '#e6f0f3',
      reject: '#b91c1c',
      rejectLight: '#fee2e2',
      warn: '#92400e',
      warnBg: '#fef3c7',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: 20,
          fontFamily: FONT,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: COLORS.panel,
            width: '100%',
            maxWidth: 580,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 22px',
              borderBottom: `1px solid ${COLORS.border}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: COLORS.reject,
                marginBottom: 4,
              }}
            >
              Reject Document
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
              {document.label}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
              {application.head_of_household_name}
              {application.building_address ? ` · ${application.building_address}` : ''}
              {application.unit_number ? `, Unit ${application.unit_number}` : ''}
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px' }}>
            {/* Reason list */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.text,
                marginBottom: 8,
              }}
            >
              Reason
            </div>

            {templatesLoading ? (
              <div style={{ fontSize: 13, color: COLORS.textMuted, padding: '8px 0' }}>
                Loading reasons...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Doc-specific templates */}
                {docSpecificTemplates.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>
                    Document-specific reasons
                  </div>
                )}
                {docSpecificTemplates.map((t) => (
                  <label
                    key={t.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      border: `1px solid ${!useCustom && selectedKey === t.key ? COLORS.accent : COLORS.border}`,
                      backgroundColor: !useCustom && selectedKey === t.key ? COLORS.accentLight : 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="reject-reason"
                      checked={!useCustom && selectedKey === t.key}
                      onChange={() => { setSelectedKey(t.key); setUseCustom(false); setSubmitError(''); }}
                      style={{ accentColor: COLORS.accent, flexShrink: 0 }}
                    />
                    {getLocalizedReason(t, 'en')}
                  </label>
                ))}

                {/* Generic templates */}
                {genericTemplates.length > 0 && docSpecificTemplates.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>
                    Generic reasons
                  </div>
                )}
                {genericTemplates.map((t) => (
                  <label
                    key={t.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      border: `1px solid ${!useCustom && selectedKey === t.key ? COLORS.accent : COLORS.border}`,
                      backgroundColor: !useCustom && selectedKey === t.key ? COLORS.accentLight : 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="reject-reason"
                      checked={!useCustom && selectedKey === t.key}
                      onChange={() => { setSelectedKey(t.key); setUseCustom(false); setSubmitError(''); }}
                      style={{ accentColor: COLORS.accent, flexShrink: 0 }}
                    />
                    {getLocalizedReason(t, 'en')}
                  </label>
                ))}

                {/* Custom option */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    border: `1px solid ${useCustom ? COLORS.accent : COLORS.border}`,
                    backgroundColor: useCustom ? COLORS.accentLight : 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    marginTop: docSpecificTemplates.length > 0 || genericTemplates.length > 0 ? 8 : 0,
                  }}
                >
                  <input
                    type="radio"
                    name="reject-reason"
                    checked={useCustom}
                    onChange={() => { setUseCustom(true); setSubmitError(''); }}
                    style={{ accentColor: COLORS.accent, flexShrink: 0 }}
                  />
                  Custom reason
                </label>
              </div>
            )}

            {/* Custom text area */}
            {useCustom && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter custom rejection reason for tenant..."
                rows={3}
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: FONT,
                  border: `1px solid ${COLORS.border}`,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            )}

            {/* SMS preview */}
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: COLORS.textMuted,
                  marginBottom: 6,
                }}
              >
                Tenant will receive (SMS, {langDisplayName(lang)}):
              </div>
              <div
                style={{
                  padding: 12,
                  backgroundColor: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  fontSize: 13,
                  color: COLORS.text,
                  lineHeight: 1.55,
                  minHeight: 52,
                }}
              >
                {previewMessage || (
                  <span style={{ color: '#a8a29e', fontStyle: 'italic' }}>
                    Select a reason to preview the message
                  </span>
                )}
              </div>

            </div>

            {/* Submit error */}
            {submitError && (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  backgroundColor: COLORS.rejectLight,
                  border: `1px solid #fecaca`,
                  fontSize: 12,
                  color: COLORS.reject,
                }}
              >
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 22px',
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              backgroundColor: COLORS.bg,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: FONT,
                backgroundColor: '#fff',
                color: COLORS.text,
                border: `1px solid ${COLORS.borderStrong}`,
                cursor: 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: FONT,
                backgroundColor: '#fff',
                color: COLORS.reject,
                border: `1px solid ${COLORS.reject}`,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              {submitting ? 'Rejecting...' : 'Reject & Log'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stanton context - use Tailwind
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-lg max-h-screen flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Reject Document</div>
          <div className="text-base font-bold text-gray-900">{document.label}</div>
          <div className="text-sm text-gray-500 mt-1">
            {application.head_of_household_name}
            {application.building_address ? ` · ${application.building_address}` : ''}
            {application.unit_number ? `, Unit ${application.unit_number}` : ''}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Reason list */}
          <div className="text-sm font-semibold text-gray-900 mb-2">Reason</div>

          {templatesLoading ? (
            <div className="text-sm text-gray-500 py-2">Loading reasons...</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Doc-specific templates */}
              {docSpecificTemplates.length > 0 && (
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 mt-2">
                  Document-specific reasons
                </div>
              )}
              {docSpecificTemplates.map((t) => (
                <label
                  key={t.key}
                  className={`flex items-center gap-3 p-3 border rounded cursor-pointer text-sm ${
                    !useCustom && selectedKey === t.key
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reject-reason"
                    checked={!useCustom && selectedKey === t.key}
                    onChange={() => { setSelectedKey(t.key); setUseCustom(false); setSubmitError(''); }}
                    className="text-blue-600"
                  />
                  {getLocalizedReason(t, 'en')}
                </label>
              ))}

              {/* Generic templates */}
              {genericTemplates.length > 0 && docSpecificTemplates.length > 0 && (
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 mt-3">
                  Generic reasons
                </div>
              )}
              {genericTemplates.map((t) => (
                <label
                  key={t.key}
                  className={`flex items-center gap-3 p-3 border rounded cursor-pointer text-sm ${
                    !useCustom && selectedKey === t.key
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reject-reason"
                    checked={!useCustom && selectedKey === t.key}
                    onChange={() => { setSelectedKey(t.key); setUseCustom(false); setSubmitError(''); }}
                    className="text-blue-600"
                  />
                  {getLocalizedReason(t, 'en')}
                </label>
              ))}

              {/* Custom option */}
              <label
                className={`flex items-center gap-3 p-3 border rounded cursor-pointer text-sm mt-2 ${
                  useCustom
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  checked={useCustom}
                  onChange={() => { setUseCustom(true); setSubmitError(''); }}
                  className="text-blue-600"
                />
                Custom reason
              </label>
            </div>
          )}

          {/* Custom text area */}
          {useCustom && (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Enter custom rejection reason for tenant..."
              rows={3}
              className="w-full mt-3 p-3 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Internal notes (Stanton only) */}
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Internal notes (not visible to HACH)
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal team notes..."
              rows={3}
              className="w-full p-3 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SMS preview */}
          <div className="mt-6">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Tenant will receive (SMS, {langDisplayName(lang)}):
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 text-sm text-gray-900 leading-relaxed min-h-[3.25rem]">
              {previewMessage || (
                <span className="text-gray-400 italic">Select a reason to preview the message</span>
              )}
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-2 text-sm font-medium rounded ${
              canSubmit 
                ? 'bg-white text-red-600 border border-red-300 hover:bg-red-50' 
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Rejecting...' : 'Reject & Log'}
          </button>
        </div>
      </div>
    </div>
  );
}
