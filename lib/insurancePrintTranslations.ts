export type PrintLang = 'en' | 'es' | 'pt';

interface InsuranceTranslations {
  // Shared field labels
  tenantName: string;
  unitAddress: string;
  date: string;

  // Insurance Auth doc
  authTitle: string;
  authRequirementsHeading: string;
  authRequirementsIntro: string;
  authMinCoverage: string;
  authUnitAddress: string;
  authAdditionalInsured: string;
  authAdditionalInsuredHeading: string;
  authAdditionalInsuredName: string;
  authAdditionalInsuredAddress: string;
  authSelectOption: string;
  authOptionATitle: string;
  authOptionABody: string;
  authOptionBTitle: string;
  authOptionBBody: string;
  authTenantSignature: string;
  authReceivedBy: string;

  // Additional Insured Instructions doc
  instrTitle: string;

  // Full renters insurance overview section
  instrWhatIsHeading: string;
  instrWhatIsBody: string;
  instrRequirementsHeading: string;
  instrRequirementsIntro: string;
  instrReqCoverage: string;
  instrReqUnitAddress: string;
  instrReqAdditionalInsured: string;

  // Additional insured details
  instrYourLLCHeading: string;
  instrAdditionalInsuredName: string;
  instrAdditionalInsuredAddress: string;

  // Phone call instructions
  instrHowToAddHeading: string;
  instrCallIntro: string;
  instrCallScript: string;
  instrTheyAsk: string;
  instrYouSay: string;
  instrAIName: string;
  instrAIAddress: string;
  instrRelationship: string;
  instrRelationshipAnswer: string;

  // After the call
  instrAfterCallHeading: string;
  instrAfterCall1: string;
  instrAfterCall2: string;

  // Help
  instrNeedHelpHeading: string;
  instrNeedHelp1: string;
  instrNeedHelp2: string;

  // Footer
  footerGenerated: string;
}

const en: InsuranceTranslations = {
  tenantName: 'Tenant Name(s)',
  unitAddress: 'Unit Address',
  date: 'Date',

  // Auth doc
  authTitle: 'Renters Insurance Requirement',
  authRequirementsHeading: 'Insurance Requirements',
  authRequirementsIntro: 'All tenants are required to maintain renters insurance. Your policy must include:',
  authMinCoverage: 'Minimum Liability Coverage: $100,000 ($300,000 if you have pets)',
  authUnitAddress: 'Your unit address listed on the policy',
  authAdditionalInsured: "Additional Insured: Your building's LLC (see below)",
  authAdditionalInsuredHeading: "Your Building's Additional Insured",
  authAdditionalInsuredName: 'Additional Insured Name:',
  authAdditionalInsuredAddress: 'Additional Insured Address:',
  authSelectOption: 'Select One Option',
  authOptionATitle: 'Option A -- I will get my own insurance',
  authOptionABody: 'I will purchase renters insurance from a provider of my choice and provide proof of coverage to the office. My policy will meet all requirements listed above, including naming the Additional Insured.',
  authOptionBTitle: 'Option B -- Enroll me through Stanton Management',
  authOptionBBody: 'I authorize Stanton Management to enroll me in renters insurance through Appfolio. The cost ($10-25/month) will be added to my rent. I understand coverage will begin upon enrollment and I do not need to take any further action.',
  authTenantSignature: 'Tenant Signature',
  authReceivedBy: 'Received by (Stanton Management)',

  // Instructions doc
  instrTitle: 'Renters Insurance & Additional Insured Instructions',

  instrWhatIsHeading: 'What Is Renters Insurance?',
  instrWhatIsBody: 'Renters insurance is a policy that protects your personal belongings and provides liability coverage in case of accidents in your home. It is required by your lease. Your landlord\'s insurance does NOT cover your belongings or personal liability.',

  instrRequirementsHeading: 'Your Insurance Requirements',
  instrRequirementsIntro: 'Your renters insurance policy must include all of the following:',
  instrReqCoverage: 'Minimum Liability Coverage: $100,000 ($300,000 if you have pets)',
  instrReqUnitAddress: 'Your unit address must be listed on the policy',
  instrReqAdditionalInsured: 'Your building\'s LLC must be listed as an "Additional Insured" (see below)',

  instrYourLLCHeading: 'Your Building\'s Additional Insured (LLC)',
  instrAdditionalInsuredName: 'Additional Insured Name:',
  instrAdditionalInsuredAddress: 'Additional Insured Address:',

  instrHowToAddHeading: 'How to Add the Additional Insured',
  instrCallIntro: 'Call the phone number on your insurance card and tell them:',
  instrCallScript: '"I need to add an Additional Insured to my renters insurance policy."',
  instrTheyAsk: 'They Will Ask',
  instrYouSay: 'You Say',
  instrAIName: 'Additional Insured Name',
  instrAIAddress: 'Address',
  instrRelationship: 'Relationship',
  instrRelationshipAnswer: 'Landlord',

  instrAfterCallHeading: 'After the Call',
  instrAfterCall1: 'Ask them to email or mail you updated proof of insurance showing the Additional Insured',
  instrAfterCall2: 'Bring the proof to the office or email it to: info@stantonmgmt.com',

  instrNeedHelpHeading: 'Need Help?',
  instrNeedHelp1: 'Bring your phone to the office and we can help you make the call.',
  instrNeedHelp2: 'Or call us at (860) 993-3401, Mon-Fri 9 AM - 5 PM.',

  footerGenerated: 'Generated by Stanton Management',
};

const es: InsuranceTranslations = {
  tenantName: 'Nombre del Inquilino(s)',
  unitAddress: 'Dirección del Apartamento',
  date: 'Fecha',

  authTitle: 'Requisito de Seguro de Inquilino',
  authRequirementsHeading: 'Requisitos del Seguro',
  authRequirementsIntro: 'Todos los inquilinos deben mantener un seguro de inquilino. Su póliza debe incluir:',
  authMinCoverage: 'Cobertura Mínima de Responsabilidad: $100,000 ($300,000 si tiene mascotas)',
  authUnitAddress: 'La dirección de su apartamento debe aparecer en la póliza',
  authAdditionalInsured: 'Asegurado Adicional: La LLC de su edificio (ver abajo)',
  authAdditionalInsuredHeading: 'Asegurado Adicional de Su Edificio',
  authAdditionalInsuredName: 'Nombre del Asegurado Adicional:',
  authAdditionalInsuredAddress: 'Dirección del Asegurado Adicional:',
  authSelectOption: 'Seleccione Una Opción',
  authOptionATitle: 'Opción A -- Obtendré mi propio seguro',
  authOptionABody: 'Compraré un seguro de inquilino con un proveedor de mi elección y proporcionaré prueba de cobertura a la oficina. Mi póliza cumplirá con todos los requisitos mencionados anteriormente, incluyendo nombrar al Asegurado Adicional.',
  authOptionBTitle: 'Opción B -- Inscríbame a través de Stanton Management',
  authOptionBBody: 'Autorizo a Stanton Management a inscribirme en un seguro de inquilino a través de Appfolio. El costo ($10-25/mes) se agregará a mi alquiler. Entiendo que la cobertura comenzará al inscribirme y no necesito tomar ninguna acción adicional.',
  authTenantSignature: 'Firma del Inquilino',
  authReceivedBy: 'Recibido por (Stanton Management)',

  instrTitle: 'Seguro de Inquilino e Instrucciones de Asegurado Adicional',

  instrWhatIsHeading: '¿Qué Es el Seguro de Inquilino?',
  instrWhatIsBody: 'El seguro de inquilino es una póliza que protege sus pertenencias personales y proporciona cobertura de responsabilidad en caso de accidentes en su hogar. Es requerido por su contrato de arrendamiento. El seguro de su arrendador NO cubre sus pertenencias ni su responsabilidad personal.',

  instrRequirementsHeading: 'Requisitos de Su Seguro',
  instrRequirementsIntro: 'Su póliza de seguro de inquilino debe incluir todo lo siguiente:',
  instrReqCoverage: 'Cobertura Mínima de Responsabilidad: $100,000 ($300,000 si tiene mascotas)',
  instrReqUnitAddress: 'La dirección de su apartamento debe aparecer en la póliza',
  instrReqAdditionalInsured: 'La LLC de su edificio debe figurar como "Asegurado Adicional" (ver abajo)',

  instrYourLLCHeading: 'Asegurado Adicional de Su Edificio (LLC)',
  instrAdditionalInsuredName: 'Nombre del Asegurado Adicional:',
  instrAdditionalInsuredAddress: 'Dirección del Asegurado Adicional:',

  instrHowToAddHeading: 'Cómo Agregar el Asegurado Adicional',
  instrCallIntro: 'Llame al número de teléfono en su tarjeta de seguro y dígales:',
  instrCallScript: '"Necesito agregar un Asegurado Adicional a mi póliza de seguro de inquilino."',
  instrTheyAsk: 'Le Preguntarán',
  instrYouSay: 'Usted Dice',
  instrAIName: 'Nombre del Asegurado Adicional',
  instrAIAddress: 'Dirección',
  instrRelationship: 'Relación',
  instrRelationshipAnswer: 'Arrendador (Landlord)',

  instrAfterCallHeading: 'Después de la Llamada',
  instrAfterCall1: 'Pídales que le envíen por correo electrónico o postal una prueba actualizada de seguro que muestre al Asegurado Adicional',
  instrAfterCall2: 'Traiga la prueba a la oficina o envíela por correo electrónico a: info@stantonmgmt.com',

  instrNeedHelpHeading: '¿Necesita Ayuda?',
  instrNeedHelp1: 'Traiga su teléfono a la oficina y podemos ayudarle a hacer la llamada.',
  instrNeedHelp2: 'O llámenos al (860) 993-3401, Lun-Vie 9 AM - 5 PM.',

  footerGenerated: 'Generado por Stanton Management',
};

const pt: InsuranceTranslations = {
  tenantName: 'Nome do Inquilino(s)',
  unitAddress: 'Endereço do Apartamento',
  date: 'Data',

  authTitle: 'Requisito de Seguro de Inquilino',
  authRequirementsHeading: 'Requisitos do Seguro',
  authRequirementsIntro: 'Todos os inquilinos devem manter um seguro de inquilino. Sua apólice deve incluir:',
  authMinCoverage: 'Cobertura Mínima de Responsabilidade: $100.000 ($300.000 se tiver animais de estimação)',
  authUnitAddress: 'O endereço do seu apartamento deve constar na apólice',
  authAdditionalInsured: 'Segurado Adicional: A LLC do seu edifício (veja abaixo)',
  authAdditionalInsuredHeading: 'Segurado Adicional do Seu Edifício',
  authAdditionalInsuredName: 'Nome do Segurado Adicional:',
  authAdditionalInsuredAddress: 'Endereço do Segurado Adicional:',
  authSelectOption: 'Selecione Uma Opção',
  authOptionATitle: 'Opção A -- Vou obter meu próprio seguro',
  authOptionABody: 'Vou comprar um seguro de inquilino com um provedor de minha escolha e fornecer comprovante de cobertura ao escritório. Minha apólice atenderá a todos os requisitos listados acima, incluindo nomear o Segurado Adicional.',
  authOptionBTitle: 'Opção B -- Inscreva-me através da Stanton Management',
  authOptionBBody: 'Autorizo a Stanton Management a me inscrever no seguro de inquilino através do Appfolio. O custo ($10-25/mês) será adicionado ao meu aluguel. Entendo que a cobertura começará após a inscrição e não preciso tomar nenhuma ação adicional.',
  authTenantSignature: 'Assinatura do Inquilino',
  authReceivedBy: 'Recebido por (Stanton Management)',

  instrTitle: 'Seguro de Inquilino e Instruções de Segurado Adicional',

  instrWhatIsHeading: 'O Que É Seguro de Inquilino?',
  instrWhatIsBody: 'O seguro de inquilino é uma apólice que protege seus pertences pessoais e fornece cobertura de responsabilidade em caso de acidentes em sua casa. É exigido pelo seu contrato de locação. O seguro do seu proprietário NÃO cobre seus pertences ou responsabilidade pessoal.',

  instrRequirementsHeading: 'Requisitos do Seu Seguro',
  instrRequirementsIntro: 'Sua apólice de seguro de inquilino deve incluir tudo o seguinte:',
  instrReqCoverage: 'Cobertura Mínima de Responsabilidade: $100.000 ($300.000 se tiver animais de estimação)',
  instrReqUnitAddress: 'O endereço do seu apartamento deve constar na apólice',
  instrReqAdditionalInsured: 'A LLC do seu edifício deve ser listada como "Segurado Adicional" (veja abaixo)',

  instrYourLLCHeading: 'Segurado Adicional do Seu Edifício (LLC)',
  instrAdditionalInsuredName: 'Nome do Segurado Adicional:',
  instrAdditionalInsuredAddress: 'Endereço do Segurado Adicional:',

  instrHowToAddHeading: 'Como Adicionar o Segurado Adicional',
  instrCallIntro: 'Ligue para o número de telefone no seu cartão de seguro e diga:',
  instrCallScript: '"Preciso adicionar um Segurado Adicional à minha apólice de seguro de inquilino."',
  instrTheyAsk: 'Eles Perguntarão',
  instrYouSay: 'Você Diz',
  instrAIName: 'Nome do Segurado Adicional',
  instrAIAddress: 'Endereço',
  instrRelationship: 'Relacionamento',
  instrRelationshipAnswer: 'Proprietário (Landlord)',

  instrAfterCallHeading: 'Após a Ligação',
  instrAfterCall1: 'Peça que enviem por e-mail ou correio um comprovante atualizado de seguro mostrando o Segurado Adicional',
  instrAfterCall2: 'Traga o comprovante ao escritório ou envie por e-mail para: info@stantonmgmt.com',

  instrNeedHelpHeading: 'Precisa de Ajuda?',
  instrNeedHelp1: 'Traga seu telefone ao escritório e podemos ajudá-lo a fazer a ligação.',
  instrNeedHelp2: 'Ou ligue para (860) 993-3401, Seg-Sex 9h - 17h.',

  footerGenerated: 'Gerado por Stanton Management',
};

const translations: Record<PrintLang, InsuranceTranslations> = { en, es, pt };

export function getInsuranceTranslations(lang: PrintLang): InsuranceTranslations {
  return translations[lang] || translations.en;
}
