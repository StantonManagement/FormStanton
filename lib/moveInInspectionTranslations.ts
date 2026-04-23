import { Language } from './translations';

export const moveInInspectionTranslations: Record<Language, Record<string, string>> = {
  en: {
    formTitle: 'Move-In Inspection Form',
    formIntro: 'Walk through your unit together with your management representative and document the condition of each area below. Both parties will sign at the end of this inspection.',

    // Tenant Info
    tenantInfoTitle: 'Tenant Information',
    tenantName: 'Tenant Name(s)',
    tenantNamePlaceholder: 'Enter all tenant names',
    tenantEmail: 'Email Address',
    tenantEmailPlaceholder: 'tenant@email.com',
    building: 'Property Address',
    unit: 'Apartment No.',
    unitSize: 'Unit Size',
    unitSizePlaceholder: 'e.g. 1BR, 2BR, Studio',
    moveInDate: 'Move-In Date',
    keysReceived: 'Keys Received',
    unitKeys: 'Unit Keys',
    mailboxKeys: 'Mailbox Keys',
    fobs: 'Fobs',

    // Instructions
    instructionsTitle: 'Inspection',
    instructionsText: 'Walk through your entire unit and record the condition of each item. Add rows as needed. Use the condition dropdown — selections are recorded exactly as chosen.',
    photoNote: 'Take photos of any damage before completing this inspection. Photos will be submitted along with this form.',

    // Condition Dropdown
    conditionPlaceholder: '— Select —',
    conditionGood: 'Good',
    conditionDamage: 'Damage Present',
    conditionImmediateRepair: 'Immediate Repair Required',
    conditionMissing: 'Missing',
    conditionNA: 'N/A',

    // Room Sections
    entranceHallsTitle: 'ENTRANCE / HALLS',
    bedroomTitle: 'BEDROOM(S)',
    kitchenTitle: 'KITCHEN',
    livingRoomTitle: 'LIVING ROOM',
    bathroomTitle: 'BATHROOM(S)',
    otherAreasTitle: 'OTHER',

    // Table columns & row actions
    itemColumn: 'Item',
    condition: 'Condition',
    notes: 'Notes / Description',
    itemPlaceholder: 'e.g. Entry Door, Walls...',
    notesPlaceholder: 'Describe condition...',
    addItem: '+ Add Item',
    removeItem: 'Remove',

    // Photos
    photosTitle: 'Photos',
    photosIntro: 'Upload photos of any damage or issues noted above (max 20 photos).',
    uploadPhotos: 'Upload Photos',
    uploadHelper: 'JPG, PNG up to 5MB - Max 20 photos',

    // Review
    reviewTitle: 'Review & Sign',
    reviewSummary: 'Please review your move-in inspection before signing.',
    reviewTenantInfo: 'Tenant Information',
    reviewInspection: 'Inspection Summary',
    reviewPhotos: 'Photos',
    noPhotos: 'No photos uploaded',
    itemsInspected: 'items recorded',
    issuesNoted: 'issues noted',

    // Legal / Signatures
    managerAckTitle: 'Management Acknowledgment',
    managerAckText: 'This unit is in decent, safe and sanitary condition. Management will make best efforts to address any deficiencies identified in this report in a timely manner.',
    tenantAckTitle: 'Tenant Acknowledgment',
    tenantAckText: 'I have walked through this apartment with a management representative and agree that the conditions documented above are accurate as of today. I understand that I may report any additional issues noticed after move-in by contacting the management office in writing within 48 hours. After that period, I acknowledge that I am accepting the unit in the condition documented here, and I agree to be responsible for maintaining it, aside from normal wear and tear.',
    signature: 'Resident Signature',
    signatureDate: 'Date',
    signatureRequired: 'Signature is required',
    finalConfirm: 'I confirm that this inspection accurately represents the condition of the unit at move-in.',

    // Navigation
    continue: 'Continue',
    submit: 'Submit Inspection',
    submitting: 'Submitting...',
    required: 'Required',
    optional: '(Optional)',
    requiredFieldsMissing: 'Please complete all required fields before continuing',

    // Draft
    draftFound: 'You have an unfinished inspection. Would you like to resume where you left off?',
    resumeDraft: 'Resume',
    startFresh: 'Start Fresh',

    // Success
    successTitle: 'Inspection Submitted!',
    successMessage: 'Your move-in inspection has been submitted successfully. This documentation will protect your security deposit. Keep a copy for your records.',

    // Tabs
    tabTenantInfo: 'Tenant Info',
    tabInspection: 'Inspection',
    tabPhotos: 'Photos',
    tabReview: 'Review & Sign',

    // Mode picker
    modePickerLabel: 'Staff',
    modeJoint: 'Joint Inspection',
    modeManagerOnly: 'Manager Only',
    modeBadgeJoint: 'Joint Inspection',
    modeBadgeManager: 'Manager Only',

    // Mode-specific intros
    formIntroTenant: 'Document the condition of your unit at move-in. Note any issues below and submit within 48 hours of receiving your keys.',
    formIntroJoint: 'Walk through your unit together with your management representative and document the condition of each area below. Both parties will sign at the end of this inspection.',
    formIntroManager: 'Management is completing this inspection in preparation for unit handover. Tenant will acknowledge at key collection.',

    // Pending signatures
    managerAckPending: 'Management acknowledgment will be completed at the time of key handover.',
    tenantSigPending: 'Tenant to sign at the time of key handover.',

    // Additional photos
    additionalPhotosTitle: 'Additional Photos',
    additionalPhotosIntro: 'Add any further photos not captured per-item above. Photos will be submitted with this form.',
    rowPhotosLabel: 'row photo(s) attached',

    // Select prompts
    selectBuilding: '-- Select your building --',
    enterUnit: 'Enter your apartment number',
  },
  es: {
    formTitle: 'Formulario de Inspeccion de Mudanza',
    formIntro: 'Recorra su unidad junto con su representante de administracion y documente la condicion de cada area a continuacion. Ambas partes firmaran al final de esta inspeccion.',

    tenantInfoTitle: 'Informacion del Inquilino',
    tenantName: 'Nombre(s) del Inquilino',
    tenantNamePlaceholder: 'Ingrese todos los nombres de inquilinos',
    tenantEmail: 'Correo Electronico',
    tenantEmailPlaceholder: 'inquilino@correo.com',
    building: 'Direccion de la Propiedad',
    unit: 'No. de Apartamento',
    unitSize: 'Tamano de la Unidad',
    unitSizePlaceholder: 'ej. 1 hab., 2 hab., Estudio',
    moveInDate: 'Fecha de Mudanza',
    keysReceived: 'Llaves Recibidas',
    unitKeys: 'Llaves de Unidad',
    mailboxKeys: 'Llaves de Buzon',
    fobs: 'Llaveros',

    instructionsTitle: 'Inspeccion',
    instructionsText: 'Recorra toda su unidad y registre la condicion de cada articulo. Agregue filas segun sea necesario.',
    photoNote: 'Tome fotos de cualquier dano antes de completar esta inspeccion. Las fotos se enviaran junto con este formulario.',

    conditionPlaceholder: '— Seleccionar —',
    conditionGood: 'Bueno',
    conditionDamage: 'Dano Presente',
    conditionImmediateRepair: 'Reparacion Inmediata Requerida',
    conditionMissing: 'Faltante',
    conditionNA: 'N/A',

    entranceHallsTitle: 'ENTRADA / PASILLOS',
    bedroomTitle: 'DORMITORIO(S)',
    kitchenTitle: 'COCINA',
    livingRoomTitle: 'SALA',
    bathroomTitle: 'BANO(S)',
    otherAreasTitle: 'OTROS',

    itemColumn: 'Articulo',
    condition: 'Condicion',
    notes: 'Notas / Descripcion',
    itemPlaceholder: 'ej. Puerta de entrada, Paredes...',
    notesPlaceholder: 'Describa la condicion...',
    addItem: '+ Agregar Articulo',
    removeItem: 'Eliminar',

    photosTitle: 'Fotos',
    photosIntro: 'Suba fotos de cualquier dano o problema anotado arriba (maximo 20 fotos).',
    uploadPhotos: 'Subir Fotos',
    uploadHelper: 'JPG, PNG hasta 5MB - Maximo 20 fotos',

    reviewTitle: 'Revisar y Firmar',
    reviewSummary: 'Revise su inspeccion de mudanza antes de firmar.',
    reviewTenantInfo: 'Informacion del Inquilino',
    reviewInspection: 'Resumen de Inspeccion',
    reviewPhotos: 'Fotos',
    noPhotos: 'No se subieron fotos',
    itemsInspected: 'articulos registrados',
    issuesNoted: 'problemas anotados',

    managerAckTitle: 'Reconocimiento de Administracion',
    managerAckText: 'Esta unidad se encuentra en condiciones decentes, seguras y sanitarias. La administracion hara su mejor esfuerzo para atender cualquier deficiencia identificada en este informe de manera oportuna.',
    tenantAckTitle: 'Reconocimiento del Inquilino',
    tenantAckText: 'He recorrido este apartamento junto con un representante de administracion y confirmo que las condiciones documentadas arriba son precisas a la fecha de hoy. Entiendo que puedo reportar cualquier problema adicional notado despues de la mudanza dentro de las 48 horas contactando a la administracion por escrito. Pasado ese plazo, acepto la unidad en la condicion aqui documentada y me comprometo a mantenerla, salvo el desgaste normal.',
    signature: 'Firma del Residente',
    signatureDate: 'Fecha',
    signatureRequired: 'Se requiere firma',
    finalConfirm: 'Confirmo que esta inspeccion representa con precision la condicion de la unidad al mudarse.',

    continue: 'Continuar',
    submit: 'Enviar Inspeccion',
    submitting: 'Enviando...',
    required: 'Requerido',
    optional: '(Opcional)',
    requiredFieldsMissing: 'Complete todos los campos requeridos antes de continuar',

    draftFound: 'Tiene una inspeccion sin terminar. Desea continuar donde lo dejo?',
    resumeDraft: 'Continuar',
    startFresh: 'Empezar de nuevo',

    successTitle: 'Inspeccion Enviada!',
    successMessage: 'Su inspeccion de mudanza ha sido enviada exitosamente. Esta documentacion protegera su deposito de seguridad. Guarde una copia para sus registros.',

    tabTenantInfo: 'Informacion',
    tabInspection: 'Inspeccion',
    tabPhotos: 'Fotos',
    tabReview: 'Revisar',

    modePickerLabel: 'Personal',
    modeJoint: 'Inspeccion Conjunta',
    modeManagerOnly: 'Solo Administrador',
    modeBadgeJoint: 'Inspeccion Conjunta',
    modeBadgeManager: 'Solo Administrador',

    formIntroTenant: 'Documente la condicion de su unidad al mudarse. Anote cualquier problema a continuacion y envie el formulario dentro de las 48 horas de recibir sus llaves.',
    formIntroJoint: 'Recorra su unidad junto con su representante de administracion y documente la condicion de cada area a continuacion. Ambas partes firmaran al final de esta inspeccion.',
    formIntroManager: 'La administracion esta completando esta inspeccion en preparacion para la entrega de la unidad. El inquilino firmara al recibir las llaves.',

    managerAckPending: 'El reconocimiento de la administracion se completara en el momento de la entrega de llaves.',
    tenantSigPending: 'El inquilino firmara en el momento de la entrega de llaves.',

    additionalPhotosTitle: 'Fotos Adicionales',
    additionalPhotosIntro: 'Agregue cualquier foto adicional no capturada por articulo arriba. Las fotos se enviaran con este formulario.',
    rowPhotosLabel: 'foto(s) de fila adjuntas',

    selectBuilding: '-- Seleccione su edificio --',
    enterUnit: 'Ingrese el numero de su apartamento',
  },
  pt: {
    formTitle: 'Formulario de Inspecao de Mudanca',
    formIntro: 'Percorra sua unidade junto com seu representante de administracao e documente a condicao de cada area abaixo. Ambas as partes assinarao ao final desta inspecao.',

    tenantInfoTitle: 'Informacoes do Inquilino',
    tenantName: 'Nome(s) do Inquilino',
    tenantNamePlaceholder: 'Digite todos os nomes dos inquilinos',
    tenantEmail: 'Endereco de E-mail',
    tenantEmailPlaceholder: 'inquilino@email.com',
    building: 'Endereco da Propriedade',
    unit: 'No. do Apartamento',
    unitSize: 'Tamanho da Unidade',
    unitSizePlaceholder: 'ex. 1 quarto, 2 quartos, Studio',
    moveInDate: 'Data de Mudanca',
    keysReceived: 'Chaves Recebidas',
    unitKeys: 'Chaves da Unidade',
    mailboxKeys: 'Chaves da Caixa de Correio',
    fobs: 'Chaveiros',

    instructionsTitle: 'Inspecao',
    instructionsText: 'Percorra toda a sua unidade e registre a condicao de cada item. Adicione linhas conforme necessario.',
    photoNote: 'Tire fotos de qualquer dano antes de concluir esta inspecao. As fotos serao enviadas junto com este formulario.',

    conditionPlaceholder: '— Selecionar —',
    conditionGood: 'Bom',
    conditionDamage: 'Dano Presente',
    conditionImmediateRepair: 'Reparo Imediato Necessario',
    conditionMissing: 'Faltando',
    conditionNA: 'N/A',

    entranceHallsTitle: 'ENTRADA / CORREDORES',
    bedroomTitle: 'QUARTO(S)',
    kitchenTitle: 'COZINHA',
    livingRoomTitle: 'SALA',
    bathroomTitle: 'BANHEIRO(S)',
    otherAreasTitle: 'OUTROS',

    itemColumn: 'Item',
    condition: 'Condicao',
    notes: 'Notas / Descricao',
    itemPlaceholder: 'ex. Porta de entrada, Paredes...',
    notesPlaceholder: 'Descreva a condicao...',
    addItem: '+ Adicionar Item',
    removeItem: 'Remover',

    photosTitle: 'Fotos',
    photosIntro: 'Carregue fotos de qualquer dano ou problema anotado acima (maximo 20 fotos).',
    uploadPhotos: 'Carregar Fotos',
    uploadHelper: 'JPG, PNG ate 5MB - Maximo 20 fotos',

    reviewTitle: 'Revisar e Assinar',
    reviewSummary: 'Revise sua inspecao de mudanca antes de assinar.',
    reviewTenantInfo: 'Informacoes do Inquilino',
    reviewInspection: 'Resumo da Inspecao',
    reviewPhotos: 'Fotos',
    noPhotos: 'Nenhuma foto carregada',
    itemsInspected: 'itens registrados',
    issuesNoted: 'problemas anotados',

    managerAckTitle: 'Reconhecimento da Administracao',
    managerAckText: 'Esta unidade esta em condicoes decentes, seguras e sanitarias. A administracao envidara seus melhores esforcos para resolver quaisquer deficiencias identificadas neste relatorio em tempo habil.',
    tenantAckTitle: 'Reconhecimento do Inquilino',
    tenantAckText: 'Percorri este apartamento junto com um representante da administracao e confirmo que as condicoes documentadas acima sao precisas na data de hoje. Entendo que posso relatar quaisquer problemas adicionais notados apos a mudanca dentro de 48 horas, entrando em contato com a administracao por escrito. Apos esse prazo, aceito a unidade na condicao aqui documentada e concordo em mante-la, exceto pelo desgaste normal.',
    signature: 'Assinatura do Residente',
    signatureDate: 'Data',
    signatureRequired: 'Assinatura e obrigatoria',
    finalConfirm: 'Confirmo que esta inspecao representa com precisao a condicao da unidade na mudanca.',

    continue: 'Continuar',
    submit: 'Enviar Inspecao',
    submitting: 'Enviando...',
    required: 'Obrigatorio',
    optional: '(Opcional)',
    requiredFieldsMissing: 'Preencha todos os campos obrigatorios antes de continuar',

    draftFound: 'Voce tem uma inspecao nao concluida. Deseja continuar de onde parou?',
    resumeDraft: 'Continuar',
    startFresh: 'Comecar do zero',

    successTitle: 'Inspecao Enviada!',
    successMessage: 'Sua inspecao de mudanca foi enviada com sucesso. Esta documentacao protegera seu deposito de seguranca. Guarde uma copia para seus registros.',

    tabTenantInfo: 'Informacoes',
    tabInspection: 'Inspecao',
    tabPhotos: 'Fotos',
    tabReview: 'Revisar',

    modePickerLabel: 'Equipe',
    modeJoint: 'Inspecao Conjunta',
    modeManagerOnly: 'Somente Administracao',
    modeBadgeJoint: 'Inspecao Conjunta',
    modeBadgeManager: 'Somente Administracao',

    formIntroTenant: 'Documente a condicao de sua unidade na mudanca. Anote quaisquer problemas abaixo e envie o formulario dentro de 48 horas apos receber suas chaves.',
    formIntroJoint: 'Percorra sua unidade junto com seu representante de administracao e documente a condicao de cada area abaixo. Ambas as partes assinarao ao final desta inspecao.',
    formIntroManager: 'A administracao esta concluindo esta inspecao em preparacao para a entrega da unidade. O inquilino assinar a no recebimento das chaves.',

    managerAckPending: 'O reconhecimento da administracao sera concluido no momento da entrega das chaves.',
    tenantSigPending: 'O inquilino assinara no momento da entrega das chaves.',

    additionalPhotosTitle: 'Fotos Adicionais',
    additionalPhotosIntro: 'Adicione fotos nao capturadas por item acima. As fotos serao enviadas com este formulario.',
    rowPhotosLabel: 'foto(s) de linha anexadas',

    selectBuilding: '-- Selecione seu predio --',
    enterUnit: 'Digite o numero do seu apartamento',
  },
};
