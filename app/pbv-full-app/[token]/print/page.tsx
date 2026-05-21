/**
 * app/pbv-full-app/[token]/print/page.tsx
 * Print-friendly HTML view of submitted application.
 * Reads from intake_snapshot (immutable record of what tenant signed).
 * Available only when intake_status = 'complete'.
 */

import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import IntakeDataDisplay from '@/components/pbv/IntakeDataDisplay';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData } from '@/lib/pbv/intake-schema';
import './print.css';

interface PrintPageProps {
  params: Promise<{ token: string }>;
}

interface DocumentInfo {
  id: string;
  doc_type: string;
  label: string;
  person_slot: number;
  person_name?: string;
  status: string;
  uploaded_at?: string;
}

interface SignatureInfo {
  id: string;
  document_id: string;
  signer_name: string;
  signed_at: string;
  document_label: string;
}

const sectionCopy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    page_title: 'Application Copy',
    header_title: 'PBV Full Application',
    building_label: 'Building',
    unit_label: 'Unit',
    submission_date_label: 'Submitted',
    documents_section: 'Uploaded Documents',
    signatures_section: 'Signatures',
    document_filename: 'Document',
    document_status: 'Status',
    document_uploaded: 'Uploaded',
    signature_signer: 'Signer',
    signature_document: 'Document',
    signature_date: 'Signed',
    snapshot_missing_title: 'Application Copy Not Available',
    snapshot_missing_message: 'We could not locate your application record. Please contact the office for assistance.',
    status_not_complete_title: 'Application Not Complete',
    status_not_complete_message: 'This page is available after your application has been fully submitted and processed.',
    office_contact: 'Office Contact',
  },
  es: {
    page_title: 'Copia de Solicitud',
    header_title: 'Solicitud Completa PBV',
    building_label: 'Edificio',
    unit_label: 'Unidad',
    submission_date_label: 'Enviada',
    documents_section: 'Documentos Subidos',
    signatures_section: 'Firmas',
    document_filename: 'Documento',
    document_status: 'Estado',
    document_uploaded: 'Subido',
    signature_signer: 'Firmante',
    signature_document: 'Documento',
    signature_date: 'Firmado',
    snapshot_missing_title: 'Copia No Disponible',
    snapshot_missing_message: 'No pudimos ubicar su registro de solicitud. Por favor contacte la oficina para asistencia.',
    status_not_complete_title: 'Solicitud Incompleta',
    status_not_complete_message: 'Esta pagina esta disponible despues de que su solicitud haya sido enviada y procesada.',
    office_contact: 'Contacto de Oficina',
  },
  pt: {
    // PT: tentative -- review
    page_title: 'Copia da Solicitacao',
    header_title: 'Solicitacao Completa PBV',
    building_label: 'Predio',
    unit_label: 'Unidade',
    submission_date_label: 'Enviada',
    documents_section: 'Documentos Enviados',
    signatures_section: 'Assinaturas',
    document_filename: 'Documento',
    document_status: 'Status',
    document_uploaded: 'Enviado',
    signature_signer: 'Signatario',
    signature_document: 'Documento',
    signature_date: 'Assinado',
    snapshot_missing_title: 'Copia Nao Disponivel',
    snapshot_missing_message: 'Nao conseguimos localizar seu registro. Por favor contate o escritorio para assistencia.',
    status_not_complete_title: 'Solicitacao Incompleta',
    status_not_complete_message: 'Esta pagina esta disponivel apos sua solicitacao ser enviada e processada.',
    office_contact: 'Contato do Escritorio',
  },
};

function getOfficeContact(buildingAddress: string): { name: string; phone: string } {
  // Default office contact - in production this would come from a config/database
  return {
    name: 'Stanton Management',
    phone: '(203) 555-0100',
  };
}

function formatDate(dateStr: string | null | undefined, language: PreferredLanguage): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '--';
  
  try {
    return date.toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
}

export default async function PrintPage({ params }: PrintPageProps) {
  const { token } = await params;

  // Fetch application with snapshot
  const { data: app, error: appError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, building_address, unit_number, head_of_household_name, intake_status, intake_snapshot, intake_snapshot_at, preferred_language, submitted_at')
    .eq('tenant_access_token', token)
    .maybeSingle();

  if (appError || !app) {
    notFound();
  }

  const language: PreferredLanguage = (app.preferred_language as PreferredLanguage) ?? 'en';
  const c = sectionCopy[language] ?? sectionCopy.en;

  // Only available when intake_status = 'complete'
  if (app.intake_status !== 'complete') {
    const office = getOfficeContact(app.building_address);
    return (
      <div className="print-error-container">
        <h1>{c.status_not_complete_title}</h1>
        <p>{c.status_not_complete_message}</p>
        <div className="office-contact">
          <p><strong>{c.office_contact}:</strong></p>
          <p>{office.name}</p>
          <p>{office.phone}</p>
        </div>
      </div>
    );
  }

  // Snapshot must exist for completed applications
  if (!app.intake_snapshot) {
    const office = getOfficeContact(app.building_address);
    return (
      <div className="print-error-container">
        <h1>{c.snapshot_missing_title}</h1>
        <p>{c.snapshot_missing_message}</p>
        <div className="office-contact">
          <p><strong>{c.office_contact}:</strong></p>
          <p>{office.name}</p>
          <p>{office.phone}</p>
        </div>
      </div>
    );
  }

  const intakeData = app.intake_snapshot as unknown as IntakeData;

  // Fetch documents
  const { data: docsData } = await supabaseAdmin
    .from('application_documents')
    .select('id, doc_type, label, person_slot, person_name, status, created_at')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', app.id)
    .order('display_order', { ascending: true })
    .order('person_slot', { ascending: true });

  const documents: DocumentInfo[] = (docsData ?? []).map(d => ({
    id: d.id,
    doc_type: d.doc_type,
    label: d.label,
    person_slot: d.person_slot,
    person_name: d.person_name ?? undefined,
    status: d.status,
    // Defect #10: Only show upload date when doc was actually uploaded.
    // created_at is the seed date, not an upload date; missing docs should show '--'.
    uploaded_at: d.status !== 'missing' ? d.created_at : undefined,
  }));

  // F6: Fetch signatures from canonical model (pbv_signature_events + pbv_form_documents)
  const { data: sigsData } = await supabaseAdmin
    .from('pbv_signature_events')
    .select(`
      id,
      signer_member_id,
      signed_at,
      pbv_form_documents!inner(form_id),
      pbv_household_members!inner(name)
    `)
    .eq('pbv_form_documents.full_application_id', app.id)
    .order('signed_at', { ascending: true });

  const signatures: SignatureInfo[] = (sigsData ?? []).map((s: any) => ({
    id: s.id,
    document_id: s.pbv_form_documents?.form_id ?? 'summary',
    signer_name: s.pbv_household_members?.name ?? 'Unknown',
    signed_at: s.signed_at,
    document_label: s.pbv_form_documents?.form_id?.replace(/_/g, ' ') ?? 'Summary Document',
  }));

  const submissionDate = app.intake_snapshot_at ?? app.submitted_at;
  const office = getOfficeContact(app.building_address);

  return (
    <html lang={language}>
      <head>
        <title>{c.page_title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="print-body">
        <div className="print-container">
          {/* Header */}
          <header className="print-header">
            <div className="header-title">{c.header_title}</div>
            <div className="header-meta">
              <div className="meta-row">
                <span className="meta-label">{c.building_label}:</span>
                <span className="meta-value">{app.building_address}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">{c.unit_label}:</span>
                <span className="meta-value">{app.unit_number || '--'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">{c.submission_date_label}:</span>
                <span className="meta-value">{formatDate(submissionDate, language)}</span>
              </div>
            </div>
          </header>

          {/* Intake Data Sections */}
          <section className="intake-data-section">
            <IntakeDataDisplay
              intakeData={intakeData}
              language={language}
              mode="print"
            />
          </section>

          {/* Documents Section */}
          <section className="documents-section">
            <h2 className="section-title">{c.documents_section}</h2>
            {documents.length === 0 ? (
              <p className="empty-text">--</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{c.document_filename}</th>
                    <th>{c.document_status}</th>
                    <th>{c.document_uploaded}</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        {doc.label}
                        {doc.person_slot > 0 && doc.person_name && (
                          <span className="person-tag"> - {doc.person_name}</span>
                        )}
                      </td>
                      <td className={`status-${doc.status}`}>{doc.status}</td>
                      <td>{formatDate(doc.uploaded_at, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Signatures Section */}
          <section className="signatures-section">
            <h2 className="section-title">{c.signatures_section}</h2>
            {signatures.length === 0 ? (
              <p className="empty-text">--</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{c.signature_signer}</th>
                    <th>{c.signature_document}</th>
                    <th>{c.signature_date}</th>
                  </tr>
                </thead>
                <tbody>
                  {signatures.map((sig) => (
                    <tr key={sig.id}>
                      <td>{sig.signer_name}</td>
                      <td>{sig.document_label}</td>
                      <td>{formatDate(sig.signed_at, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Footer */}
          <footer className="print-footer">
            <div className="footer-office">
              {office.name} | {office.phone}
            </div>
            <div className="footer-page">
              {/* Page numbers inserted by browser print */}
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

// Generate filename for PDF download
export async function generateMetadata({ params }: PrintPageProps) {
  const { token } = await params;
  
  const { data: app } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('head_of_household_name, preferred_language')
    .eq('tenant_access_token', token)
    .maybeSingle();

  const hohName = app?.head_of_household_name ?? 'Applicant';
  const lastName = hohName.split(' ').pop() ?? 'Applicant';
  const date = new Date().toISOString().split('T')[0];
  const filename = `${sanitizeFilename(lastName)}-PBV-application-${date}`;

  return {
    title: filename,
  };
}
