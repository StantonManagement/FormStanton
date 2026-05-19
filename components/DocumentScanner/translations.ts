export type ScannerLanguage = 'en' | 'es' | 'pt';

export interface ScannerStrings {
  takePhoto: string;
  chooseFile: string;
  retake: string;
  useThis: string;
  useThisPage: string;
  addPage: string;
  submit: string;
  cancel: string;
  blurryWarning: string;
  darkWarning: string;
  lowResWarning: string;
  useAnyway: string;
  processing: string;
  uploading: string;
  pageCount: (n: number) => string;
  instructionsTitle: string;
  previewTitle: string;
  pagesCaptured: string;
  deletePage: string;
  scannerError: string;
  captureError: string;
  uploadError: string;
  // Live preview scanner (PRD-45)
  scanDocumentBtn: string;
  secondaryTakePhoto: string;
  secondaryChooseFile: string;
  permissionPromptTitle: string;
  permissionPromptBody: string;
  permissionAllow: string;
  permissionDenied: string;
  permissionNoCamera: string;
  captureNow: string;
  holdSteady: string;
  noDocumentDetected: string;
  lowLightWarning: string;
  firstScanTooltip: string;
  // F4 — Entry-stage capture guidance (PRD-46)
  inlineTip: string;
  howToTitle: string;
  howToIntro: string;
  howToBullet1: string;
  howToBullet2: string;
  howToBullet3: string;
  howToBullet4: string;
}

export const translations: Record<ScannerLanguage, ScannerStrings> = {
  en: {
    takePhoto: 'Take Photo',
    chooseFile: 'Choose File Instead',
    retake: 'Retake',
    useThis: 'Use This',
    useThisPage: 'Use This Page',
    addPage: 'Add Another Page',
    submit: 'Submit',
    cancel: 'Cancel',
    blurryWarning: 'This photo looks blurry. Documents may be hard to read.',
    darkWarning: 'This photo is too dark. Try better lighting.',
    lowResWarning: 'This image is too small. Move closer to the document.',
    useAnyway: 'Use anyway',
    processing: 'Processing...',
    uploading: 'Uploading...',
    pageCount: (n) => `Page ${n}`,
    instructionsTitle: 'Document Scan',
    previewTitle: 'Preview',
    pagesCaptured: 'Pages captured',
    deletePage: 'Delete page',
    scannerError: 'Scanner unavailable. Using original image.',
    captureError: 'Unable to process file. Try another image.',
    uploadError: 'Upload failed. Please try again.',
    // Live preview scanner (PRD-45)
    scanDocumentBtn: 'Scan document',
    secondaryTakePhoto: 'Take photo',
    secondaryChooseFile: 'Choose file',
    permissionPromptTitle: 'Use your camera?',
    permissionPromptBody: "We'll use your camera to scan this document. The image stays on your phone until you tap Submit.",
    permissionAllow: 'Allow camera',
    permissionDenied: 'Camera access blocked. Using photo upload instead. To enable the scanner, allow camera in browser settings.',
    permissionNoCamera: 'No camera detected. Using photo upload instead.',
    captureNow: 'Capture now',
    holdSteady: 'Hold steady',
    noDocumentDetected: 'Position the document in the frame',
    lowLightWarning: "It's dark — try moving to better light",
    firstScanTooltip: "Hold the document flat in the frame. We'll capture automatically when steady.",
    inlineTip: 'Hold the document flat. All four corners in the frame. Good light.',
    howToTitle: 'How to take a good photo',
    howToIntro: 'A few quick tips help us approve your document on the first try.',
    howToBullet1: 'Lay the document on a flat, dark surface. A table works well.',
    howToBullet2: "Stand directly above it. Don't take the photo at an angle.",
    howToBullet3: 'Make sure the whole document is in the frame — all four corners.',
    howToBullet4: 'Good light. Avoid shadows from your hand or phone.',
  },
  es: {
    takePhoto: 'Tomar Foto',
    chooseFile: 'Elegir Archivo',
    retake: 'Volver a tomar',
    useThis: 'Usar Esta',
    useThisPage: 'Usar Esta Página',
    addPage: 'Agregar Otra Página',
    submit: 'Enviar',
    cancel: 'Cancelar',
    blurryWarning: 'Esta foto se ve borrosa. El documento puede ser difícil de leer.',
    darkWarning: 'Esta foto está muy oscura. Intente con mejor iluminación.',
    lowResWarning: 'Esta imagen es muy pequeña. Acerque más el documento.',
    useAnyway: 'Usar de todos modos',
    processing: 'Procesando...',
    uploading: 'Subiendo...',
    pageCount: (n) => `Página ${n}`,
    instructionsTitle: 'Escaneo de Documento',
    previewTitle: 'Vista previa',
    pagesCaptured: 'Páginas capturadas',
    deletePage: 'Eliminar página',
    scannerError: 'Escáner no disponible. Se usará la imagen original.',
    captureError: 'No se pudo procesar el archivo. Intente con otra imagen.',
    uploadError: 'No se pudo subir. Inténtelo nuevamente.',
    // Live preview scanner (PRD-45)
    scanDocumentBtn: 'Escanear documento',
    secondaryTakePhoto: 'Tomar foto',
    secondaryChooseFile: 'Elegir archivo',
    permissionPromptTitle: '¿Usar tu cámara?',
    permissionPromptBody: 'Usaremos tu cámara para escanear este documento. La imagen permanece en tu teléfono hasta que toques Enviar.',
    permissionAllow: 'Permitir cámara',
    permissionDenied: 'Acceso a la cámara bloqueado. Usando subida de foto en su lugar. Para habilitar el escáner, permite la cámara en la configuración del navegador.',
    permissionNoCamera: 'No se detectó cámara. Usando subida de foto en su lugar.',
    captureNow: 'Capturar ahora',
    holdSteady: 'Mantener firme',
    noDocumentDetected: 'Coloca el documento en el marco',
    lowLightWarning: 'Está oscuro — intenta mejor luz',
    firstScanTooltip: 'Mantén el documento plano en el marco. Capturaremos automáticamente cuando esté estable.',
    inlineTip: 'Mantén el documento plano. Las cuatro esquinas en el marco. Buena luz.',
    howToTitle: 'Cómo tomar una buena foto',
    howToIntro: 'Algunos consejos rápidos para aprobar tu documento la primera vez.',
    howToBullet1: 'Coloca el documento sobre una superficie plana y oscura. Una mesa funciona bien.',
    howToBullet2: 'Párate directamente encima. No tomes la foto en ángulo.',
    howToBullet3: 'Asegúrate de que todo el documento esté en el marco — las cuatro esquinas.',
    howToBullet4: 'Buena luz. Evita sombras de tu mano o teléfono.',
  },
  pt: {
    takePhoto: 'Tirar Foto',
    chooseFile: 'Escolher Arquivo',
    retake: 'Refazer',
    useThis: 'Usar Esta',
    useThisPage: 'Usar Esta Página',
    addPage: 'Adicionar Outra Página',
    submit: 'Enviar',
    cancel: 'Cancelar',
    blurryWarning: 'Esta foto parece borrada. O documento pode ficar difícil de ler.',
    darkWarning: 'Esta foto está escura. Tente com melhor iluminação.',
    lowResWarning: 'Esta imagem é pequena demais. Aproxime o documento.',
    useAnyway: 'Usar mesmo assim',
    processing: 'Processando...',
    uploading: 'Enviando...',
    pageCount: (n) => `Página ${n}`,
    instructionsTitle: 'Digitalização de Documento',
    previewTitle: 'Pré-visualização',
    pagesCaptured: 'Páginas capturadas',
    deletePage: 'Excluir página',
    scannerError: 'Scanner indisponível. Usando imagem original.',
    captureError: 'Não foi possível processar o arquivo. Tente outra imagem.',
    uploadError: 'Falha no envio. Tente novamente.',
    // Live preview scanner (PRD-45)
    scanDocumentBtn: 'Digitalizar documento',
    secondaryTakePhoto: 'Tirar foto',
    secondaryChooseFile: 'Escolher arquivo',
    permissionPromptTitle: 'Usar sua câmera?',
    permissionPromptBody: 'Usaremos sua câmera para digitalizar este documento. A imagem fica no seu telefone até você tocar em Enviar.',
    permissionAllow: 'Permitir câmera',
    permissionDenied: 'Acesso à câmera bloqueado. Usando upload de foto em vez disso. Para habilitar o scanner, permita a câmera nas configurações do navegador.',
    permissionNoCamera: 'Nenhuma câmera detectada. Usando upload de foto em vez disso.',
    captureNow: 'Capturar agora',
    holdSteady: 'Manter firme',
    noDocumentDetected: 'Posicione o documento no quadro',
    lowLightWarning: 'Está escuro — tente melhor luz',
    firstScanTooltip: 'Mantenha o documento plano no quadro. Capturaremos automaticamente quando estiver estável.',
    inlineTip: 'Mantenha o documento plano. Os quatro cantos no quadro. Boa iluminação.',
    howToTitle: 'Como tirar uma boa foto',
    howToIntro: 'Algumas dicas rápidas para aprovarmos seu documento na primeira vez.',
    howToBullet1: 'Coloque o documento sobre uma superfície plana e escura. Uma mesa funciona bem.',
    howToBullet2: 'Fique diretamente acima. Não tire a foto em ângulo.',
    howToBullet3: 'Certifique-se de que todo o documento esteja no quadro — os quatro cantos.',
    howToBullet4: 'Boa luz. Evite sombras da sua mão ou telefone.',
  },
};
