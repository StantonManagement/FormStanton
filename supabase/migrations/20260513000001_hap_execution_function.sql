-- HAP Execution Transaction Function
-- Atomic transaction for executing HAP contract
-- Ensures all updates succeed or none do

CREATE OR REPLACE FUNCTION public.execute_hap_transaction(
  p_application_id UUID,
  p_packet_id UUID,
  p_executed_by UUID,
  p_direction TEXT,
  p_hap_file_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_time TIMESTAMPTZ := NOW();
BEGIN
  -- Update signing packet
  UPDATE public.signing_packets
  SET 
    executed_at = v_current_time,
    executed_by = p_executed_by,
    notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL AND notes != '' THEN '; ' ELSE '' END || 
             'HAP executed ' || p_direction || CASE WHEN p_hap_file_path IS NOT NULL THEN ' (file: ' || p_hap_file_path || ')' ELSE '' END
  WHERE id = p_packet_id;

  -- Update application stage and lock
  UPDATE public.pbv_full_applications
  SET 
    stage = 'executed',
    stage_changed_at = v_current_time,
    packet_locked = true,
    updated_at = v_current_time
  WHERE id = p_application_id;

  -- Update HAP signature status to 'executed'
  UPDATE public.packet_signatures
  SET 
    status = 'executed',
    updated_at = v_current_time
  WHERE packet_id = p_packet_id 
    AND document_slug = 'hap_contract' 
    AND signing_party = 'stanton_and_hach';

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise exception to ensure transaction rollback
    RAISE;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.execute_hap_transaction TO service_role;
