'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SUFFIX = ' - Stanton Management';
const DEFAULT_TITLE = 'Stanton Management';

const TITLE_MAP: Record<string, string> = {
  '/form': 'Tenant Onboarding Form',
  '/move-in-inspection': 'Move-In Inspection Form',
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
};

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const title = TITLE_MAP[pathname];
    document.title = title ? `${title}${SUFFIX}` : DEFAULT_TITLE;
  }, [pathname]);

  return null;
}
