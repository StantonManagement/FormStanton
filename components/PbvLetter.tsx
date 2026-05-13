'use client';

import React from 'react';
import type { Language } from '@/lib/translations';

// ── Content ──────────────────────────────────────────────────────────────────

interface Step {
  num: number;
  color: 'coral' | 'navy' | 'green';
  title: string;
  date: string;
  datePill: 'coral' | 'navy' | 'green';
  desc: string;
}

interface LetterContent {
  title: string;
  greeting: string;
  p1: string;
  calloutGreen: string;
  p2: React.ReactNode;
  calloutAmber: string;
  sectionHdr: string;
  steps: Step[];
  calloutCoral: string;
  signoffP: string;
}

const content: Record<Language, LetterContent> = {
  en: {
    title: 'Opportunity for Current Tenants to Receive Housing Assistance',
    greeting: 'Dear Tenants,',
    p1: 'We have good news to share. Stanton Management has been awarded a significant number of Project-Based Vouchers (PBVs) through The Housing Authority of the City of Hartford (HACH). This program allows us to offer housing assistance directly to current tenants who do not already receive HCV/Section 8 benefits — meaning you may be able to continue living in your current apartment at a significantly lower cost.',
    calloutGreen: 'If your household qualifies, your rent drops to approximately 30–40% of your household income. HACH pays the remainder directly to us.',
    p2: <>This is not a waitlist. If you qualify and complete the steps below, assistance can begin as early as <strong>August 1, 2026</strong>. Our goal is to meet that date — but we need your cooperation and timely responses to make it happen.</>,
    calloutAmber: 'This opportunity will be reserved for tenants who have demonstrated that they truly treat their apartment as a home — those with a strong payment history, a well-maintained unit, and a cooperative relationship with management.',
    sectionHdr: 'Application Process',
    steps: [
      { num: 1, color: 'coral', title: 'Pre-Application', date: 'Due 5/19/26', datePill: 'coral', desc: 'A short 10-minute questionnaire. Tell us who lives in your apartment and your household\'s approximate income. This lets us determine whether you\'re likely to qualify. Complete online below — or use the paper form if needed.' },
      { num: 2, color: 'navy', title: 'Eligibility Notification', date: 'By 5/22/26', datePill: 'navy', desc: 'We will review your pre-application and notify you whether your household is eligible to proceed to the Full Application.' },
      { num: 3, color: 'navy', title: 'Full Application', date: 'Due 6/2/26', datePill: 'navy', desc: 'Complete the full Section 8 application and provide supporting documentation: government-issued IDs, birth certificates, proof of income (pay stubs), proof of assets (bank statements), and other items as required. We will provide you with the application and a full document checklist when you reach this step.' },
      { num: 4, color: 'navy', title: 'Pre-Inspection', date: '5/25–6/12/26', datePill: 'navy', desc: 'Stanton will inspect your unit and complete any repairs needed to pass the Section 8 Housing Quality Standards inspection.' },
      { num: 5, color: 'navy', title: 'Section 8 Inspection', date: 'By early July', datePill: 'navy', desc: 'After HACH processes your application and confirms eligibility, they will conduct their own inspection of your unit.' },
      { num: 6, color: 'navy', title: 'Program Onboarding', date: 'July 2026', datePill: 'navy', desc: 'You will attend a brief virtual meeting with HACH. They will explain program rules, your rights and responsibilities as a participant, and answer any questions.' },
      { num: 7, color: 'navy', title: 'HAP Contract Execution', date: 'July 2026', datePill: 'navy', desc: 'You and Stanton Management will sign the Housing Assistance Payments (HAP) contract, finalizing your enrollment in the program.' },
      { num: 8, color: 'green', title: 'Assistance Begins', date: 'Target 8/1/26', datePill: 'green', desc: 'HACH begins paying their portion of your rent directly to Stanton. You begin paying your reduced portion — approximately 30–40% of your household income.' },
    ],
    calloutCoral: 'Complete the Pre-Application below. It takes about 10 minutes.',
    signoffP: 'If you have any questions, please call or stop by the office. We\'re here to help.',
  },
  es: {
    title: 'Oportunidad para que los Inquilinos Actuales Reciban Asistencia de Vivienda',
    greeting: 'Estimados Inquilinos,',
    p1: 'Tenemos buenas noticias que compartir. Stanton Management ha recibido un número significativo de Vales Basados en Proyectos (PBV) a través de la Autoridad de Vivienda de la Ciudad de Hartford (HACH). Este programa nos permite ofrecer asistencia de vivienda directamente a los inquilinos actuales que aún no reciben beneficios de HCV/Sección 8 — lo que significa que usted podría seguir viviendo en su apartamento actual a un costo significativamente menor.',
    calloutGreen: 'Si su hogar califica, su porción del alquiler se reduciría a aproximadamente el 30–40% del ingreso de su hogar. HACH paga el resto directamente a nosotros.',
    p2: <>Esto no es una lista de espera. Si usted califica y completa los pasos a continuación, la asistencia puede comenzar tan pronto como el <strong>1 de agosto de 2026</strong>. Nuestra meta es cumplir esa fecha — pero necesitamos su cooperación y respuestas oportunas para lograrlo.</>,
    calloutAmber: 'Esta oportunidad estará reservada para inquilinos que han demostrado que realmente tratan su apartamento como un hogar — aquellos con un buen historial de pagos, una unidad bien mantenida y una relación cooperativa con la administración.',
    sectionHdr: 'Proceso de Solicitud',
    steps: [
      { num: 1, color: 'coral', title: 'Pre-Solicitud', date: 'Límite 5/19/26', datePill: 'coral', desc: 'Un breve cuestionario de 10 minutos. Díganos quién vive en su apartamento y el ingreso aproximado de su hogar. Esto nos permite determinar si es probable que califique. Complete en línea a continuación — o use el formulario en papel si es necesario.' },
      { num: 2, color: 'navy', title: 'Notificación de Elegibilidad', date: 'Para 5/22/26', datePill: 'navy', desc: 'Revisaremos su pre-solicitud y le notificaremos si su hogar es elegible para proceder a la Solicitud Completa.' },
      { num: 3, color: 'navy', title: 'Solicitud Completa', date: 'Límite 6/2/26', datePill: 'navy', desc: 'Complete la solicitud completa de la Sección 8 y proporcione la documentación de respaldo: identificaciones emitidas por el gobierno, certificados de nacimiento, comprobantes de ingresos (recibos de pago), comprobantes de activos (estados de cuenta bancarios) y otros documentos según sea necesario. Le proporcionaremos la solicitud y una lista completa de documentos cuando llegue a este paso.' },
      { num: 4, color: 'navy', title: 'Pre-Inspección', date: '5/25–6/12/26', datePill: 'navy', desc: 'Stanton inspeccionará su unidad y completará cualquier reparación necesaria para aprobar la inspección de Estándares de Calidad de Vivienda de la Sección 8.' },
      { num: 5, color: 'navy', title: 'Inspección de la Sección 8', date: 'Principios julio', datePill: 'navy', desc: 'Después de que HACH procese su solicitud y confirme la elegibilidad, realizarán su propia inspección de su unidad.' },
      { num: 6, color: 'navy', title: 'Incorporación al Programa', date: 'Julio 2026', datePill: 'navy', desc: 'Asistirá a una breve reunión virtual con HACH. Le explicarán las reglas del programa, sus derechos y responsabilidades como participante, y responderán cualquier pregunta.' },
      { num: 7, color: 'navy', title: 'Contrato HAP', date: 'Julio 2026', datePill: 'navy', desc: 'Usted y Stanton Management firmarán el contrato de Pagos de Asistencia de Vivienda (HAP), finalizando su inscripción en el programa.' },
      { num: 8, color: 'green', title: 'Comienza la Asistencia', date: 'Meta 8/1/26', datePill: 'green', desc: 'HACH comienza a pagar su porción del alquiler directamente a Stanton. Usted comienza a pagar su porción reducida — aproximadamente el 30–40% del ingreso de su hogar.' },
    ],
    calloutCoral: 'Complete la Pre-Solicitud a continuación. Toma aproximadamente 10 minutos.',
    signoffP: 'Si tiene alguna pregunta, por favor llame o visite nuestra oficina. Estamos aquí para ayudarle.',
  },
  pt: {
    title: 'Oportunidade para Inquilinos Atuais Receberem Assistência Habitacional',
    greeting: 'Prezados Inquilinos,',
    p1: 'Temos boas notícias para compartilhar. A Stanton Management recebeu um número significativo de Vouchers Baseados em Projetos (PBVs) através da Autoridade Habitacional da Cidade de Hartford (HACH). Este programa nos permite oferecer assistência habitacional diretamente aos inquilinos atuais que ainda não recebem benefícios do HCV/Seção 8 — o que significa que você poderá continuar morando em seu apartamento atual a um custo significativamente menor.',
    calloutGreen: 'Se a sua família se qualificar, a sua parte do aluguel será reduzida para aproximadamente 30–40% da renda familiar. A HACH paga o restante diretamente para nós.',
    p2: <>Isto não é uma lista de espera. Se você se qualificar e completar os passos abaixo, a assistência pode começar já em <strong>1º de agosto de 2026</strong>. Nosso objetivo é cumprir essa data — mas precisamos da sua cooperação e respostas pontuais para que isso aconteça.</>,
    calloutAmber: 'Esta oportunidade será reservada para inquilinos que demonstraram que realmente tratam seu apartamento como um lar — aqueles com um bom histórico de pagamento, uma unidade bem mantida e um relacionamento cooperativo com a administração.',
    sectionHdr: 'Processo de Solicitação',
    steps: [
      { num: 1, color: 'coral', title: 'Pré-Solicitação', date: 'Prazo 5/19/26', datePill: 'coral', desc: 'Um breve questionário de 10 minutos. Diga-nos quem mora em seu apartamento e a renda aproximada da sua família. Isso nos permite determinar se você provavelmente se qualifica. Complete online abaixo — ou use o formulário em papel, se necessário.' },
      { num: 2, color: 'navy', title: 'Notificação de Elegibilidade', date: 'Até 5/22/26', datePill: 'navy', desc: 'Analisaremos sua pré-solicitação e notificaremos se sua família é elegível para prosseguir com a Solicitação Completa.' },
      { num: 3, color: 'navy', title: 'Solicitação Completa', date: 'Prazo 6/2/26', datePill: 'navy', desc: 'Preencha a solicitação completa da Seção 8 e forneça a documentação de apoio: identidades emitidas pelo governo, certidões de nascimento, comprovantes de renda (contracheques), comprovantes de bens (extratos bancários) e outros itens conforme necessário. Forneceremos a solicitação e uma lista completa de documentos quando você chegar a esta etapa.' },
      { num: 4, color: 'navy', title: 'Pré-Inspeção', date: '5/25–6/12/26', datePill: 'navy', desc: 'A Stanton inspecionará sua unidade e concluirá quaisquer reparos necessários para passar na inspeção dos Padrões de Qualidade Habitacional da Seção 8.' },
      { num: 5, color: 'navy', title: 'Inspeção da Seção 8', date: 'Início de julho', datePill: 'navy', desc: 'Após a HACH processar sua solicitação e confirmar a elegibilidade, eles realizarão sua própria inspeção da sua unidade.' },
      { num: 6, color: 'navy', title: 'Integração ao Programa', date: 'Julho 2026', datePill: 'navy', desc: 'Você participará de uma breve reunião virtual com a HACH. Eles explicarão as regras do programa, seus direitos e responsabilidades como participante, e responderão a quaisquer perguntas.' },
      { num: 7, color: 'navy', title: 'Contrato HAP', date: 'Julho 2026', datePill: 'navy', desc: 'Você e a Stanton Management assinarão o contrato de Pagamentos de Assistência Habitacional (HAP), finalizando sua inscrição no programa.' },
      { num: 8, color: 'green', title: 'Início da Assistência', date: 'Meta 8/1/26', datePill: 'green', desc: 'A HACH começa a pagar a sua parte do aluguel diretamente à Stanton. Você começa a pagar sua parte reduzida — aproximadamente 30–40% da renda familiar.' },
    ],
    calloutCoral: 'Complete a Pré-Solicitação abaixo. Leva cerca de 10 minutos.',
    signoffP: 'Se tiver alguma dúvida, ligue ou passe no escritório. Estamos aqui para ajudar.',
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const circleColors = {
  coral: { bg: '#E8734A' },
  navy:  { bg: '#2B2D6E' },
  green: { bg: '#27AE60' },
};

const pillStyles = {
  coral: { background: '#FFF0EB', color: '#E8734A' },
  navy:  { background: '#EEF2F9', color: '#2B2D6E' },
  green: { background: '#E6F5EC', color: '#1B7340' },
};

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <div style={{ position: 'relative', paddingLeft: '36px', margin: '18px 0 12px' }}>
      {/* Vertical connector line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '13px',
          top: '13px',
          bottom: '13px',
          width: '2px',
          background: '#D8D8E0',
        }}
      />
      {steps.map((step, i) => (
        <div
          key={step.num}
          style={{ position: 'relative', paddingBottom: i < steps.length - 1 ? '24px' : '0' }}
        >
          {/* Circle */}
          <div
            style={{
              position: 'absolute',
              left: '-36px',
              top: '0',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: circleColors[step.color].bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '12px',
              zIndex: 1,
            }}
          >
            {step.num}
          </div>

          {/* Header row: title + date pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#1A1A2E' }}>{step.title}</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '10px',
                whiteSpace: 'nowrap',
                ...pillStyles[step.datePill],
              }}
            >
              {step.date}
            </span>
          </div>

          {/* Description */}
          <p style={{ fontSize: '14px', color: '#6B6B80', lineHeight: 1.5, marginTop: '4px', marginBottom: 0 }}>
            {step.desc}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PbvLetterProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PbvLetter({ language, onLanguageChange }: PbvLetterProps) {
  const c = content[language];

  const langButtons: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#333344', background: '#fff' }}>
      {/* ── Logo header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 20px 12px', background: '#fff' }}>
        <img
          src="/Stanton-logo.PNG"
          alt="Stanton Management"
          style={{ maxWidth: '200px', width: '100%', height: 'auto' }}
        />
      </div>

      {/* ── Sticky language bar ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          background: '#2B2D6E',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '8px 20px',
          gap: '0',
        }}
      >
        {langButtons.map(({ code, label }) => (
          <button
            key={code}
            onClick={() => onLanguageChange(code)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: language === code ? '#fff' : 'transparent',
              color: language === code ? '#2B2D6E' : 'rgba(255,255,255,0.9)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.2s',
              minHeight: '44px',
            }}
            aria-pressed={language === code}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Letter body ─────────────────────────────────────── */}
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '0 20px 8px' }}>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            color: '#2B2D6E',
            fontSize: '22px',
            fontWeight: 700,
            lineHeight: 1.25,
            margin: '24px 0 18px',
          }}
        >
          {c.title}
        </h1>

        {/* Greeting */}
        <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '14px', lineHeight: 1.55 }}>
          {c.greeting}
        </p>

        {/* Opening paragraph */}
        <p style={{ fontSize: '16px', lineHeight: 1.55, marginBottom: '14px' }}>{c.p1}</p>

        {/* Green callout */}
        <div
          style={{
            background: '#E6F5EC',
            color: '#1B7340',
            borderRadius: '8px',
            padding: '16px 18px',
            margin: '18px 0',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: 1.5,
          }}
        >
          {c.calloutGreen}
        </div>

        {/* "Not a waitlist" paragraph */}
        <p style={{ fontSize: '16px', lineHeight: 1.55, marginBottom: '14px' }}>{c.p2}</p>

        {/* Amber callout */}
        <div
          style={{
            background: '#FFF8ED',
            color: '#7A5C1F',
            borderRadius: '8px',
            padding: '16px 18px',
            margin: '18px 0',
            borderLeft: '4px solid #E8B44A',
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: 1.5,
          }}
        >
          {c.calloutAmber}
        </div>

        {/* Application Process header */}
        <div style={{ margin: '22px 0 4px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              color: '#2B2D6E',
              fontSize: '19px',
              fontWeight: 700,
              marginBottom: '4px',
            }}
          >
            {c.sectionHdr}
          </h2>
          <div
            aria-hidden
            style={{ width: '180px', height: '3px', background: '#E8734A', borderRadius: '2px' }}
          />
        </div>

        {/* Timeline */}
        <Timeline steps={c.steps} />

        {/* Coral CTA */}
        <div
          style={{
            background: '#E8734A',
            color: '#fff',
            borderRadius: '8px',
            padding: '16px 18px',
            margin: '18px 0',
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: 1.5,
          }}
        >
          {c.calloutCoral}
        </div>

        {/* Sign-off paragraph */}
        <p style={{ fontSize: '16px', lineHeight: 1.55, marginBottom: '8px' }}>{c.signoffP}</p>

        <div style={{ marginTop: '14px' }}>
          <div style={{ color: '#2B2D6E', fontWeight: 700, fontSize: '16px' }}>Stanton Management</div>
          <div style={{ color: '#6B6B80', fontSize: '14px', marginTop: '2px' }}>
            (860) 993-3401 · info@stantoncap.com
          </div>
        </div>
      </div>

      {/* ── Divider before form ──────────────────────────────── */}
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '0 20px' }}>
        <hr style={{ border: 'none', borderTop: '2px solid #D8D8E0', margin: '32px 0 0' }} />
        <p style={{ textAlign: 'center', color: '#6B6B80', fontSize: '14px', margin: '12px 0 0', paddingBottom: '8px' }}>
          ↓&nbsp;Pre-Application Form Below&nbsp;↓
        </p>
      </div>
    </div>
  );
}
