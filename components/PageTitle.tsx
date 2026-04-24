'use client';

import { usePathname } from 'next/navigation';

const SUFFIX = ' - Stanton Management';
const DEFAULT_TITLE = 'Stanton Management';

const TITLE_MAP: Record<string, string> = {
  '/form': 'Tenant Onboarding Form',
  '/move-in-inspection': 'Move-In Inspection Form',
  '/move-out-inspection': 'Move-Out Inspection',
  '/smoke-detector': 'Smoke & CO Detector Acknowledgment',
  '/utility-transfer': 'Utility Transfer Confirmation',
  '/permission-to-enter': 'Permission to Enter / Entry Restriction',
  '/move-out-notice': 'Move-Out Notice',
  '/forwarding-address': 'Forwarding Address Submission',
  '/lease-renewal': 'Lease Renewal / Non-Renewal Notice',
  '/maintenance-request': 'Maintenance Request',
  '/lock-key-replacement': 'Lock / Key Replacement Authorization',
  '/after-hours-lockout': 'After-Hours Lockout Acknowledgment',
  '/bulk-disposal': 'Bulk Item Disposal Request',
  '/pet-approval': 'Pet Approval Request',
  '/guest-disclosure': 'Extended Guest Disclosure',
  '/common-area-violation': 'Common Area Violation Notice',
  '/unauthorized-pet': 'Unauthorized Pet Notice',
  '/section8-recertification': 'Section 8 Recertification Checklist',
  '/cash-payment-appointment': 'Cash Payment Appointment Request',
  '/payslip-request': 'PaySlip Request',
  '/billing-dispute': 'Tenant Billing Dispute Form',
  '/reimbursement': 'Tenant Reimbursement Request',
  '/tenant-assessment': 'Tenant Assessment',
  '/apartment-inquiry': 'Apartment Inquiry',
  '/pet-fee-exemption': 'Pet Fee Exemption Request',
  '/pbv-preapp': 'PBV Pre-Application',
  '/admin': 'Admin Login',
  '/admin/home': 'Dashboard',
  '/admin/compliance': 'Compliance Dashboard',
  '/admin/appfolio-queue': 'AppFolio Queue',
  '/admin/audit-log': 'Audit Log',
  '/admin/form-submissions': 'Form Submissions',
  '/admin/forms-library': 'Forms Library',
  '/admin/lobby': 'Lobby',
  '/admin/onboarding': 'Onboarding',
  '/admin/pbv/preapps': 'PBV Pre-Applications',
  '/admin/pbv/thresholds': 'PBV Thresholds',
  '/admin/phone-entry': 'Phone Entry',
  '/admin/projects': 'Projects',
  '/admin/reimbursements': 'Reimbursements',
  '/admin/roles': 'Roles',
  '/admin/scan-import': 'Scan Import',
  '/admin/tow-list': 'Tow List',
  '/admin/users': 'Users',
  '/admin/departments': 'Departments',
};

const PREFIX_MAP: Array<[string, string]> = [
  ['/admin/projects/', 'Project'],
  ['/admin/form-submissions/', 'Submission'],
  ['/t/', 'Tenant Portal'],
];

export default function PageTitle() {
  const pathname = usePathname();
  const exactTitle = TITLE_MAP[pathname];
  if (exactTitle) {
    return <title>{exactTitle}{SUFFIX}</title>;
  }
  const prefixMatch = PREFIX_MAP.find(([prefix]) => pathname.startsWith(prefix));
  if (prefixMatch) {
    return <title>{prefixMatch[1]}{SUFFIX}</title>;
  }
  return <title>{DEFAULT_TITLE}</title>;
}
