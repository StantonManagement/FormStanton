'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReasonTemplate {
  code: string;
  label: string;
  template_en: string;
  template_es: string;
  template_pt: string;
  sort_order: number;
  is_active: boolean;
}

interface Document {
  id: string;
  label: string;
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
  onSubmit: (documentId: string, reasonCode: string, reasonText: string | undefined, internalNotes?: string) => Promise<void>;
}

function getLangTemplate(tpl: ReasonTemplate, lang: string): string {
  if (lang === 'es') return tpl.template_es;
  if (lang === 'pt') return tpl.template_pt;
  return tpl.template_en;
}

function interpolateTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] || match);
}

function langDisplayName(lang: string): string {
  const names: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
  return names[lang] || 'English';
}

export default function RejectDialog({
  document,
  application,
  context,
  onClose,
  onSubmit,
}: RejectDialogProps) {
  const [templates, setTemplates] = useState<ReasonTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [reasonCode, setReasonCode] = useState('stale');
  const [customText, setCustomText] = useState('');
  const [internalNotes, setInternalNotes] = useState(''); // Stanton only
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const lang = (['en', 'es', 'pt'].includes(application.preferred_language ?? '')
    ? application.preferred_language
    : 'en') as 'en' | 'es' | 'pt';

  const tenantFirstName = application.head_of_household_name.split(' ')[0];
  const docShort = document.label.split(' ')[0].toLowerCase();

  // Load rejection templates
  useEffect(() => {
    const apiUrl = context === 'stanton' 
      ? '/api/admin/rejection-reasons'
      : '/api/hach/rejection-reasons';
      
    fetch(apiUrl)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setTemplates(d.data);
          if (d.data.length > 0) setReasonCode(d.data[0].code);
        }
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, [context]);

  // Esc closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedTemplate = templates.find((t) => t.code === reasonCode);
  const rawTemplate = selectedTemplate ? getLangTemplate(selectedTemplate, lang) : '';
  const previewMessage = rawTemplate
    ? interpolateTemplate(rawTemplate, {
        tenant: tenantFirstName,
        doc: document.label,
        doc_short: docShort,
        custom: reasonCode === 'other' ? (customText || undefined) : undefined,
      })
    : '';

  const canSubmit =
    !submitting &&
    reasonCode &&
    (reasonCode !== 'other' || customText.trim().length > 0);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(
        document.id,
        reasonCode,
        reasonCode === 'other' ? customText.trim() : undefined,
        context === 'stanton' ? internalNotes.trim() || undefined : undefined
      );
    } catch (e: any) {
      setSubmitError(e.message ?? 'Rejection failed');
      setSubmitting(false);
    }
  }, [canSubmit, document.id, reasonCode, customText, internalNotes, context, onSubmit]);

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
                {templates.map((t) => (
                  <label
                    key={t.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      border: `1px solid ${reasonCode === t.code ? COLORS.accent : COLORS.border}`,
                      backgroundColor: reasonCode === t.code ? COLORS.accentLight : 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="reject-reason"
                      checked={reasonCode === t.code}
                      onChange={() => { setReasonCode(t.code); setCustomText(''); setSubmitError(''); }}
                      style={{ accentColor: COLORS.accent, flexShrink: 0 }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            )}

            {/* Custom text (only for "other") */}
            {reasonCode === 'other' && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Specify reason for tenant..."
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
              {templates.map((t) => (
                <label
                  key={t.code}
                  className={`flex items-center gap-3 p-3 border rounded cursor-pointer text-sm ${
                    reasonCode === t.code 
                      ? 'bg-blue-50 border-blue-500' 
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reject-reason"
                    checked={reasonCode === t.code}
                    onChange={() => { setReasonCode(t.code); setCustomText(''); setSubmitError(''); }}
                    className="text-blue-600"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          )}

          {/* Custom text (only for "other") */}
          {reasonCode === 'other' && (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Specify reason for tenant..."
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
