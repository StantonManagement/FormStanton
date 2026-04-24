'use client';

import { useState, useEffect, useCallback } from 'react';
import { interpolateTemplate, langDisplayName } from '@/lib/rejection-templates-client';

const COLORS = {
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  accent: '#0f4c5c',
  accentLight: '#e6f0f3',
  reject: '#b91c1c',
  rejectLight: '#fee2e2',
  warn: '#92400e',
  warnBg: '#fef3c7',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

interface ReasonTemplate {
  code: string;
  label: string;
  template_en: string;
  template_es: string;
  template_pt: string;
  sort_order: number;
  is_active: boolean;
}

export interface RejectDialogDocument {
  id: string;
  label: string;
  file_name?: string | null;
}

export interface RejectDialogApplication {
  head_of_household_name: string;
  building_address?: string | null;
  unit_number?: string | null;
  preferred_language?: string | null;
}

interface RejectDialogProps {
  document: RejectDialogDocument;
  application: RejectDialogApplication;
  onClose: () => void;
  onSubmit: (documentId: string, reasonCode: string, reasonText: string | undefined) => Promise<void>;
}

function getLangTemplate(tpl: ReasonTemplate, lang: string): string {
  if (lang === 'es') return tpl.template_es;
  if (lang === 'pt') return tpl.template_pt;
  return tpl.template_en;
}

export default function RejectDialog({
  document,
  application,
  onClose,
  onSubmit,
}: RejectDialogProps) {
  const [templates, setTemplates] = useState<ReasonTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [reasonCode, setReasonCode] = useState('stale');
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const lang = (['en', 'es', 'pt'].includes(application.preferred_language ?? '')
    ? application.preferred_language
    : 'en') as 'en' | 'es' | 'pt';

  const tenantFirstName = application.head_of_household_name.split(' ')[0];
  const docShort = document.label.split(' ')[0].toLowerCase();

  useEffect(() => {
    fetch('/api/hach/rejection-reasons')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setTemplates(d.data);
          if (d.data.length > 0) setReasonCode(d.data[0].code);
        }
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

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
        reasonCode === 'other' ? customText.trim() : undefined
      );
    } catch (e: any) {
      setSubmitError(e.message ?? 'Rejection failed');
      setSubmitting(false);
    }
  }, [canSubmit, document.id, reasonCode, customText, onSubmit]);

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

        {/* Body — scrollable */}
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
                <span style={{ color: COLORS.textSubtle, fontStyle: 'italic' }}>
                  Select a reason to preview the message
                </span>
              )}
            </div>

            {/* Deferral notice */}
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                backgroundColor: COLORS.warnBg,
                border: `1px solid #fcd34d`,
                fontSize: 11,
                color: COLORS.warn,
                lineHeight: 1.45,
              }}
            >
              <strong>Note:</strong> Tenant notification is deferred until Twilio integration is live.
              The rejection will be logged but no SMS will be sent yet.
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
