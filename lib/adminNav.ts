// Single source of truth for all admin navigation destinations.
// Consumed by: AdminSidebar, CommandPalette, Admin Home tools grid.

export interface NavItem {
  label: string;
  href: string;
  keywords?: string[];
  beta?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const adminNavSections: NavSection[] = [
  {
    title: 'Home',
    items: [
      { label: 'Home', href: '/admin/home', keywords: ['dashboard', 'overview', 'summary'] },
    ],
  },
  {
    title: 'Front Desk / Lobby',
    items: [
      {
        label: 'Lobby (Permit Distribution)',
        href: '/admin/lobby',
        keywords: ['tenant', 'pickup', 'permit', 'desk', 'intake', 'insurance', 'vehicle'],
      },
      {
        label: 'Phone Vehicle Entry',
        href: '/admin/phone-entry',
        keywords: ['phone', 'vehicle', 'permit', 'parking', 'call'],
      },
      {
        label: 'Tow List',
        href: '/admin/tow-list',
        beta: true,
        keywords: ['tow', 'parking', 'flagged', 'vehicle'],
      },
    ],
  },
  {
    title: 'Field Operations',
    items: [
      {
        label: 'All Buildings',
        href: '/admin/compliance',
        keywords: ['inspection', 'building', 'compliance', 'matrix', 'insurance', 'pet', 'vehicle', 'portfolio'],
      },
      {
        label: 'Projects',
        href: '/admin/projects',
        keywords: ['project', 'campaign', 'task', 'compliance', 'unit', 'tenant'],
      },
      {
        label: 'Scan Import',
        href: '/admin/scan-import',
        keywords: ['scan', 'import', 'document', 'upload', 'ocr', 'paper'],
      },
    ],
  },
  {
    title: 'Back Office',
    items: [
      {
        label: 'Form Submissions',
        href: '/admin/form-submissions',
        keywords: ['form', 'submission', 'review', 'appfolio', 'pending', 'approved'],
      },
      {
        label: 'Onboarding Submissions',
        href: '/admin/onboarding',
        keywords: ['onboarding', 'new tenant', 'lease', 'move-in'],
      },
      {
        label: 'Reimbursement Requests',
        href: '/admin/reimbursements',
        keywords: ['reimbursement', 'expense', 'hr', 'payment'],
      },
      {
        label: 'AppFolio Queue',
        href: '/admin/appfolio-queue',
        keywords: ['appfolio', 'queue', 'upload', 'send', 'export', 'pending'],
      },
    ],
  },
  {
    title: 'Program Compliance',
    items: [
      {
        label: 'PBV Pre-Apps',
        href: '/admin/pbv/preapps',
        keywords: ['pbv', 'voucher', 'section 8', 'pre-application', 'housing', 'hud'],
      },
      {
        label: 'PBV Full Applications',
        href: '/admin/pbv/full-applications',
        keywords: ['pbv', 'voucher', 'application', 'housing', 'full', 'hud'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Forms Library',
        href: '/admin/forms-library',
        keywords: ['forms', 'library', 'template', 'document', 'link', 'pdf'],
      },
      {
        label: 'Audit Log',
        href: '/admin/audit-log',
        keywords: ['audit', 'log', 'history', 'actions', 'changes'],
      },
      {
        label: 'User Management',
        href: '/admin/users',
        keywords: ['user', 'staff', 'account', 'admin', 'password'],
      },
      {
        label: 'Roles',
        href: '/admin/roles',
        keywords: ['role', 'permission', 'access', 'rbac'],
      },
      {
        label: 'Departments',
        href: '/admin/departments',
        keywords: ['department', 'team', 'group'],
      },
    ],
  },
];

export const allNavItems: (NavItem & { section: string })[] = adminNavSections.flatMap(
  (section) => section.items.map((item) => ({ ...item, section: section.title }))
);
