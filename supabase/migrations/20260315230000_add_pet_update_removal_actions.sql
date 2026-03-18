-- tenant_interactions action_type constraint — all action types used in the lobby intake system
-- Updated 2026-03-18: added vehicle_removal, esa_document_received, no_pets_acknowledgment,
-- insurance_policy_recorded, insurance_choice_own, insurance_choice_appfolio,
-- insurance_proof_received, insurance_expiration_warning, id_photo_upload, printed_forms, general_note

ALTER TABLE tenant_interactions DROP CONSTRAINT IF EXISTS tenant_interactions_action_type_check;

ALTER TABLE tenant_interactions ADD CONSTRAINT tenant_interactions_action_type_check
  CHECK (action_type IN (
    'pet_registration', 'pet_update', 'pet_removal',
    'vehicle_registration', 'vehicle_update', 'vehicle_removal',
    'esa_document_received', 'no_pets_acknowledgment',
    'insurance_upload', 'insurance_update', 'insurance_policy_recorded',
    'insurance_choice_own', 'insurance_choice_appfolio',
    'insurance_proof_received', 'insurance_expiration_warning',
    'gave_additional_insured_instructions',
    'id_photo_upload', 'printed_forms', 'general_note',
    'note', 'other'
  ));
