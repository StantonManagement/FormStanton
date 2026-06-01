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
  // Application lifecycle - PRD-15
  APPLICATION_SUBMITTED: 'application.submitted',
  STAFF_ESCALATION_REQUIRED: 'staff.escalation_required',

  // Multi-signer observability - PRD-18
  TENANT_SIGNER_COMPLETED: 'tenant.signer_completed',

  // Document lifecycle - Phase 1
  DOCUMENT_UPLOADED_BY_STAFF: 'document.uploaded_by_staff',
  DOCUMENT_RECATEGORIZED:     'document.recategorized',
  DOCUMENT_APPROVED:          'document.approved',
  DOCUMENT_REJECTED:          'document.rejected',
  DOCUMENT_WAIVED:            'document.waived',
  DOCUMENT_DEFERRED:          'document.deferred',

  // Handoff lifecycle - Phase 2
  HANDOFF_SENT:               'handoff.sent',
  HANDOFF_REOPENED:           'handoff.reopened',

  // Intake reopen - operator pulls a completed intake back to editable
  INTAKE_REOPENED:            'intake.reopened',

  // Review workflow - Assignment and tier-2 confirmation
  DOC_ASSIGNED:               'doc_assigned',
  APP_LEAD_ASSIGNED:          'app_lead_assigned',
  APP_ASSIGNED:               'app_assigned',
  DOC_OWNER_CONFIRMED:        'doc_owner_confirmed',
  DOC_OWNER_FLAGGED:          'doc_owner_flagged',

  // Packet intake - Phase PRD-02
  PACKET_INTAKE_STARTED:      'packet_intake_started',
  PACKET_INTAKE_COMMITTED:    'packet_intake_committed',
  PACKET_INTAKE_ABANDONED:    'packet_intake_abandoned',

  // Tenant document upload - Phase PRD-03
  DOCUMENT_UPLOADED_BY_TENANT: 'document.uploaded_by_tenant',

  // Document card stack analytics - PRD-42 F7
  DOCUMENT_CARD_VIEWED:           'document_card.viewed',
  DOCUMENT_CARD_COMPLETED:        'document_card.completed',
  DOCUMENT_CARD_DEFERRED:         'document_card.deferred',
  DOCUMENT_CARD_SKIPPED:          'document_card.skipped',
  DOCUMENT_CARD_DEACTIVATED:      'document_card.deactivated',
  DOCUMENT_SCANNER_OPENED:         'document_card.scanner_opened',
  DOCUMENT_SCANNER_RETAKE:        'document_card.scanner_retake',
  DOCUMENT_UPLOAD_SUCCESS:          'document_card.upload_success',
  DOCUMENT_UPLOAD_FAILED:         'document_card.upload_failed',
  DOCUMENT_STACK_STARTED:         'document_card.stack_started',
  DOCUMENT_SIDESHEET_OPENED:      'document_card.sidesheet_opened',

  // Application lifecycle - PRD-04
  APPLICATION_CREATED:        'pbv_full_application.created',

  // Household member correction - staff / paper intake
  PBV_MEMBER_CORRECTED:       'pbv_full_application.member_corrected',

  // Notification events - PRD-04
  NOTIFICATION_SCHEDULED:     'notification.scheduled',
  NOTIFICATION_SENT:          'notification.sent',
  NOTIFICATION_FAILED:        'notification.failed',
  NOTIFICATION_OPTED_OUT:     'notification.opted_out',

  // Post-approval execution - Phase 4
  SIGNING_PACKET_CREATED:     'signing_packet_created',
  SIGNATURE_MARKED_SENT:      'signature_marked_sent',
  HAP_RECEIVED_FROM_HACH:     'hap_received_from_hach',
  SIGNATURE_RECEIVED:         'signature_received',
  SIGNATURE_WAIVED:           'signature_waived',
  HAP_EXECUTED:               'hap_executed',
  PROPERTY_CONFIGURED:        'property_configured',

  // Appointment scheduling
  APPOINTMENT_SCHEDULED:      'appointment.scheduled',
  APPOINTMENT_COMPLETED:      'appointment.completed',
  APPOINTMENT_NO_SHOW:        'appointment.no_show',
  APPOINTMENT_RESCHEDULED:    'appointment.rescheduled',
  APPOINTMENT_CANCELLED:      'appointment.cancelled',
} as const;

export type ApplicationEventType =
  (typeof ApplicationEventType)[keyof typeof ApplicationEventType];

// --- Payload shapes per event type --------------------------------------------

export interface EventPayloadMap {
  'application.submitted': {
    submitted_at: string;
  };
  'staff.escalation_required': {
    reason: string;
    reminders_sent: number;
    missing_docs_count?: number;
  };
  'tenant.signer_completed': {
    signer_id: string;
    slot: number;
    name: string;
    completed_at: string;
  };
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
    rejection_reason_key?: string | null;
  };
  'document.waived': {
    doc_type: string;
    label: string;
  };
  'document.deferred': {
    document_id: string;
    doc_type: string;
    scheduled_reminder_at?: string;
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
  'intake.reopened': {
    reopen_reason: string;
    previous_signing_status: string | null;
    notification_status?: string | null;
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
  'app_assigned': {
    previous_assignee_id: string | null;
    new_assignee_id: string | null;
    previous_assignee_name: string | null;
    new_assignee_name: string | null;
    bulk_operation: boolean;
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

  'document.uploaded_by_tenant': {
    doc_type: string;
    label: string;
    file_name: string;
    applied_from_source?: string;
  };

  // Document card stack analytics payloads - PRD-42 F7
  'document_card.viewed': {
    doc_type: string;
    card_index: number;
    total_cards: number;
    status: string;
  };
  'document_card.completed': {
    doc_type: string;
    upload_method: 'scanner' | 'file_upload';
    revision: number;
    time_on_card_ms?: number;
  };
  'document_card.deferred': {
    doc_type: string;
    card_index: number;
    time_on_card_ms?: number;
  };
  'document_card.skipped': {
    reason?: string;
    timestamp: number;
  };
  'document_card.deactivated': {
    doc_type: string;
  };
  'document_card.scanner_opened': {
    doc_type: string;
    mode?: 'initial' | 'append' | 'retake' | 'reupload_after_rejection';
  };
  'document_card.scanner_retake': {
    doc_type: string;
    page_count: number;
  };
  'document_card.upload_success': {
    doc_type: string;
    upload_method: 'scanner' | 'file_upload';
    page_count?: number;
  };
  'document_card.upload_failed': {
    doc_type: string;
    upload_method: 'scanner' | 'file_upload';
    error: string;
  };
  'document_card.stack_started': {
    total_docs: number;
    deferred_docs: number;
  };
  'document_card.sidesheet_opened': {
    from_stage: string;
  };

  'pbv_full_application.created': {
    source: 'portal_intake' | 'admin_created';
    has_phone: boolean;
    has_language: boolean;
  };

  'pbv_full_application.member_corrected': {
    member_id: string;
    fields: string[];
  };

  'notification.scheduled': {
    notification_type: string;
    due_at: string;
    cancel_predicate: string | null;
  };

  'notification.sent': {
    notification_type: string;
    notification_id: string;
    twilio_message_sid: string;
    bulk_send_id?: string;
  };

  'notification.failed': {
    notification_type: string;
    notification_id: string;
    reason: string;
    bulk_send_id?: string;
  };

  'notification.opted_out': {
    notification_type?: string;
    notification_id?: string;
    action?: 'opted_out' | 'rescinded';
  };

  // Appointment scheduling payloads
  'appointment.scheduled': {
    appointment_id: string;
    staff_id: string;
    staff_name: string;
    starts_at: string;
    purpose: string;
    self_scheduled: boolean;
  };
  'appointment.completed': {
    appointment_id: string;
    staff_id: string;
    completed_at: string;
    notes?: string;
    purpose: string;
  };
  'appointment.no_show': {
    appointment_id: string;
    staff_id: string;
    scheduled_time: string;
    purpose: string;
  };
  'appointment.rescheduled': {
    old_appointment_id: string;
    new_appointment_id: string;
    new_starts_at: string;
    reason?: string;
  };
  'appointment.cancelled': {
    appointment_id: string;
    cancelled_at: string;
    reason?: string;
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

// --- Event subscriber (fire-and-forget notification hook) ---------------------

type EventSubscriber = (eventType: ApplicationEventType, applicationId: string, eventId: string) => void;

const _subscribers: EventSubscriber[] = [];

export function subscribeToApplicationEvents(fn: EventSubscriber): void {
  _subscribers.push(fn);
}

function _notifySubscribers(eventType: ApplicationEventType, applicationId: string, eventId: string): void {
  for (const fn of _subscribers) {
    try {
      fn(eventType, applicationId, eventId);
    } catch (subscriberError) {
      console.error(`[application-events] Subscriber failed for ${eventType}:`, subscriberError);
      // Continue with other subscribers - don't let one failure block others
    }
  }
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
  const result = await writeApplicationEvent({
    anchorType: 'pbv_full_application',
    anchorId: applicationId,
    ...rest,
  });
  _notifySubscribers(params.eventType, applicationId, result.id);
  return result;
}
