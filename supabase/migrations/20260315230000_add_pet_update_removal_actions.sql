-- Add pet_update and pet_removal to tenant_interactions action_type constraint
-- This allows the lobby intake system to log pet edits and removals

-- Drop existing constraint if it exists
ALTER TABLE tenant_interactions DROP CONSTRAINT IF EXISTS tenant_interactions_action_type_check;

-- Add new constraint with updated action types
ALTER TABLE tenant_interactions ADD CONSTRAINT tenant_interactions_action_type_check 
  CHECK (action_type IN (
    'pet_registration',
    'pet_update',
    'pet_removal',
    'vehicle_registration',
    'vehicle_update',
    'insurance_upload',
    'insurance_update',
    'note',
    'other'
  ));
