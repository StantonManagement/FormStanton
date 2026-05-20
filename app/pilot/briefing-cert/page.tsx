'use client';

import { useState } from 'react';
import styles from './styles.module.css';

const EN_CONTENT = {
  letterhead: {
    authority: 'Housing Authority of the City of Hartford',
    program: 'Housing Choice Voucher Program',
    address: '180 John D. Wardlaw Way',
    city: 'Hartford, CT 06010',
    phone: 'Phone: 860-723-8400',
    fax: 'Fax: 860-723-8554',
    tty: 'TDD/TTY 1800-842-9710 or 711',
  },
  title: 'FAMILY CERTIFICATION OF BRIEFING DOCUMENTS RECEIVED',
  certification: 'I certify that I have received the following documents from the Housing Authority of the City of Hartford:',
  documents: [
    'Debts owed to Public Housing Agencies and Terminations (form HUD-52675)',
    'Supplement to Application for Federally Assisted Housing (form HUD-92006)',
    'What You Should Know (form HUD-1140-OIG)',
    'Right to Request a Reasonable Accommodation',
    'Violence Against Women Act Notice (VAWA)',
    'HUD brochure "Protect Your Family from Lead in Your Home"',
    '"Is it Worth It?" (form HUD-1141-OIG)',
    'Information on how to file a Housing Discrimination Complaint',
  ],
  obligations: 'I further certify that I understand my family obligations as presented to me at my briefing.',
  notification: 'I understand that when I am required to notify HACH of changes, I must do so within 10 business days of the change and the notification must be in writing.',
  iUnderstand: 'I understand that:',
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
  letterhead: {
    authority: 'Housing Authority of the City of Hartford',
    program: 'Housing Choice Voucher Program',
    address: '180 John D. Wardlaw Way',
    city: 'Hartford, CT 06010',
    phone: 'Phone: 860-723-8400',
    fax: 'Fax: 860-723-8554',
    tty: 'TDD/TTY 1800-842-9710 or 711',
  },
  title: 'CERTIFICACIÓN DE FAMILIA DE DOCUMENTOS DE INFORMACIÓN RECIBIDOS',
  certification: 'Certifico que he recibido los siguientes documentos de la Autoridad de Vivienda de la Ciudad de Hartford:',
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
  obligations: 'Además certifico que entiendo mis obligaciones familiares tal como se presenta en mi vale.',
  notification: 'Entiendo que cuando debo notificar a HACH de cambios, debo notificar dentro de 10 días hábiles del cambio y la notificación debe ser por escrito.',
  iUnderstand: 'Entiendo que:',
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

const SAMPLE_DATA = {
  name: 'Maria Garcia-Rodriguez',
  signature: 'Maria Garcia-Rodriguez',
  date: '2026-05-14',
};

export default function BriefingCertPage() {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [formData, setFormData] = useState({
    name: '',
    signature: '',
    date: '',
  });

  const content = lang === 'en' ? EN_CONTENT : ES_CONTENT;

  const handlePrint = () => {
    window.print();
  };

  const loadSampleData = () => {
    setFormData(SAMPLE_DATA);
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className={styles.formContainer}>
      {/* UI Chrome - Hidden on Print */}
      <div className={styles.uiChrome}>
        <div className={styles.languageToggle}>
          <button
            className={lang === 'en' ? styles.active : ''}
            onClick={() => setLang('en')}
            type="button"
          >
            EN
          </button>
          <button
            className={lang === 'es' ? styles.active : ''}
            onClick={() => setLang('es')}
            type="button"
          >
            ES
          </button>
        </div>
        <button className={styles.printButton} onClick={handlePrint} type="button">
          Print / Save as PDF
        </button>
        <button className={styles.sampleButton} onClick={loadSampleData} type="button">
          Load Sample Data
        </button>
      </div>

      {/* Letterhead */}
      <div className={styles.letterhead}>
        <div className={styles.logoPlaceholder}>HACH</div>
        <div className={styles.programName}>{content.letterhead.program}</div>
        <div className={styles.addressBlock}>
          {content.letterhead.address}<br />
          {content.letterhead.city}<br />
          {content.letterhead.phone} | {content.letterhead.fax}<br />
          {content.letterhead.tty}
        </div>
      </div>

      {/* Title */}
      <h1 className={styles.formTitle}>{content.title}</h1>

      {/* Certification */}
      <p className={styles.certificationText}>{content.certification}</p>

      {/* Document List */}
      <ol className={styles.documentList}>
        {content.documents.map((doc, i) => (
          <li key={i}>{doc}</li>
        ))}
      </ol>

      {/* Obligations */}
      <p className={styles.obligationsText}>{content.obligations}</p>
      <p>{content.notification}</p>

      {/* I understand that... */}
      <p>{content.iUnderstand}</p>
      <ul className={styles.bulletList}>
        {content.bullets.map((bullet, i) => (
          <li key={i}>{bullet}</li>
        ))}
      </ul>

      {/* Signature Block */}
      <div className={styles.signatureBlock}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{content.fields.name}</label>
          <input
            type="text"
            className={styles.textInput}
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{content.fields.signature}</label>
          <div className={styles.signaturePlaceholder}>
            {formData.signature || 'X'}
          </div>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{content.fields.date}</label>
          <input
            type="text"
            className={styles.textInput}
            value={formData.date}
            onChange={(e) => updateField('date', e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <p className={styles.legalWarning}>{content.legalWarning}</p>
        <p className={styles.revisionDate}>{content.revisionDate}</p>
      </div>
    </div>
  );
}
