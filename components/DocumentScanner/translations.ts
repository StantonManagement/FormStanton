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
  },
};
