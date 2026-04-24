// Central permission registry
// Defines all resources, valid actions, and the nav-to-permission mapping
// used by middleware, API route guards, and the sidebar.

export const RESOURCES = {
  HOME:             'home',
  COMPLIANCE:       'compliance',
  PROJECTS:         'projects',
  PBV_PREAPPS:      'pbv-preapps',
  LOBBY:            'lobby',
  PHONE_ENTRY:      'phone-entry',
  APPFOLIO_QUEUE:   'appfolio-queue',
  SCAN_IMPORT:      'scan-import',
  FORM_SUBMISSIONS: 'form-submissions',
  ONBOARDING:       'onboarding',
  REIMBURSEMENTS:   'reimbursements',
  FORMS_LIBRARY:    'forms-library',
  TOW_LIST:         'tow-list',
  AUDIT_LOG:        'audit-log',
  USER_MANAGEMENT:  'user-management',
  ROLE_MANAGEMENT:        'role-management',
  PBV_FULL_APPLICATIONS:   'pbv-full-applications',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

export const ACTIONS = {
  READ:   'read',
  WRITE:  'write',
  DELETE: 'delete',
  ADMIN:  'admin',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export interface RoutePermission {
  resource: Resource;
  // action required for GET requests
  read: Action;
  // action required for POST/PUT/PATCH requests (defaults to 'write' if omitted)
  write?: Action;
  // action required for DELETE requests (defaults to 'delete' if omitted)
  delete?: Action;
}

// Maps URL path prefixes to required permissions.
// Matched in order — first prefix match wins.
export const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: RoutePermission }> = [
  // User management (admin-level)
  { prefix: '/api/admin/users',                       permission: { resource: RESOURCES.USER_MANAGEMENT,  read: 'admin', write: 'admin', delete: 'admin' } },
  { prefix: '/api/admin/staff-list',                  permission: { resource: RESOURCES.USER_MANAGEMENT,  read: 'read' } },

  // Role & department management (admin-level)
  { prefix: '/api/admin/roles',                       permission: { resource: RESOURCES.ROLE_MANAGEMENT,  read: 'read', write: 'write', delete: 'delete' } },
  { prefix: '/api/admin/departments',                 permission: { resource: RESOURCES.ROLE_MANAGEMENT,  read: 'read', write: 'write', delete: 'delete' } },

  // Audit log (read-only for all authorized)
  { prefix: '/api/admin/audit-log',                   permission: { resource: RESOURCES.AUDIT_LOG,        read: 'read' } },

  // Compliance
  { prefix: '/api/admin/compliance',                  permission: { resource: RESOURCES.COMPLIANCE,       read: 'read', write: 'write', delete: 'delete' } },

  // Projects
  { prefix: '/api/admin/projects',                    permission: { resource: RESOURCES.PROJECTS,         read: 'read', write: 'write', delete: 'delete' } },
  { prefix: '/api/admin/task-types',                  permission: { resource: RESOURCES.PROJECTS,         read: 'read', write: 'write', delete: 'delete' } },
  { prefix: '/api/admin/tenant-profiles',             permission: { resource: RESOURCES.PROJECTS,         read: 'read', write: 'write' } },

  // PBV Pre-Apps
  { prefix: '/api/admin/pbv',                         permission: { resource: RESOURCES.PBV_PREAPPS,      read: 'read', write: 'write', delete: 'delete' } },

  // Lobby
  { prefix: '/api/admin/lobby-intake',                permission: { resource: RESOURCES.LOBBY,            read: 'read', write: 'write' } },
  { prefix: '/api/admin/lobby-canonical',             permission: { resource: RESOURCES.LOBBY,            read: 'read', write: 'write' } },
  { prefix: '/api/admin/lobby-notes',                 permission: { resource: RESOURCES.LOBBY,            read: 'read', write: 'write' } },
  { prefix: '/api/admin/unified-tenants',             permission: { resource: RESOURCES.LOBBY,            read: 'read' } },
  { prefix: '/api/admin/tenant-lookup',               permission: { resource: RESOURCES.LOBBY,            read: 'read' } },
  { prefix: '/api/admin/tenant-insurance',            permission: { resource: RESOURCES.LOBBY,            read: 'read', write: 'write' } },
  { prefix: '/api/admin/tenant-interactions',         permission: { resource: RESOURCES.LOBBY,            read: 'read', write: 'write' } },

  // Phone Vehicle Entry
  { prefix: '/api/admin/phone-vehicle-entry',         permission: { resource: RESOURCES.PHONE_ENTRY,      read: 'read', write: 'write', delete: 'delete' } },

  // AppFolio Queue
  { prefix: '/api/admin/appfolio-queue',              permission: { resource: RESOURCES.APPFOLIO_QUEUE,   read: 'read', write: 'write' } },

  // Scan Import
  { prefix: '/api/admin/scan-upload',                 permission: { resource: RESOURCES.SCAN_IMPORT,      read: 'read', write: 'write' } },
  { prefix: '/api/admin/scan-extractions',            permission: { resource: RESOURCES.SCAN_IMPORT,      read: 'read', write: 'write' } },
  { prefix: '/api/admin/import-scans',                permission: { resource: RESOURCES.SCAN_IMPORT,      read: 'read', write: 'write' } },
  { prefix: '/api/admin/extract-forms',               permission: { resource: RESOURCES.SCAN_IMPORT,      read: 'read', write: 'write' } },

  // Form Submissions
  { prefix: '/api/admin/form-submissions',            permission: { resource: RESOURCES.FORM_SUBMISSIONS, read: 'read', write: 'write', delete: 'delete' } },
  { prefix: '/api/admin/submissions',                 permission: { resource: RESOURCES.FORM_SUBMISSIONS, read: 'read', write: 'write', delete: 'delete' } },
  { prefix: '/api/admin/update-submission',           permission: { resource: RESOURCES.FORM_SUBMISSIONS, read: 'read', write: 'write' } },

  // Onboarding
  { prefix: '/api/admin/onboarding',                  permission: { resource: RESOURCES.ONBOARDING,       read: 'read', write: 'write' } },

  // Reimbursements
  { prefix: '/api/admin/reimbursements',              permission: { resource: RESOURCES.REIMBURSEMENTS,   read: 'read', write: 'write', delete: 'delete' } },

  // Forms Library
  { prefix: '/api/admin/forms-library',               permission: { resource: RESOURCES.FORMS_LIBRARY,    read: 'read', write: 'write', delete: 'delete' } },

  // File access (used by compliance + lobby)
  { prefix: '/api/admin/file',                        permission: { resource: RESOURCES.COMPLIANCE,       read: 'read' } },

  // Generate form package (compliance)
  { prefix: '/api/admin/generate-form-package',       permission: { resource: RESOURCES.COMPLIANCE,       read: 'read', write: 'write' } },

  // Buildings (read-only reference data)
  { prefix: '/api/admin/buildings',                   permission: { resource: RESOURCES.HOME,             read: 'read' } },
  { prefix: '/api/admin/home-summary',                permission: { resource: RESOURCES.HOME,             read: 'read' } },
];

// Sidebar navigation to permission mapping
export interface NavPermission {
  resource: Resource;
  action: Action;
}

export const NAV_PERMISSION_MAP: Record<string, NavPermission> = {
  '/admin/home':              { resource: RESOURCES.HOME,             action: ACTIONS.READ },
  '/admin/compliance':        { resource: RESOURCES.COMPLIANCE,       action: ACTIONS.READ },
  '/admin/projects':          { resource: RESOURCES.PROJECTS,         action: ACTIONS.READ },
  '/admin/pbv/preapps':           { resource: RESOURCES.PBV_PREAPPS,          action: ACTIONS.READ },
  '/admin/pbv/full-applications': { resource: RESOURCES.PBV_FULL_APPLICATIONS, action: ACTIONS.READ },
  '/admin/lobby':             { resource: RESOURCES.LOBBY,            action: ACTIONS.READ },
  '/admin/phone-entry':       { resource: RESOURCES.PHONE_ENTRY,      action: ACTIONS.READ },
  '/admin/appfolio-queue':    { resource: RESOURCES.APPFOLIO_QUEUE,   action: ACTIONS.READ },
  '/admin/scan-import':       { resource: RESOURCES.SCAN_IMPORT,      action: ACTIONS.READ },
  '/admin/form-submissions':  { resource: RESOURCES.FORM_SUBMISSIONS, action: ACTIONS.READ },
  '/admin/onboarding':        { resource: RESOURCES.ONBOARDING,       action: ACTIONS.READ },
  '/admin/reimbursements':    { resource: RESOURCES.REIMBURSEMENTS,   action: ACTIONS.READ },
  '/admin/forms-library':     { resource: RESOURCES.FORMS_LIBRARY,    action: ACTIONS.READ },
  '/admin/tow-list':          { resource: RESOURCES.TOW_LIST,         action: ACTIONS.READ },
  '/admin/audit-log':         { resource: RESOURCES.AUDIT_LOG,        action: ACTIONS.READ },
  '/admin/users':             { resource: RESOURCES.USER_MANAGEMENT,  action: ACTIONS.ADMIN },
  '/admin/roles':             { resource: RESOURCES.ROLE_MANAGEMENT,  action: ACTIONS.READ },
  '/admin/departments':       { resource: RESOURCES.ROLE_MANAGEMENT,  action: ACTIONS.READ },
};
