import twilio from 'twilio';
import { Resend } from 'resend';
import { PreferredLanguage } from '@/types/compliance';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioFrom = process.env.TWILIO_PHONE_NUMBER!;
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendResult {
  success: boolean;
  error?: string;
}

const smsMessages: Record<PreferredLanguage, (url: string) => string> = {
  en: (url) => `Stanton Management: You have tasks to complete. Open your portal: ${url}`,
  es: (url) => `Stanton Management: Tiene tareas pendientes. Abra su portal: ${url}`,
  pt: (url) => `Stanton Management: Voce tem tarefas a concluir. Abra seu portal: ${url}`,
};

export async function sendPortalSMS(
  phone: string,
  portalUrl: string,
  language: PreferredLanguage
): Promise<SendResult> {
  try {
    await twilioClient.messages.create({
      body: smsMessages[language](portalUrl),
      from: twilioFrom,
      to: phone,
    });
    return { success: true };
  } catch (err: any) {
    console.error('Twilio SMS error:', err.message);
    return { success: false, error: err.message || 'SMS send failed' };
  }
}

const emailSubjects: Record<PreferredLanguage, string> = {
  en: 'Action Required: Complete Your Tasks',
  es: 'Accion requerida: Complete sus tareas',
  pt: 'Acao necessaria: Conclua suas tarefas',
};

function buildEmailHtml(
  portalUrl: string,
  projectName: string,
  deadline: string | null,
  language: PreferredLanguage
): string {
  const labels: Record<PreferredLanguage, { heading: string; body: string; cta: string; deadline: string }> = {
    en: {
      heading: 'You have tasks to complete',
      body: 'Please click the button below to access your tenant portal and complete your required tasks.',
      cta: 'Open My Tasks',
      deadline: 'Complete by',
    },
    es: {
      heading: 'Tiene tareas pendientes',
      body: 'Haga clic en el boton de abajo para acceder a su portal de inquilino y completar sus tareas requeridas.',
      cta: 'Abrir Mis Tareas',
      deadline: 'Completar antes del',
    },
    pt: {
      heading: 'Voce tem tarefas a concluir',
      body: 'Clique no botao abaixo para acessar seu portal de inquilino e concluir suas tarefas obrigatorias.',
      cta: 'Abrir Minhas Tarefas',
      deadline: 'Concluir ate',
    },
  };

  const t = labels[language];

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d4d0c8;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <span style="font-family:'Libre Baskerville',Georgia,serif;font-size:18px;color:#ffffff;font-weight:700;">Stanton Management</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="font-family:'Libre Baskerville',Georgia,serif;font-size:20px;color:#1a1a2e;margin:0 0 8px;">${t.heading}</h1>
          ${projectName ? `<p style="font-size:14px;color:#6b6b6b;margin:0 0 16px;">${projectName}</p>` : ''}
          ${deadline ? `<p style="font-size:13px;color:#b45309;font-weight:600;margin:0 0 16px;">${t.deadline} ${deadline}</p>` : ''}
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 24px;">${t.body}</p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="${portalUrl}" style="display:inline-block;background:#1a1a2e;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;">
              ${t.cta}
            </a>
          </td></tr></table>
          <p style="font-size:11px;color:#999;margin:24px 0 0;line-height:1.5;word-break:break-all;">${portalUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPortalEmail(
  email: string,
  portalUrl: string,
  language: PreferredLanguage,
  projectName: string,
  deadline: string | null
): Promise<SendResult> {
  try {
    const { error } = await resend.emails.send({
      from: 'Stanton Management <noreply@stantonmanagement.com>',
      to: email,
      subject: emailSubjects[language],
      html: buildEmailHtml(portalUrl, projectName, deadline, language),
    });

    if (error) {
      console.error('Resend email error:', error);
      return { success: false, error: error.message || 'Email send failed' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Resend email error:', err.message);
    return { success: false, error: err.message || 'Email send failed' };
  }
}
