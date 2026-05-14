/**
 * delivery.ts
 * 
 * Email and portal delivery for signed documents.
 * Uses Resend for email delivery.
 */

import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);

export type ConsentLanguage = 'en' | 'es' | 'ht';

type DeliveryResult = {
  success: boolean;
  method: 'email' | 'portal_download' | 'both' | null;
  error?: string;
};

const emailSubjects: Record<ConsentLanguage, string> = {
  en: 'Your Signed Document - Stanton Management',
  es: 'Su Documento Firmado - Stanton Management',
  ht: 'Dokiman Ou Siyen - Stanton Management',
};

const emailTemplates: Record<ConsentLanguage, {
  greeting: string;
  body: string;
  downloadCta: string;
  footer: string;
}> = {
  en: {
    greeting: 'Hello,',
    body: 'Your document has been electronically signed and is attached to this email. You can also download it from your tenant portal at any time.',
    downloadCta: 'Download from Portal',
    footer: 'This is an automated message from Stanton Management. Please do not reply to this email.',
  },
  es: {
    greeting: 'Hola,',
    body: 'Su documento ha sido firmado electrónicamente y está adjunto a este correo electrónico. También puede descargarlo desde su portal de inquilino en cualquier momento.',
    downloadCta: 'Descargar desde el Portal',
    footer: 'Este es un mensaje automatizado de Stanton Management. Por favor no responda a este correo electrónico.',
  },
  ht: {
    greeting: 'Bonjou,',
    body: 'Dokiman ou an te siyen elektwonikman epi li tache nan imèl sa a. Ou ka tou telechaje li nan pòtal lokatè ou a nenpòt lè.',
    downloadCta: 'Telechaje nan Pòtal la',
    footer: 'Sa a se yon mesaj otomatik soti nan Stanton Management. Tanpri pa reponn imèl sa a.',
  },
};

/**
 * Deliver a signed PDF to a tenant or staff member.
 * Tries email first, falls back to portal-only if no email available.
 */
export async function deliverSignedDocument(params: {
  recipientEmail?: string | null;
  recipientName: string;
  documentName: string;
  pdfBuffer: Buffer;
  pdfPath: string;
  language: ConsentLanguage;
  tenantToken?: string | null;
  isStaff: boolean;
}): Promise<DeliveryResult> {
  const { recipientEmail, documentName, pdfBuffer, language, tenantToken, isStaff } = params;

  const methods: string[] = [];

  // Try email delivery if address available
  if (recipientEmail) {
    try {
      await sendEmailWithAttachment({
        to: recipientEmail,
        documentName,
        pdfBuffer,
        language,
        tenantToken,
        isStaff,
      });
      methods.push('email');
    } catch (err: any) {
      console.error('Email delivery failed:', err);
      // Continue to portal fallback
    }
  }

  // Portal is always available as backup
  methods.push('portal_download');

  // Determine final method
  let method: 'email' | 'portal_download' | 'both' | null = null;
  if (methods.includes('email') && methods.includes('portal_download')) {
    method = 'both';
  } else if (methods.includes('email')) {
    method = 'email';
  } else if (methods.includes('portal_download')) {
    method = 'portal_download';
  }

  return {
    success: true,
    method,
  };
}

/**
 * Send email with signed PDF attachment.
 */
async function sendEmailWithAttachment(params: {
  to: string;
  documentName: string;
  pdfBuffer: Buffer;
  language: ConsentLanguage;
  tenantToken?: string | null;
  isStaff: boolean;
}): Promise<void> {
  const { to, documentName, pdfBuffer, language, tenantToken, isStaff } = params;
  const t = emailTemplates[language];

  // Build portal URL if tenant
  let portalUrl = '';
  if (!isStaff && tenantToken) {
    portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/t/${tenantToken}`;
  } else if (isStaff) {
    portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin`;
  }

  const html = buildEmailHtml(t, documentName, portalUrl);

  const { error } = await resend.emails.send({
    from: 'Stanton Management <noreply@stantonmanagement.com>',
    to,
    subject: emailSubjects[language],
    html,
    attachments: [
      {
        filename: `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_signed.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

/**
 * Build email HTML with design system styling.
 */
function buildEmailHtml(
  t: typeof emailTemplates['en'],
  documentName: string,
  portalUrl: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d4d0c8;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a2e;padding:24px 32px;">
            <span style="font-family:'Libre Baskerville',Georgia,serif;font-size:18px;color:#ffffff;font-weight:700;">Stanton Management</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;">${t.greeting}</p>
            <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 24px;">${t.body}</p>
            
            <div style="background:#f9f9f7;border:1px solid #e5e5e0;padding:16px;margin:0 0 24px;">
              <p style="font-size:13px;color:#6b6b6b;margin:0 0 4px;">Document</p>
              <p style="font-size:14px;font-weight:600;color:#1a1a2e;margin:0;">${escapeHtml(documentName)}</p>
            </div>

            ${portalUrl ? `
            <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
              <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;">
                ${t.downloadCta}
              </a>
            </td></tr></table>
            ` : ''}
            
            <p style="font-size:11px;color:#999;margin:24px 0 0;line-height:1.5;">${t.footer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Record delivery in audit row.
 */
export async function recordDeliveryInAudit(
  auditId: string,
  method: 'email' | 'portal_download' | 'both',
  email?: string | null
): Promise<void> {
  await supabaseAdmin
    .from('signature_capture_audit')
    .update({
      delivered_to_signer_at: new Date().toISOString(),
      delivery_method: method,
      delivery_address: email ?? null,
    })
    .eq('id', auditId);
}
