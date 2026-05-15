/**
 * lib/pbv/summary-doc/content.ts
 *
 * Text content for the PBV application summary document (PRD-28).
 * All sections appear in the tenant's preferred language.
 *
 * ES/PT: best-effort machine-aided drafts, marked tentative.
 * Search for "// CONTENT: tentative" to find all strings requiring review.
 *
 * Template version: 1.0.0
 */

export const SUMMARY_TEMPLATE_VERSION = '1.0.0';

export type Language = 'en' | 'es' | 'pt';

export interface SummaryContent {
  doc_title: string;
  for_label: string;
  section_what_applying_for_title: string;
  section_what_applying_for_body: string;
  section_package_title: string;
  section_uploads_title: string;
  section_uploads_none: string;
  section_language_note_title: string;
  section_language_note_body: (submissionLanguage: string, preferredLanguage: string) => string;
  section_contact_title: string;
  section_contact_body: (preferredLanguage: string) => string;
  section_acknowledgement_title: string;
  section_acknowledgement_body: string;
  signature_line_label: string;
  date_label: string;
  footer_tentative_notice?: string;
}

export const SUMMARY_CONTENT: Record<Language, SummaryContent> = {
  en: {
    doc_title: 'PBV Application Summary',
    for_label: 'For',
    section_what_applying_for_title: 'What You Are Applying For',
    section_what_applying_for_body:
      'You are applying for a Project-Based Voucher (PBV) through the Hartford Area Community Housing (HACH) Housing Choice Voucher program. '
      + 'A PBV subsidy is tied to a specific unit managed by Stanton Management. If approved, your household will pay a portion of the rent based on your income, '
      + 'and the housing authority will pay the remainder directly to the landlord.',
    section_package_title: 'What\u2019s in Your Application Package',
    section_uploads_title: 'Documents You Will Need to Upload',
    section_uploads_none: 'No additional uploads required based on your application.',
    section_language_note_title: 'Language Note',
    section_language_note_body: (submissionLang, preferredLang) => {
      if (preferredLang === 'pt') {
        return `The federal forms in your application are in Spanish. This is the language HACH uses for these federal forms. `
          + `You are reading this summary in Portuguese to confirm that you understood what you are signing, even though the federal forms themselves are in Spanish. `
          + `If you need assistance understanding any form, please contact Stanton Management before signing.`;
      }
      if (preferredLang === 'es') {
        return `The federal forms in your application are in Spanish, which is your preferred language. All forms and correspondence will be provided in Spanish.`;
      }
      return `The federal forms in your application are in English, which is your preferred language.`;
    },
    section_contact_title: 'How HACH Will Contact You',
    section_contact_body: (preferredLang) =>
      `Your preferred language for future contact is ${preferredLang === 'en' ? 'English' : preferredLang === 'es' ? 'Spanish' : 'Portuguese'}. `
      + `This preference has been noted in your application and will be communicated to HACH\u2019s reviewer.`,
    section_acknowledgement_title: 'Your Acknowledgement',
    section_acknowledgement_body:
      'By signing below, you confirm that: (1) you have read and understood this summary; '
      + '(2) you understand what you are applying for and what you are being asked to sign; '
      + 'and (3) you intend to be bound by your signatures on the federal forms in this application package.',
    signature_line_label: 'Signature \u2014 Head of Household',
    date_label: 'Date',
  },

  es: {
    // CONTENT: tentative — review with Dan + translator
    doc_title: 'Resumen de Solicitud PBV',
    for_label: 'Para',
    section_what_applying_for_title: 'Para qu\u00e9 est\u00e1 solicitando',
    section_what_applying_for_body:
      'Usted est\u00e1 solicitando un Vale Basado en Proyectos (PBV) a trav\u00e9s del programa de Vales de Elecci\u00f3n de Vivienda de Hartford Area Community Housing (HACH). '
      + 'Un subsidio PBV est\u00e1 vinculado a una unidad espec\u00edfica administrada por Stanton Management. Si es aprobado, su hogar pagar\u00e1 una parte del alquiler seg\u00fan sus ingresos, '
      + 'y la autoridad de vivienda pagar\u00e1 el resto directamente al propietario.',
    section_package_title: 'Qu\u00e9 hay en su paquete de solicitud',
    section_uploads_title: 'Documentos que deber\u00e1 cargar',
    section_uploads_none: 'No se requieren cargas adicionales seg\u00fan su solicitud.',
    section_language_note_title: 'Nota sobre el idioma',
    section_language_note_body: (_submissionLang, _preferredLang) =>
      'Los formularios federales de su solicitud est\u00e1n en espa\u00f1ol, que es su idioma preferido. Todos los formularios y comunicaciones se proporcionar\u00e1n en espa\u00f1ol.',
    section_contact_title: 'C\u00f3mo HACH se pondr\u00e1 en contacto con usted',
    section_contact_body: (_preferredLang) =>
      'Su idioma preferido para futuros contactos es el espa\u00f1ol. Esta preferencia ha sido registrada en su solicitud y se comunicar\u00e1 al revisor de HACH.',
    section_acknowledgement_title: 'Su reconocimiento',
    section_acknowledgement_body:
      'Al firmar a continuaci\u00f3n, confirma que: (1) ha le\u00eddo y comprendido este resumen; '
      + '(2) entiende para qu\u00e9 est\u00e1 solicitando y qu\u00e9 se le pide que firme; '
      + 'y (3) tiene la intenci\u00f3n de quedar obligado por sus firmas en los formularios federales de este paquete de solicitud.',
    signature_line_label: 'Firma \u2014 Jefe de Hogar',
    date_label: 'Fecha',
  },

  pt: {
    // CONTENT: tentative — review with Dan + translator
    doc_title: 'Resumo da Solicita\u00e7\u00e3o PBV',
    for_label: 'Para',
    section_what_applying_for_title: 'Para o que voc\u00ea est\u00e1 solicitando',
    section_what_applying_for_body:
      'Voc\u00ea est\u00e1 solicitando um Vale Baseado em Projeto (PBV) atrav\u00e9s do programa de Vale de Escolha de Habita\u00e7\u00e3o do Hartford Area Community Housing (HACH). '
      + 'Um subs\u00eddio PBV est\u00e1 vinculado a uma unidade espec\u00edfica gerenciada pela Stanton Management. Se aprovado, seu dom\u00edcilio pagar\u00e1 uma parte do aluguel com base em sua renda, '
      + 'e a autoridade habitacional pagar\u00e1 o restante diretamente ao propriet\u00e1rio.',
    section_package_title: 'O que est\u00e1 no seu pacote de solicita\u00e7\u00e3o',
    section_uploads_title: 'Documentos que voc\u00ea precisar\u00e1 enviar',
    section_uploads_none: 'Nenhum envio adicional necess\u00e1rio com base na sua solicita\u00e7\u00e3o.',
    section_language_note_title: 'Observa\u00e7\u00e3o sobre idioma',
    section_language_note_body: (_submissionLang, _preferredLang) =>
      'Os formul\u00e1rios federais da sua solicita\u00e7\u00e3o est\u00e3o em espanhol. Este \u00e9 o idioma que o HACH usa para esses formul\u00e1rios federais. '
      + 'Voc\u00ea est\u00e1 lendo este resumo em portugu\u00eas para confirmar que compreendeu o que est\u00e1 assinando, mesmo que os formul\u00e1rios federais em si estejam em espanhol. '
      + 'Se precisar de ajuda para entender qualquer formul\u00e1rio, entre em contato com a Stanton Management antes de assinar.',
    section_contact_title: 'Como o HACH entrar\u00e1 em contato com voc\u00ea',
    section_contact_body: (_preferredLang) =>
      'Seu idioma preferido para contatos futuros \u00e9 o portugu\u00eas. Esta prefer\u00eancia foi registrada em sua solicita\u00e7\u00e3o e ser\u00e1 comunicada ao revisor do HACH.',
    section_acknowledgement_title: 'Seu reconhecimento',
    section_acknowledgement_body:
      'Ao assinar abaixo, voc\u00ea confirma que: (1) leu e compreendeu este resumo; '
      + '(2) entende o que est\u00e1 solicitando e o que est\u00e1 sendo pedido para assinar; '
      + 'e (3) pretende ficar vinculado pelas suas assinaturas nos formul\u00e1rios federais deste pacote de solicita\u00e7\u00e3o.',
    signature_line_label: 'Assinatura \u2014 Chefe de Fam\u00edlia',
    date_label: 'Data',
  },
};
