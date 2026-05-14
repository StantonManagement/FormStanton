/**
 * application-events.ts
 *
 * Single entry point for all application_events table writes.
 * RULE: No code outside this file may insert into application_events directly.
 *
 * All writes are fire-and-commit - callers must await inside the same logical
 * unit of work as their state mutation so the event and the state change land
 * together.
 *
 * writePbvApplicationEvent is the caller-facing wrapper for PBV workflows.
 * writeApplicationEvent is the generic primitive - do not call it directly
 * from route handlers; use the workflow-specific wrapper instead.
 */

import { supabaseAdmin } from '@/lib/supabase';

// --- Anchor type ---------------------------------------------------------------

export type AnchorType = 'pbv_full_application';

// --- Event type enum -----------------------------------------------------------

export const ApplicationEventType = {
  // Document lifecycle - Phase 1
  DOCUMENT_UPLOADED_BY_STAFF: 'document.uploaded_by_staff',
  DOCUMENT_RECATEGORIZED:     'document.recategorized',
  DOCUMENT_APPROVED:          'document.approved',
  DOCUMENT_REJECTED:          'document.rejected',
  DOCUMENT_WAIVED:            'document.waived',

  // Handoff lifecycle - Phase 2
  HANDOFF_SENT:               'handoff.sent',
  HANDOFF_REOPENED:           'handoff.reopened',

  // Review workflow - Assignment and tier-2 confirmation
  DOC_ASSIGNED:               'doc_assigned',
  APP_LEAD_ASSIGNED:          'app_lead_assigned',
  DOC_OWNER_CONFIRMED:        'doc_owner_confirmed',
  DOC_OWNER_FLAGGED:          'doc_owner_flagged',

  // Packet intake - Phase PRD-02
  PACKET_INTAKE_STARTED:      'packet_intake_started',
  PACKET_INTAKE_COMMITTED:    'packet_intake_committed',
  PACKET_INTAKE_ABANDONED:    'packet_intake_abandoned',

  // Post-approval execution - Phase 4
  SIGNING_PACKET_CREATED:     'signing_packet_created',
  SIGNATURE_MARKED_SENT:      'signature_marked_sent',
  HAP_RECEIVED_FROM_HACH:     'hap_received_from_hach',
  SIGNATURE_RECEIVED:         'signature_received',
  SIGNATURE_WAIVED:           'signature_waived',
  HAP_EXECUTED:               'hap_executed',
  PROPERTY_CONFIGURED:        'property_configured',
} as const;

export type ApplicationEventType =
  (typeof ApplicationEventType)[keyof typeof ApplicationEventType];

// --- Payload shapes per event type --------------------------------------------

export interface EventPayloadMap {
  'document.uploaded_by_staff': {
    doc_type: string;
    label: string;
    file_name: string;
    staff_upload_note?: string | null;
  };
  'document.recategorized': {
    from_doc_type: string;
    to_doc_type: string;
    label: string;
  };
  'document.approved': {
    doc_type: string;
    label: string;
  };
  'document.rejected': {
    doc_type: string;
    label: string;
    rejection_reason: string;
  };
  'document.waived': {
    doc_type: string;
    label: string;
  };
  'handoff.sent': {
    hach_review_status: string;
    hach_packet_revision: number;
    preflight_overrides?: string[];
    override_reason?: string | null;
    override_failed_checks?: string[] | null;
  };
  'handoff.reopened': {
    reopen_reason: string;
    previous_hach_review_status: string;
  };

  // Review workflow payloads
  'doc_assigned': {
    from_user_id: string | null;
    to_user_id: string | null;
    note?: string | null;
    doc_type: string;
    label: string;
  };
  'app_lead_assigned': {
    from_user_id: string | null;
    to_user_id: string | null;
    application_id: string;
    head_of_household_name: string;
  };
  'doc_owner_confirmed': {
    doc_type: string;
    label: string;
    prior_tier1_actor?: string | null;
  };
  'doc_owner_flagged': {
    doc_type: string;
    label: string;
    reason: string;
    prior_tier1_actor: string;
  };

  // Post-approval execution payloads
  'signing_packet_created': {
    template_key: string;
    signature_count: number;
  };
  'signature_marked_sent': {
    document_slug: string;
    document_label: string;
    signing_party: string;
    note?: string;
    hap_initiation_direction?: 'stanton_first' | 'hach_first';
  };
  'hap_received_from_hach': {
    document_slug: string;
    document_label: string;
    initiation_direction: 'hach_first';
  };
  'signature_received': {
    document_slug: string;
    document_label: string;
    signing_party: string;
    uploader_role: 'tenant' | 'stanton' | 'hach';
    signature_method: 'wet_upload' | 'in_app';
  };
  'signature_waived': {
    document_slug: string;
    document_label: string;
    signing_party: string;
    reason: string;
  };
  'hap_executed': {
    direction: 'stanton_first' | 'hach_first';
    hap_file_path?: string;
  };
  'property_configured': {
    building_address: string;
    fields_updated: string[];
  };

  'packet_intake_started': {
    batch_id: string;
    source_label?: string | null;
    file_count: number;
  };
  'packet_intake_committed': {
    batch_id: string;
    total_pages: number;
    template_docs: number;
    custom_docs: number;
    discarded_pages: number;
    source_label?: string | null;
  };
  'packet_intake_abandoned': {
    batch_id: string;
    source_label?: string | null;
    reason?: string | null;
  };
}

// --- Generic write primitive ---------------------------------------------------

export interface WriteApplicationEventParams<T extends ApplicationEventType> {
  anchorType: AnchorType;
  anchorId: string;
  eventType: T;
  actorUserId: string | null;
  actorDisplayName: string;
  documentId?: string | null;
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : Record<string, unknown>;
}

export async function writeApplicationEvent<T extends ApplicationEventType>(
  params: WriteApplicationEventParams<T>
): Promise<{ id: string }> {
  const {
    anchorType,
    anchorId,
    eventType,
    actorUserId,
    actorDisplayName,
    documentId,
    payload,
  } = params;

  const { data, error } = await supabaseAdmin.from('application_events').insert({
    anchor_type: anchorType,
    anchor_id: anchorId,
    event_type: eventType,
    actor_user_id: actorUserId ?? null,
    actor_display_name: actorDisplayName,
    document_id: documentId ?? null,
    payload: payload as Record<string, unknown>,
  }).select('id').single();

  if (error) {
    throw new Error(`[application-events] Failed to write event ${eventType}: ${error.message}`);
  }

  return { id: (data as { id: string }).id };
}

// --- PBV wrapper ---------------------------------------------------------------

export interface WritePbvApplicationEventParams<T extends ApplicationEventType> {
  applicationId: string;
  eventType: T;
  actorUserId: string | null;
  actorDisplayName: string;
  documentId?: string | null;
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : Record<string, unknown>;
}

export async function writePbvApplicationEvent<T extends ApplicationEventType>(
  params: WritePbvApplicationEventParams<T>
): Promise<{ id: string }> {
  const { applicationId, ...rest } = params;
  return writeApplicationEvent({
    anchorType: 'pbv_full_application',
    anchorId: applicationId,
    ...rest,
  });
}
