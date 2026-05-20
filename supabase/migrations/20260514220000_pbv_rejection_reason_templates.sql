-- PBV Rejection Reason Templates
-- Hybrid template + free-text system for localized rejection reasons
-- Depends on: 20260423220000_pbv_full_app_document_templates.sql (doc_type values)

-- Template table: key-based lookup with per-language columns
CREATE TABLE IF NOT EXISTS public.pbv_rejection_reason_templates (
  key TEXT PRIMARY KEY,
  doc_type TEXT NULL,                    -- NULL = generic, otherwise matches form_document_templates.doc_type
  reason_en TEXT NOT NULL,
  reason_es TEXT NOT NULL,
  reason_pt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pbv_rejection_reason_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read templates (for admin UI dropdown)
CREATE POLICY "Allow authenticated read access" ON public.pbv_rejection_reason_templates
  FOR SELECT TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON public.pbv_rejection_reason_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.pbv_rejection_reason_templates;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.pbv_rejection_reason_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- GENERIC TEMPLATES (doc_type = NULL)
-- Apply to all document types
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('generic:illegible', NULL,
    'The document is too blurry or hard to read. Please upload a clearer photo or scan.',
    'El documento está borroso o es difícil de leer. Por favor suba una foto o escaneo más claro.',
    'O documento está embaçado ou difícil de ler. Por favor envie uma foto ou digitalização mais nítida.'),

  ('generic:expired', NULL,
    'This document is expired. Please upload a current version.',
    'Este documento está vencido. Por favor suba una versión actual.',
    'Este documento está expirado. Por favor envie uma versão atualizada.'),

  ('generic:wrong_person', NULL,
    'This document appears to be for the wrong person. Please upload a document for the correct household member.',
    'Este documento parece ser para la persona incorrecta. Por favor suba un documento para el miembro correcto del hogar.',
    'Este documento parece ser para a pessoa errada. Por favor envie um documento para o membro correto do domicílio.'),

  ('generic:missing_pages', NULL,
    'Some pages are missing from this document. Please upload all pages.',
    'Faltan algunas páginas de este documento. Por favor suba todas las páginas.',
    'Algumas páginas estão faltando neste documento. Por favor envie todas as páginas.'),

  ('generic:watermark_obscured', NULL,
    'The watermark or security features are not visible. Please upload an original or clearer copy.',
    'La marca de agua o las características de seguridad no son visibles. Por favor suba una copia original o más clara.',
    'A marca d''água ou recursos de segurança não estão visíveis. Por favor envie uma cópia original ou mais nítida.'),

  ('generic:wrong_date_range', NULL,
    'The dates on this document are not in the required range. Please check the instructions and upload the correct period.',
    'Las fechas en este documento no están en el rango requerido. Por favor revise las instrucciones y suba el período correcto.',
    'As datas neste documento não estão no intervalo necessário. Por favor verifique as instruções e envie o período correto.'),

  ('generic:partial_scan', NULL,
    'Part of the document is cut off or not visible. Please ensure the entire document is visible in the upload.',
    'Parte del documento está cortado o no es visible. Por favor asegúrese de que el documento completo sea visible en la carga.',
    'Parte do documento está cortada ou não visível. Por favor certifique-se de que o documento inteiro esteja visível no envio.'),

  ('generic:blurry', NULL,
    'The document image is too blurry to verify details. Please retake the photo in better lighting.',
    'La imagen del documento está muy borrosa para verificar los detalles. Por favor tome la foto nuevamente con mejor iluminación.',
    'A imagem do documento está muito embaçada para verificar os detalhes. Por favor tire a foto novamente com melhor iluminação.'),

  ('generic:cropped', NULL,
    'The document appears cropped or cut off at the edges. Please show the full document including all borders.',
    'El documento parece estar recortado o cortado en los bordes. Por favor muestre el documento completo incluyendo todos los bordes.',
    'O documento parece cortado ou recortado nas bordas. Por favor mostre o documento completo incluindo todas as bordas.'),

  ('generic:wrong_document_type', NULL,
    'This appears to be the wrong type of document. Please check the required document and upload the correct type.',
    'Este parece ser el tipo de documento incorrecto. Por favor verifique el documento requerido y suba el tipo correcto.',
    'Este parece ser o tipo de documento errado. Por favor verifique o documento necessário e envie o tipo correto.'),

  ('generic:not_legible', NULL,
    'The text on this document cannot be read clearly. Please upload a higher quality image.',
    'El texto en este documento no se puede leer claramente. Por favor suba una imagen de mayor calidad.',
    'O texto neste documento não pode ser lido claramente. Por favor envie uma imagem de maior qualidade.'),

  ('generic:insufficient_quality', NULL,
    'The document quality is too low for verification. Please upload a clearer, higher-resolution image.',
    'La calidad del documento es muy baja para verificación. Por favor suba una imagen más clara y de mayor resolución.',
    'A qualidade do documento é muito baixa para verificação. Por favor envie uma imagem mais nítida e de maior resolução.'),

  ('generic:incomplete', NULL,
    'This document appears incomplete. Please ensure all required sections are visible and filled out.',
    'Este documento parece estar incompleto. Por favor asegúrese de que todas las secciones requeridas sean visibles y estén completadas.',
    'Este documento parece estar incompleto. Por favor certifique-se de que todas as seções necessárias estejam visíveis e preenchidas.'),

  ('generic:dark', NULL,
    'The document image is too dark to verify details. Please take the photo in better lighting.',
    'La imagen del documento está muy oscura para verificar los detalles. Por favor tome la foto con mejor iluminación.',
    'A imagem do documento está muito escura para verificar os detalhes. Por favor tire a foto com melhor iluminação.'),

  ('generic:glare', NULL,
    'There is too much glare or reflection on the document. Please take the photo without flash.',
    'Hay demasiado reflejo o brillo en el documento. Por favor tome la foto sin flash.',
    'Há muito brilho ou reflexo no documento. Por favor tire a foto sem flash.');

-- ═════════════════════════════════════════════════════════════════════════════
-- PAYSTUB-SPECIFIC TEMPLATES
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('paystubs:wrong_period', 'paystubs',
    'The pay stubs provided are not from the required 4-week period. Please upload the most recent 4 weekly or 2 bi-weekly pay stubs.',
    'Los talones de pago proporcionados no son del período de 4 semanas requerido. Por favor suba los talones de pago más recientes de 4 semanas semanales o 2 quincenas.',
    'Os contracheques fornecidos não são do período de 4 semanas necessário. Por favor envie os contracheques mais recentes de 4 semanas semanais ou 2 quinzenas.'),

  ('paystubs:missing_deductions', 'paystubs',
    'The pay stub does not show deductions clearly. Please upload a clearer image showing all deduction details.',
    'El talón de pago no muestra las deducciones claramente. Por favor suba una imagen más clara que muestre todos los detalles de deducciones.',
    'O contracheque não mostra as deduções claramente. Por favor envie uma imagem mais nítida mostrando todos os detalhes de deduções.'),

  ('paystubs:missing_employer_info', 'paystubs',
    'The employer name or address is not visible. Please upload a clearer image or contact your employer for a complete pay stub.',
    'El nombre o dirección del empleador no es visible. Por favor suba una imagen más clara o contacte a su empleador para obtener un talón de pago completo.',
    'O nome ou endereço do empregador não está visível. Por favor envie uma imagem mais nítida ou entre em contato com seu empregador para obter um contracheque completo.'),

  ('paystubs:not_final', 'paystubs',
    'These do not appear to be final pay stubs. Please upload the final pay stubs showing year-to-date totals.',
    'Estos no parecen ser talones de pago finales. Por favor suba los talones de pago finales que muestren los totales del año hasta la fecha.',
    'Estes não parecem ser contracheques finais. Por favor envie os contracheques finais mostrando os totais acumulados do ano.'),

  ('paystubs:too_old', 'paystubs',
    'These pay stubs are too old. Please upload pay stubs from the most recent 4 weeks.',
    'Estos talones de pago son muy antiguos. Por favor suba talones de pago de las últimas 4 semanas.',
    'Estes contracheques são muito antigos. Por favor envie contracheques das últimas 4 semanas.');

-- ═════════════════════════════════════════════════════════════════════════════
-- BANK STATEMENT-SPECIFIC TEMPLATES
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('bank_statement:missing_balance', 'bank_statement_checking',
    'The statement does not clearly show the account balance. Please upload a clearer image or request a statement with the balance visible.',
    'El estado de cuenta no muestra claramente el saldo de la cuenta. Por favor suba una imagen más clara o solicite un estado de cuenta con el saldo visible.',
    'O extrato não mostra claramente o saldo da conta. Por favor envie uma imagem mais nítida ou solicite um extrato com o saldo visível.'),

  ('bank_statement:missing_transactions', 'bank_statement_checking',
    'The transaction history is not fully visible. Please upload the complete statement showing all pages.',
    'El historial de transacciones no está completamente visible. Por favor suba el estado de cuenta completo mostrando todas las páginas.',
    'O histórico de transações não está totalmente visível. Por favor envie o extrato completo mostrando todas as páginas.'),

  ('bank_statement:wrong_account_type', 'bank_statement_checking',
    'This appears to be a savings account statement. Please upload the required checking account statement.',
    'Este parece ser un estado de cuenta de cuenta de ahorros. Por favor suba el estado de cuenta de cuenta corriente requerido.',
    'Este parece ser um extrato de conta poupança. Por favor envie o extrato de conta corrente necessário.'),

  ('bank_statement:missing_balance:savings', 'bank_statement_savings',
    'The statement does not clearly show the account balance. Please upload a clearer image or request a statement with the balance visible.',
    'El estado de cuenta no muestra claramente el saldo de la cuenta. Por favor suba una imagen más clara o solicite un estado de cuenta con el saldo visible.',
    'O extrato não mostra claramente o saldo da conta. Por favor envie uma imagem mais nítida ou solicite um extrato com o saldo visível.'),

  ('bank_statement:missing_transactions:savings', 'bank_statement_savings',
    'The transaction history is not fully visible. Please upload the complete statement showing all pages.',
    'El historial de transacciones no está completamente visible. Por favor suba el estado de cuenta completo mostrando todas las páginas.',
    'O histórico de transações não está totalmente visível. Por favor envie o extrato completo mostrando todas as páginas.'),

  ('bank_statement:wrong_account_type:savings', 'bank_statement_savings',
    'This appears to be a checking account statement. Please upload the required savings account statement.',
    'Este parece ser un estado de cuenta de cuenta corriente. Por favor suba el estado de cuenta de cuenta de ahorros requerido.',
    'Este parece ser um extrato de conta corrente. Por favor envie o extrato de conta poupança necessário.');

-- ═════════════════════════════════════════════════════════════════════════════
-- SSI/SS AWARD LETTER-SPECIFIC TEMPLATES
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('ssi_award_letter:missing_benefit_amount', 'ssi_award_letter',
    'The monthly benefit amount is not visible on this letter. Please upload a clearer image or request a current award letter from Social Security.',
    'El monto mensual del beneficio no es visible en esta carta. Por favor suba una imagen más clara o solicite una carta de adjudicación actualizada del Seguro Social.',
    'O valor mensual do benefício não está visível nesta carta. Por favor envie uma imagem mais nítida ou solicite uma carta de concessão atualizada da Previdência Social.'),

  ('ssi_award_letter:expired', 'ssi_award_letter',
    'This award letter is more than 12 months old. Please request and upload a current award letter.',
    'Esta carta de adjudicación tiene más de 12 meses de antigüedad. Por favor solicite y suba una carta de adjudicación actual.',
    'Esta carta de concessão tem mais de 12 meses. Por favor solicite e envie uma carta de concessão atualizada.'),

  ('ss_award_letter:missing_benefit_amount', 'ss_award_letter',
    'The monthly benefit amount is not visible on this letter. Please upload a clearer image or request a current award letter from Social Security.',
    'El monto mensual del beneficio no es visible en esta carta. Por favor suba una imagen más clara o solicite una carta de adjudicación actualizada del Seguro Social.',
    'O valor mensual do benefício não está visível nesta carta. Por favor envie uma imagem mais nítida ou solicite uma carta de concessão atualizada da Previdência Social.'),

  ('ss_award_letter:expired', 'ss_award_letter',
    'This award letter is more than 12 months old. Please request and upload a current award letter.',
    'Esta carta de adjudicación tiene más de 12 meses de antigüedad. Por favor solicite y suba una carta de adjudicación actual.',
    'Esta carta de concessão tem mais de 12 meses. Por favor solicite e envie uma carta de concessão atualizada.');

-- ═════════════════════════════════════════════════════════════════════════════
-- ID DOCUMENT-SPECIFIC TEMPLATES
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('id_doc:missing_photo', 'id_doc',
    'The photo on the ID is not visible or is obscured. Please upload a clearer image of the ID.',
    'La foto en la identificación no es visible o está oscurecida. Por favor suba una imagen más clara de la identificación.',
    'A foto na identidade não está visível ou está obscurecida. Por favor envie uma imagem mais nítida da identidade.'),

  ('id_doc:missing_signature', 'id_doc',
    'The signature on the ID is not visible. Please upload a clearer image showing the full ID.',
    'La firma en la identificación no es visible. Por favor suba una imagen más clara mostrando la identificación completa.',
    'A assinatura na identidade não está visível. Por favor envie uma imagem mais nítida mostrando a identidade completa.'),

  ('id_doc:expired', 'id_doc',
    'This ID appears to be expired. Please upload a current, unexpired ID.',
    'Esta identificación parece estar vencida. Por favor suba una identificación actual y vigente.',
    'Esta identidade parece estar expirada. Por favor envie uma identidade atual e válida.');

-- ═════════════════════════════════════════════════════════════════════════════
-- SIGNED FORM-SPECIFIC TEMPLATES
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('signed_form:missing_signature', 'signed_form',
    'A required signature is missing from this form. Please ensure all signature fields are completed before uploading.',
    'Falta una firma requerida en este formulario. Por favor asegúrese de que todos los campos de firma estén completados antes de subir.',
    'Uma assinatura necessária está faltando neste formulário. Por favor certifique-se de que todos os campos de assinatura estejam preenchidos antes de enviar.'),

  ('signed_form:missing_date', 'signed_form',
    'The date is missing from a signature on this form. Please ensure all signatures include the date signed.',
    'Falta la fecha en una firma de este formulario. Por favor asegúrese de que todas las firmas incluyan la fecha de firma.',
    'A data está faltando em uma assinatura deste formulário. Por favor certifique-se de que todas as assinaturas incluam a data de assinatura.'),

  ('signed_form:wrong_signer', 'signed_form',
    'The signatures on this form do not match the required signers. Please ensure the correct household members sign in the appropriate fields.',
    'Las firmas en este formulario no coinciden con los firmantes requeridos. Por favor asegúrese de que los miembros correctos del hogar firmen en los campos apropiados.',
    'As assinaturas neste formulário não correspondem aos signatários necessários. Por favor certifique-se de que os membros corretos do domicílio assinem nos campos apropriados.'),

  ('signed_form:incomplete', 'signed_form',
    'Some required fields on this form are not filled out. Please complete all required fields before uploading.',
    'Algunos campos requeridos en este formulario no están completados. Por favor complete todos los campos requeridos antes de subir.',
    'Alguns campos necessários neste formulário não estão preenchidos. Por favor preencha todos os campos necessários antes de enviar.');

-- ═════════════════════════════════════════════════════════════════════════════
-- ADD FOREIGN KEY COLUMN TO application_documents
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS rejection_reason_key TEXT
    REFERENCES public.pbv_rejection_reason_templates(key)
    ON DELETE SET NULL;  -- If template deleted, keep doc rejected but clear key reference

-- Add index for performance on template lookups
CREATE INDEX IF NOT EXISTS idx_application_documents_rejection_key
  ON public.application_documents(rejection_reason_key)
  WHERE rejection_reason_key IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN public.application_documents.rejection_reason_key IS
  'Foreign key to pbv_rejection_reason_templates. Preferred over rejection_reason (free-text fallback). Used for localized rejection messages in tenant UI.';
