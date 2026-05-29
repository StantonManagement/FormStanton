export const NotificationType = {
  MAGIC_LINK_INITIAL:         'magic_link_initial',
  MAGIC_LINK_RESENT:          'magic_link_resent',
  DOCS_UPLOAD_REMINDER:       'docs_upload_reminder',
  DOC_REJECTED:               'doc_rejected',
  HACH_APPROVED_SIGNING_READY: 'hach_approved_signing_ready',
  SIGNING_REMINDER:           'signing_reminder',
  HAP_EXECUTED_MOVE_IN:       'hap_executed_move_in',
  PBV_PREFLIGHT_CHECKLIST:    'pbv_preflight_checklist',
  STAFF_MESSAGE:              'staff_message',
} as const;

export type NotificationType = (typeof Not