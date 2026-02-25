export type Language = 'en' | 'es' | 'pt';

export const policyContent = {
  en: {
    introHeading: "WHAT IS CHANGING:",
    introText: "As you may know, Stanton Management is now managing your building. We want to introduce you to a few new changes and requirements that may have not been required by the prior owner/manager.",
    
    petPolicyHeading: "PET POLICY",
    petPolicyText: `All tenants must fill this form out to confirm if they do or do not have animals.

All dogs and cats must be registered with management. There is a monthly pet rent for each dog or cat in addition to your rent. Small animals kept in cages or tanks (birds, hamsters, fish, etc.) do not require registration and have no fee.

<strong>Prohibited animals:</strong> Ferrets, snakes longer than 3 feet, and any animal classified as dangerous under local law.

<strong>Deadline:</strong> March 12th, 2026.

<strong>⚠️ WARNING:</strong> Unregistered dogs or cats found after this date will be charged a <strong>$500 fine</strong> plus <strong>all back-owed pet rent starting from March 1st, 2026</strong>.`,
    
    petRentTableHeaders: ["Pet Type", "Weight", "Monthly Rent", "One-Time Fee"],
    
    insurancePolicyHeading: "RENTERS INSURANCE",
    insuranceWhyHeading: "Why Do I Need This?",
    insuranceWhyText: "Renters insurance protects your personal belongings and provides liability coverage if something unexpected happens—like your laptop being stolen, a fire/flood damaging your furniture, a guest getting injured on the property, or your pet biting someone.",
    insuranceCost: "Cost: $10-25 per month",
    insuranceDeadline: "<strong>Deadline:</strong> February 27th",
    insuranceOption1: "<strong>Option 1:</strong> Get Your Own Insurance",
    insuranceOption1Text: `Buy from any company (Lemonade, GEICO, your car insurance company, etc.)
Your policy must show:
• Your address
• At least $100,000 liability coverage ($300,000 if you have pets)
• Your building's LLC as "Additional Insured"`,
    insuranceOption2: "<strong>Option 2:</strong> We Do It For You",
    insuranceOption2Text: `Don't want to deal with it? We can sign you up through our partnership with Appfolio Renters Insurance.
• About $10-25 per month
• Added to your rent
• No extra bills`,
    insuranceLLCTableHeading: "Find your building's LLC for the Additional Insured field:",
    insuranceLLCTableHeaders: ["Your Address", "Additional Insured"],
    insuranceLLCAddress: "Additional Insured Address: 421 Park St, Hartford CT 06106",
    
    parkingPolicyHeading: "PARKING PERMITS & FEES",
    parkingIntro: `Parking is $50 per vehicle per month, added to your rent.
Each tenant is entitled to 1 parking space. To be fair to everyone, additional spaces will only become available after all tenants in your building have had the opportunity to claim their first space. After that, extra spaces are first-come, first-served.`,
    parkingStepsHeading: "To Get Your Parking Permit:",
    parkingStep1: "<strong>Step 1</strong> - Submit your vehicle information by February 18th",
    parkingStep1Text: "Fill out this form.",
    parkingStep2: "<strong>Step 2</strong> - Sign your parking agreement",
    parkingStep2Text: "On February 20th, we will email/text you a link to sign electronically. Or sign in person when you pick up your permit.",
    parkingStep3: "<strong>Step 3</strong> - Pick up your permit between March 9-13, 10 AM to 6:30 PM",
    parkingStep3Text: `Bring:
• ID
• Proof of renters insurance (or sign up at the office)
• Completed pet registration (if you have a dog or cat)`,
    parkingDeadlinesHeading: "<strong>DEADLINES:</strong>",
    parkingDeadlines: `• Submit vehicle info: February 18th
• Parking agreements sent: February 20th
• Permit pickup: March 9-13
• Permits required: March 19th, 2026`,
    parkingWarning: "Vehicles without a valid permit after March 19th, 2026 will be towed.",
    parkingDisplay: "The permit must be displayed on the upper driver's side of the windshield.",
    parkingFeeTableHeaders: ["Vehicle Type", "Monthly Fee"],

    towingHeading: "TOWING POLICY — PLEASE READ CAREFULLY",
    towingText: `Stanton Management does not own or operate the towing company. We have authorized an independent towing company to patrol our parking areas and enforce permit requirements. They are known to act quickly.

After <strong>March 19th, 2026</strong>, any vehicle without a valid permit properly displayed may be towed at the owner's expense — <strong>without prior notice</strong>.

<strong>If your vehicle is towed</strong>, you must contact the towing company directly to retrieve it and resolve any fees. Stanton Management cannot intervene, reverse a tow, or issue refunds on the towing company's behalf.

The best way to protect yourself is to get your permit on time and make sure it is always visible on the upper driver's side of your windshield.`,
  },
  
  es: {
    introHeading: "QUÉ ESTÁ CAMBIANDO:",
    introText: "Como ya sabe, Stanton Management ahora administra su edificio. Queremos presentarle algunos cambios y nuevos requisitos que quizás no fueron requeridos por el propietario/administrador anterior.",
    
    petPolicyHeading: "POLÍTICA DE MASCOTAS",
    petPolicyText: `Todos los inquilinos deben completar este formulario para confirmar si tienen o no animales.

Todos los perros y gatos deben registrarse con la administración. Hay un alquiler mensual por cada perro o gato además de su renta. Animales pequeños en jaulas o tanques (pájaros, hámsters, peces, etc.) no requieren registro y no tienen cargo.

Animales prohibidos: Hurones, serpientes de más de 3 pies, y cualquier animal clasificado como peligroso por la ley local.

Fecha límite: 12 de marzo de 2026.

<strong>⚠️ ADVERTENCIA:</strong> Perros o gatos no registrados encontrados después de esta fecha serán cobrados con una <strong>multa de $500</strong> más <strong>todo el alquiler de mascota atrasado desde el 1 de marzo de 2026</strong>.`,
    
    petRentTableHeaders: ["Tipo de Mascota", "Peso", "Alquiler Mensual", "Cargo Único"],
    
    insurancePolicyHeading: "SEGURO DE INQUILINO",
    insuranceWhyHeading: "¿Por Qué Lo Necesito?",
    insuranceWhyText: "El seguro de inquilino protege sus pertenencias personales y proporciona cobertura de responsabilidad si algo inesperado sucede—como el robo de su computadora, un incendio/inundación dañando sus muebles, un invitado lesionándose en la propiedad, o su mascota mordiendo a alguien.",
    insuranceCost: "Costo: $10-25 por mes",
    insuranceDeadline: "Fecha límite: 27 de febrero",
    insuranceOption1: "Opción 1: Obtenga Su Propio Seguro",
    insuranceOption1Text: `Compre de cualquier compañía (Lemonade, GEICO, su compañía de seguro de auto, etc.)
Su póliza debe mostrar:
• Su dirección
• Al menos $100,000 de cobertura de responsabilidad ($300,000 si tiene mascotas)
• El LLC de su edificio como "Asegurado Adicional"`,
    insuranceOption2: "Opción 2: Nosotros Lo Hacemos Por Usted",
    insuranceOption2Text: `¿No quiere lidiar con esto? Podemos inscribirlo a través de nuestra asociación con Appfolio Renters Insurance.
• Aproximadamente $10-25 por mes
• Agregado a su alquiler
• Sin facturas adicionales`,
    insuranceLLCTableHeading: "Encuentre el LLC de su edificio para el campo de Asegurado Adicional:",
    insuranceLLCTableHeaders: ["Su Dirección", "Asegurado Adicional"],
    insuranceLLCAddress: "Dirección del Asegurado Adicional: 421 Park St, Hartford CT 06106",
    
    parkingPolicyHeading: "PERMISOS Y TARIFAS DE ESTACIONAMIENTO",
    parkingIntro: `El estacionamiento cuesta $50 por vehículo por mes, agregado a su alquiler.
Cada inquilino tiene derecho a 1 espacio de estacionamiento. Para ser justos con todos, los espacios adicionales solo estarán disponibles después de que todos los inquilinos de su edificio hayan tenido la oportunidad de reclamar su primer espacio. Después de eso, los espacios adicionales se ofrecen por orden de llegada.`,
    parkingStepsHeading: "Para Obtener Su Permiso:",
    parkingStep1: "Paso 1 - Envíe la información de su vehículo antes del 18 de febrero",
    parkingStep1Text: "Complete este formulario.",
    parkingStep2: "Paso 2 - Firme su acuerdo de estacionamiento",
    parkingStep2Text: "El 20 de febrero, le enviaremos un enlace por correo/texto para firmar electrónicamente. O firme en persona cuando recoja su permiso.",
    parkingStep3: "Paso 3 - Recoja su permiso entre el 9-13 de marzo, 10 AM a 6:30 PM",
    parkingStep3Text: `Traiga:
• Identificación
• Prueba de seguro de inquilino (o inscríbase en la oficina)
• Registro de mascotas completado (si tiene perro o gato)`,
    parkingDeadlinesHeading: "FECHAS LÍMITE:",
    parkingDeadlines: `• Enviar info del vehículo: 18 de febrero
• Acuerdos enviados: 20 de febrero
• Recoger permiso: 9-13 de marzo
• Permisos requeridos: 19 de marzo de 2026`,
    parkingWarning: "Vehículos sin permiso válido después del 19 de marzo de 2026 serán remolcados.",
    parkingDisplay: "El permiso debe colocarse en la parte superior del lado del conductor del parabrisas.",
    parkingFeeTableHeaders: ["Tipo de Vehículo", "Tarifa Mensual"],

    towingHeading: "POLÍTICA DE GRÚA — LEA CON ATENCIÓN",
    towingText: `Stanton Management no es propietario ni opera la empresa de grúas. Hemos autorizado a una empresa de grúas independiente a patrullar nuestras áreas de estacionamiento y hacer cumplir los requisitos de permisos. Son conocidos por actuar rápidamente.

Después del <strong>19 de marzo de 2026</strong>, cualquier vehículo sin un permiso válido correctamente exhibido podrá ser remolcado a costo del propietario — <strong>sin aviso previo</strong>.

<strong>Si su vehículo es remolcado</strong>, debe comunicarse directamente con la empresa de grúas para recuperarlo y resolver cualquier cargo. Stanton Management no puede intervenir, revertir un remolque ni emitir reembolsos en nombre de la empresa de grúas.

La mejor manera de protegerse es obtener su permiso a tiempo y asegurarse de que siempre esté visible en la parte superior del lado del conductor del parabrisas.`,
  },
  
  pt: {
    introHeading: "O QUE ESTÁ MUDANDO:",
    introText: "Como você já sabe, a Stanton Management agora administra seu prédio. Queremos apresentar algumas mudanças e novos requisitos que talvez não fossem exigidos pelo proprietário/administrador anterior.",
    
    petPolicyHeading: "POLÍTICA DE ANIMAIS",
    petPolicyText: `Todos os inquilinos devem preencher este formulário para confirmar se têm ou não animais.

Todos os cães e gatos devem ser registrados com a administração. Há um aluguel mensal para cada cão ou gato além do seu aluguel. Animais pequenos em gaiolas ou tanques (pássaros, hamsters, peixes, etc.) não requerem registro e não têm taxa.

Animais proibidos: Furões, cobras com mais de 3 pés, e qualquer animal classificado como perigoso pela lei local.

Prazo: 12 de março de 2026.

<strong>⚠️ AVISO:</strong> Cães ou gatos não registrados encontrados após esta data serão cobrados com uma <strong>multa de $500</strong> mais <strong>todo o aluguel de animal atrasado a partir de 1 de março de 2026</strong>.`,
    
    petRentTableHeaders: ["Tipo de Animal", "Peso", "Aluguel Mensal", "Taxa Única"],
    
    insurancePolicyHeading: "SEGURO DE LOCATÁRIO",
    insuranceWhyHeading: "Por Que Preciso Disso?",
    insuranceWhyText: "O seguro de locatário protege seus pertences pessoais e fornece cobertura de responsabilidade se algo inesperado acontecer—como roubo do seu computador, incêndio/inundação danificando seus móveis, um convidado se machucando na propriedade, ou seu animal mordendo alguém.",
    insuranceCost: "Custo: $10-25 por mês",
    insuranceDeadline: "Prazo: 27 de fevereiro",
    insuranceOption1: "Opção 1: Obtenha Seu Próprio Seguro",
    insuranceOption1Text: `Compre de qualquer empresa (Lemonade, GEICO, sua seguradora de carro, etc.)
Sua apólice deve mostrar:
• Seu endereço
• Pelo menos $100,000 de cobertura de responsabilidade ($300,000 se tiver animais)
• A LLC do seu prédio como "Segurado Adicional"`,
    insuranceOption2: "Opção 2: Nós Fazemos Por Você",
    insuranceOption2Text: `Não quer lidar com isso? Podemos inscrevê-lo através da nossa parceria com Appfolio Renters Insurance.
• Aproximadamente $10-25 por mês
• Adicionado ao seu aluguel
• Sem contas extras`,
    insuranceLLCTableHeading: "Encontre a LLC do seu prédio para o campo de Segurado Adicional:",
    insuranceLLCTableHeaders: ["Seu Endereço", "Segurado Adicional"],
    insuranceLLCAddress: "Endereço do Segurado Adicional: 421 Park St, Hartford CT 06106",
    
    parkingPolicyHeading: "AUTORIZAÇÕES E TAXAS DE ESTACIONAMENTO",
    parkingIntro: `O estacionamento custa $50 por veículo por mês, adicionado ao seu aluguel.
Cada inquilino tem direito a 1 vaga de estacionamento. Para ser justo com todos, vagas adicionais só estarão disponíveis após todos os inquilinos do seu prédio terem tido a oportunidade de reivindicar sua primeira vaga. Depois disso, as vagas extras são por ordem de chegada.`,
    parkingStepsHeading: "Para Obter Sua Autorização:",
    parkingStep1: "Passo 1 - Envie as informações do veículo até 18 de fevereiro",
    parkingStep1Text: "Preencha este formulário.",
    parkingStep2: "Passo 2 - Assine seu contrato de estacionamento",
    parkingStep2Text: "Em 20 de fevereiro, enviaremos um link por email/texto para assinar eletronicamente. Ou assine pessoalmente ao retirar sua autorização.",
    parkingStep3: "Passo 3 - Retire sua autorização entre 9-13 de março, 10h às 18h30",
    parkingStep3Text: `Traga:
• Identificação
• Comprovante de seguro de locatário (ou inscreva-se no escritório)
• Registro de animais completo (se tiver cão ou gato)`,
    parkingDeadlinesHeading: "PRAZOS:",
    parkingDeadlines: `• Enviar info do veículo: 18 de fevereiro
• Contratos enviados: 20 de fevereiro
• Retirar autorização: 9-13 de março
• Autorizações obrigatórias: 19 de março de 2026`,
    parkingWarning: "Veículos sem autorização válida após 19 de março de 2026 serão rebocados.",
    parkingDisplay: "A autorização deve ser colocada na parte superior do lado do motorista do para-brisa.",
    parkingFeeTableHeaders: ["Tipo de Veículo", "Taxa Mensal"],

    towingHeading: "POLÍTICA DE REBOQUE — LEIA COM ATENÇÃO",
    towingText: `A Stanton Management não é proprietária nem opera a empresa de reboque. Autorizamos uma empresa de reboque independente a patrulhar nossas áreas de estacionamento e fiscalizar os requisitos de autorização. Eles são conhecidos por agir rapidamente.

Após <strong>19 de março de 2026</strong>, qualquer veículo sem uma autorização válida devidamente exibida poderá ser rebocado por conta do proprietário — <strong>sem aviso prévio</strong>.

<strong>Se o seu veículo for rebocado</strong>, você deve entrar em contato diretamente com a empresa de reboque para recuperá-lo e resolver quaisquer taxas. A Stanton Management não pode intervir, reverter um reboque ou emitir reembolsos em nome da empresa de reboque.

A melhor maneira de se proteger é obter sua autorização a tempo e garantir que esteja sempre visível na parte superior do lado do motorista do para-brisa.`,
  },
};

// Pet rent table data (same for all languages)
export const petRentTable = [
  ["Cat", "N/A", "$25", "$150"],
  ["Small Dog", "Under 25 lbs", "$25", "$200"],
  ["Medium Dog", "25-50 lbs", "$35", "$250"],
  ["Large Dog", "50+ lbs", "$45", "$300"],
];

// LLC table data (English only - proper nouns)
export const llcTable = [
  ["90 Park Street", "Stanton Rep 90 Park Street Hartford LLC c/o Stanton Management LLC"],
  ["31-33 Park St", "SREP Park 1 LLC c/o Stanton Management LLC"],
  ["57 Park St", "SREP Park 4 LLC c/o Stanton Management LLC"],
  ["67-73 Park St", "SREP Park 2 LLC c/o Stanton Management LLC"],
  ["83-91 Park St", "SREP Park 3 LLC c/o Stanton Management LLC"],
  ["10 Wolcott St", "SREP Park 5 LLC c/o Stanton Management LLC"],
  ["179 Affleck St", "SREP Park 6 LLC c/o Stanton Management LLC"],
  ["144-146, 178, 182, 190 Affleck St", "SREP Park 7 LLC c/o Stanton Management LLC"],
  ["195 Affleck St", "SREP Park 8 LLC c/o Stanton Management LLC"],
  ["88-90 Ward St, 865 Broad St", "SREP Park 9 LLC c/o Stanton Management LLC"],
  ["142, 158, 164, 167, 169, 170, 180 Seymour St", "SREP Park 10 LLC c/o Stanton Management LLC"],
  ["213-217 Buckingham St", "SREP Park 11 LLC c/o Stanton Management LLC"],
  ["23-31 Squire St", "SREP Park 12 LLC c/o Stanton Management LLC"],
  ["97-103 Maple Ave", "SREP Southend 1 LLC c/o Stanton Management LLC"],
  ["222-224 Maple Ave, 43-45 Franklin Ave", "SREP Southend 2 LLC c/o Stanton Management LLC"],
  ["47 Franklin Ave, 15-17/36/38-40 Whitmore St", "SREP Southend 3 LLC c/o Stanton Management LLC"],
  ["236 Maple Ave", "SREP Southend LLC c/o Stanton Management LLC"],
  ["228 Maple Ave, 93-95 Maple Ave", "SREP Hartford 1 LLC c/o Stanton Management LLC"],
  ["110/120 Martin, 152-154/160 Wooster, 165 Westland, 1721-1739 Main, 69-73 Chestnut, 91 Edwards", "SREP Northend LLC c/o Stanton Management LLC"],
];

// Parking fee table data (same for all languages)
export const parkingFeeTable = [
  ["Moped, motorcycle, ATV, scooter", "$20"],
  ["Sedan, SUV, Pickup (under 20 ft)", "$50"],
  ["Oversized vehicles (over 20 ft)", "$60"],
  ["Boats, trailers, equipment", "$60+ (approval required)"],
];
