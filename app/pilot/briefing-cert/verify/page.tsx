'use client';

import { useState, useEffect } from 'react';

const EN_CONTENT = {
  title: 'Family Certification of Briefing Documents Received',
  iUnderstand: 'I understand that:',
  documents: [
    'Debts owed to Public Housing Agencies and Terminations (form HUD-52675)',
    'Supplement to Application for Federally Assisted Housing (form HUD-92006)',
    'What You Should Know (form HUD-1140-OIG)',
    'Right to Request a Reasonable Accommodation',
    'Violence Against Women Act Notice (VAWA)',
    'HUD brochure "Protect Your Family from Lead in Your Home"',
    '"Is it Worth It?" (formulario HUD-1141-OIG)',
    'Information on how to file a Housing Discrimination Complaint',
  ],
  bullets: [
    'I must give HACH written notice of my intent to vacate my unit at the same time as I give written notice to my landlord.',
    'I must notify HACH of the adoption, birth, or court-awarded custody of a child, and must request approval from HACH and my landlord before any other individual moves into my unit.',
    'I must notify HACH should anyone leave my unit.',
    'I must notify HACH if my family will be absent from my unit for more than 30 days at the start of that absence.',
  ],
  fields: {
    name: 'Head of Household Printed Name',
    signature: 'Signature',
    date: 'Date',
  },
  legalWarning: 'Sect. 1001 of Title 18 of the United States Code makes it a criminal offense to knowingly make false statements or misrepresentations to any Department or Agency of the United States on any matter within its jurisdiction and has established penalty of fines up to $100,000 and/or imprisonment not to exceed 5 years.',
  revisionDate: 'Rev 3/28/2025',
};

const ES_CONTENT = {
  title: 'CERTIFICACIÓN DE FAMILIA DE DOCUMENTOS DE INFORMACIÓN RECIBIDOS',
  iUnderstand: 'Entiendo que:',
  documents: [
    'Deudas con organismos públicos y terminaciones (formulario HUD-52675)',
    'Suplemento a la solicitud de Vivienda Asistida por el Gobierno Federal (formulario HUD-92006)',
    'Cosas que debe saber (formulario HUD-1140-OIG)',
    'Derecho a solicitar una acomodación razonable',
    'Aviso sobre la ley de violencia contra la mujer (VAWA)',
    "Folleto de HUD 'Proteger a su familia del plomo en su hogar'",
    "'Vale la pena?' (formulario HUD-1141-OIG)",
    'Información sobre cómo llenar un formulario de queja de discriminación de Vivienda',
  ],
  bullets: [
    'Yo debo dar aviso a HACH por escrito de mi intento de desocupar la unidad al mismo tiempo como doy aviso por escrito a mi propietario.',
    'Debo notificar a HACH de la adopción, nacimiento o tribunal concedió de la custodia de un niño, y debo solicitar la aprobación de HACH y mi propietario antes de cualquier otras jugadas individuales en mi unidad.',
    'Debo notificar a HACH si debe salir alguien de la unidad.',
    'Debo notificar a HACH si mi familia estará ausente de mi unidad por más de 30 días al inicio de esa ausensia.',
  ],
  fields: {
    name: 'Nombre impreso del Jefe de la Familia',
    signature: 'Firma',
    date: 'Fecha',
  },
  legalWarning: 'Sección 1001 del título 18 del código de Estados Unidos es un delito a sabiendas declaraciones falsas o tergiversar a cualquier departamento o agencia de Estados Unidos a cualquier asunto dentro de su jurisdicción y estableció la pena de de multas he hasta $100,000 o pena de prisión no exceda 5 años.',
  revisionDate: 'Rev 3/28/2025',
};

const CHECKLIST_ITEMS = [
  'HACH letterhead visible and positioned correctly',
  'All 8 numbered briefing documents listed correctly',
  'Family obligations bullet list matches source',
  'Signature block has correct labels and positions',
  'Footer legal warning text matches verbatim',
  'Spanish version matches source page 38',
  'Print output (PDF) renders without layout breaks — empty version',
  'Print output (PDF) renders without layout breaks — filled version',
  'Sample-filled HOH name fits within field width without overflow',
  'Sample-filled signature doesn\'t collide with date field',
  'Date stamp "Rev 3/28/2025" present in footer',
];

export default function VerifyPage() {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [filled, setFilled] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const content = lang === 'en' ? EN_CONTENT : ES_CONTENT;
  const pdfPageNum = lang === 'en' ? 1 : 2;

  useEffect(() => {
    // Set PDF URL to the extracted source PDF
    setPdfUrl('/docs/templates/briefing-cert-source.pdf');
  }, []);

  const toggleCheck = (index: number) => {
    setChecked(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const formData = filled
    ? { name: 'Maria Garcia-Rodriguez', signature: 'Maria Garcia-Rodriguez', date: '2026-05-14' }
    : { name: '', signature: '', date: '' };

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Form Verification — Family Certification of Briefing Documents</h1>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <strong>Language:</strong>{' '}
          <button onClick={() => setLang('en')} style={{ fontWeight: lang === 'en' ? 'bold' : 'normal' }}>
            EN
          </button>{' '}
          <button onClick={() => setLang('es')} style={{ fontWeight: lang === 'es' ? 'bold' : 'normal' }}>
            ES
          </button>
        </div>
        <div>
          <strong>State:</strong>{' '}
          <button onClick={() => setFilled(false)} style={{ fontWeight: !filled ? 'bold' : 'normal' }}>
            Empty
          </button>{' '}
          <button onClick={() => setFilled(true)} style={{ fontWeight: filled ? 'bold' : 'normal' }}>
            Filled (Sample)
          </button>
        </div>
      </div>

      {/* Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Source PDF */}
        <div style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
          <h2>Source PDF (Page {pdfPageNum})</h2>
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#page=${pdfPageNum}`}
              style={{ width: '100%', height: '600px', border: 'none' }}
              title="Source PDF"
            />
          ) : (
            <p>Loading PDF...</p>
          )}
          <p style={{ fontSize: '10pt', color: '#666' }}>
            File: docs/templates/briefing-cert-source.pdf
          </p>
        </div>

        {/* HTML Rendering */}
        <div style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
          <h2>HTML Rendering ({lang.toUpperCase()}, {filled ? 'Filled' : 'Empty'})</h2>
          <div
            style={{
              fontFamily: "'Times New Roman', Times, Georgia, serif",
              fontSize: '11pt',
              lineHeight: 1.3,
              padding: '0.5in',
              border: '1px solid #000',
              background: '#fff',
              maxHeight: '600px',
              overflow: 'auto',
            }}
          >
            {/* Letterhead */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #000', paddingBottom: '0.5rem' }}>
              <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '0.25rem' }}>HACH</div>
              <div style={{ fontSize: '10pt', marginBottom: '0.25rem' }}>Housing Choice Voucher Program</div>
              <div style={{ fontSize: '9pt', lineHeight: 1.4 }}>
                180 John D. Wardlaw Way<br />
                Hartford, CT 06010<br />
                Phone: 860-723-8400 | Fax: 860-723-8554<br />
                TDD/TTY 1800-842-9710 or 711
              </div>
            </div>

            {/* Title */}
            <h1
              style={{
                textAlign: 'center',
                fontSize: '12pt',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                margin: '1.5rem 0',
                textDecoration: 'underline',
              }}
            >
              {content.title}
            </h1>

            {/* Certification */}
            <p style={{ margin: '1rem 0' }}>
              {lang === 'en'
                ? 'I certify that I have received the following documents from the Housing Authority of the City of Hartford:'
                : 'Certifico que he recibido los siguientes documentos de la Autoridad de Vivienda de la Ciudad de Hartford:'}
            </p>

            {/* Document List */}
            <ol style={{ margin: '1rem 0', paddingLeft: '1.5rem' }}>
              {content.documents.map((doc, i) => (
                <li key={i} style={{ marginBottom: '0.5rem' }}>
                  {doc}
                </li>
              ))}
            </ol>

            {/* Obligations */}
            <p style={{ margin: '1rem 0' }}>
              {lang === 'en'
                ? 'I further certify that I understand my family obligations as presented to me at my briefing.'
                : 'Además certifico que entiendo mis obligaciones familiares tal como se presenta en mi vale.'}
            </p>
            <p>
              {lang === 'en'
                ? 'I understand that when I am required to notify HACH of changes, I must do so within 10 business days of the change and the notification must be in writing.'
                : 'Entiendo que cuando debo notificar a HACH de cambios, debo notificar dentro de 10 días hábiles del cambio y la notificación debe ser por escrito.'}
            </p>

            {/* I understand that... */}
            <p>{content.iUnderstand}</p>
            <ul style={{ margin: '1rem 0', paddingLeft: '1.5rem', listStyle: 'none' }}>
              {content.bullets.map((bullet, i) => (
                <li key={i} style={{ marginBottom: '0.75rem', position: 'relative', paddingLeft: '1rem' }}>
                  <span style={{ position: 'absolute', left: 0 }}>•</span>
                  {bullet}
                </li>
              ))}
            </ul>

            {/* Signature Block */}
            <div
              style={{
                marginTop: '2rem',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: '1rem',
                alignItems: 'end',
              }}
            >
              <div>
                <div style={{ fontSize: '9pt', marginBottom: '0.25rem' }}>{content.fields.name}</div>
                <div
                  style={{
                    borderBottom: '1px solid #000',
                    padding: '0.25rem 0',
                    minHeight: '1.5rem',
                  }}
                >
                  {formData.name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9pt', marginBottom: '0.25rem' }}>{content.fields.signature}</div>
                <div
                  style={{
                    borderBottom: '1px solid #000',
                    padding: '0.25rem 0',
                    minHeight: '2rem',
                    color: formData.signature ? '#000' : '#666',
                    fontStyle: formData.signature ? 'normal' : 'italic',
                  }}
                >
                  {formData.signature || 'X'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9pt', marginBottom: '0.25rem' }}>{content.fields.date}</div>
                <div
                  style={{
                    borderBottom: '1px solid #000',
                    padding: '0.25rem 0',
                    minHeight: '1.5rem',
                  }}
                >
                  {formData.date}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '2rem', paddingTop: '1rem' }}>
              <p style={{ fontSize: '8pt', textAlign: 'center', marginBottom: '1rem' }}>
                {content.legalWarning}
              </p>
              <p style={{ textAlign: 'right', fontSize: '9pt' }}>{content.revisionDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
        <h2>Verification Checklist</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {CHECKLIST_ITEMS.map((item, i) => (
            <li key={i} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id={`check-${i}`}
                checked={checked[i] || false}
                onChange={() => toggleCheck(i)}
                style={{ marginTop: '0.25rem' }}
              />
              <label htmlFor={`check-${i}`} style={{ cursor: 'pointer' }}>
                {item}
              </label>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: '1rem', fontSize: '10pt', color: '#666' }}>
          Checked: {Object.values(checked).filter(Boolean).length} / {CHECKLIST_ITEMS.length}
        </p>
      </div>

      {/* Links */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ccc' }}>
        <a href="/pilot/briefing-cert">← Back to Form</a>
      </div>
    </div>
  );
}
