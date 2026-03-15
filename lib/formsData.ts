import { llcTable } from './policyContent';

// IMPORTANT: PDF generation uses WinAnsi encoding (ASCII only)
// Do NOT use Unicode characters: → • — " " ' '
// Use ASCII equivalents: -> - -- " ' instead

export type Department = 'property_management' | 'maintenance' | 'compliance' | 'finance';

export interface TenantForm {
  id: number;
  title: string;
  department: Department;
  description: string;
  content?: string;
  path?: string;
}

export const departmentLabels: Record<Department, string> = {
  property_management: 'Property Management',
  maintenance: 'Maintenance',
  compliance: 'Compliance',
  finance: 'Finance',
};

// Canonical registry for forms shown in Admin > Forms Library.
// When adding a new live form route, add it here with `path` so it appears in the library.
// If you also want printable/template preview in the modal, provide `content`.
export const tenantForms: TenantForm[] = [
  // PROPERTY MANAGEMENT FORMS
  {
    id: 1,
    title: 'Move-In Inspection Form',
    department: 'property_management',
    description: 'Document unit condition at move-in to protect security deposit',
    path: '/move-in-inspection',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Move-In Date:** _________________________________________________

**Keys Received:** Unit Keys _____ Mailbox Keys _____ Fobs _____

---

## Instructions

Walk through your entire unit and note the condition of each item below. Use the following codes:

- **G** = Good / No issues
- **D** = Damaged (describe)
- **M** = Missing
- **N/A** = Not applicable to this unit

Take photos of any damage and attach them to this form. **Return this form to the office within 7 days of move-in.** If we do not receive it within that window, the unit will be considered accepted in its delivered condition.

---

## Living Room / Common Areas

| Item | Condition | Notes |
|---|---|---|
| Walls | | |
| Ceiling | | |
| Floors / Carpet | | |
| Windows | | |
| Window Screens | | |
| Blinds / Shades | | |
| Doors | | |
| Door Hardware / Locks | | |
| Light Fixtures | | |
| Outlets / Switches | | |
| Baseboards / Heaters | | |

---

## Kitchen

| Item | Condition | Notes |
|---|---|---|
| Walls | | |
| Ceiling | | |
| Floors | | |
| Cabinets | | |
| Countertops | | |
| Sink / Faucet | | |
| Stove / Oven | | |
| Refrigerator | | |
| Dishwasher (if applicable) | | |
| Microwave (if applicable) | | |
| Light Fixtures | | |
| Outlets / Switches | | |

---

## Bathroom(s)

| Item | Condition | Notes |
|---|---|---|
| Walls / Tiles | | |
| Ceiling | | |
| Floor | | |
| Toilet | | |
| Sink / Faucet | | |
| Shower / Tub | | |
| Shower Curtain / Door | | |
| Mirror / Medicine Cabinet | | |
| Exhaust Fan | | |
| Light Fixtures | | |
| Outlets / Switches | | |

---

## Bedroom(s)

| Item | Condition | Notes |
|---|---|---|
| Walls | | |
| Ceiling | | |
| Floors / Carpet | | |
| Windows | | |
| Window Screens | | |
| Blinds / Shades | | |
| Closet Doors | | |
| Light Fixtures | | |
| Outlets / Switches | | |
| Baseboards / Heaters | | |

---

## Additional Notes

_______________________________________________
_______________________________________________
_______________________________________________

---

## Signatures

By signing below, both parties acknowledge the condition of the unit as documented above.

**Tenant Signature:** _________________________ Date: __________

**Tenant Signature (if applicable):** _________________________ Date: __________

**Stanton Management Representative:** _________________________ Date: __________`,
  },
  {
    id: 2,
    title: 'Smoke & CO Detector Acknowledgment',
    department: 'property_management',
    description: 'Confirm smoke and CO detectors are present and functioning',
    path: '/smoke-detector',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Move-In Date:** _________________________________________________

---

## Acknowledgment

I/we confirm the following:

- [ ] Smoke detector(s) are present and functioning in the unit as of move-in
- [ ] Carbon monoxide (CO) detector(s) are present and functioning in the unit as of move-in
- [ ] I have been informed that tampering with, disabling, removing, or covering any smoke or CO detector is a criminal offense and grounds for immediate eviction
- [ ] I understand that a fine of **$85** will be charged for any tampering or removal
- [ ] If a detector beeps or malfunctions, I will submit a maintenance request -- I will not remove it myself

**Detector Locations:**

Smoke Detectors: _______________________________________________

CO Detectors: _______________________________________________

---

**Tenant Signature:** _________________________ Date: __________

**Tenant Signature (if applicable):** _________________________ Date: __________

**Stanton Management Representative:** _________________________ Date: __________`,
  },
  {
    id: 3,
    title: 'Utility Transfer Confirmation',
    department: 'property_management',
    description: 'Confirm utilities transferred before key release',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Lease Start Date:** _____________________________________________

---

## Instructions

Keys will not be released until required utilities have been transferred into the tenant's name. Complete this form and provide confirmation numbers or account numbers as proof.

---

## Utility Status

| Utility | Required? | Provider | Account # / Confirmation | Transfer Date |
|---|---|---|---|---|
| Electricity | Yes | Eversource | | |
| Gas | Check lease | | | |
| Internet / Cable | Tenant choice | | | |

**Note:** Heat, water/sewer, and trash removal are typically included in rent. Confirm with your lease.

---

**Tenant Signature:** _________________________ Date: __________

**Received by (Stanton Management):** _________________________ Date: __________

*Keys released:* [ ] Yes -- Date: __________ Staff initials: __________`,
  },
  {
    id: 4,
    title: 'Permission to Enter / Entry Restriction',
    department: 'property_management',
    description: 'Set entry preferences for maintenance and inspections',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date:** ________________________________________________________

---

## Select One

### Option A -- Standing Permission to Enter

I authorize Stanton Management and its contractors to enter my unit for scheduled maintenance and inspections during standard hours (Mon-Fri, 8 AM-6 PM) with 24 hours' advance notice, without requiring me to be present.

- [ ] I also have a pet in the unit. Please take precautions: ___________________________

**Tenant Signature:** _________________________ Date: __________

---

### Option B -- Entry Restriction / Must Be Present

I require that a Stanton Management representative contact me before any non-emergency entry. I understand this may delay repairs.

**Preferred contact method:** [ ] Phone [ ] Text
**Contact number:** _____________________________________________
**Preferred hours for entry:** _____________________________________

I understand that in the event of an emergency, Stanton Management may enter without prior notice.

**Tenant Signature:** _________________________ Date: __________

---

*For office use -- noted in file:* __________ Date: __________`,
  },
  {
    id: 5,
    title: 'Move-Out Notice',
    department: 'property_management',
    description: '30-day written notice required before moving out',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> Written notice is required before moving out -- no exceptions.
> Month-to-month and fixed-term tenants: 30 days written notice required.

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date of Notice:** _______________________________________________

**Intended Move-Out Date:** ______________________________________

---

## Forwarding Address

**New Address:** _________________________________________________

**City / State / ZIP:** _____________________________________________

**Best Contact After Move-Out:** __________________________________

---

## Submission Method

- [ ] Submitted via AppFolio
- [ ] Certified mail
- [ ] Delivered to office in person

---

## Acknowledgment

I understand that:

- [ ] 30 days written notice is required
- [ ] Failure to give proper notice may result in additional rent charges or security deposit deductions
- [ ] I must schedule a move-out walkthrough with the office before my final day
- [ ] All keys, fobs, and access cards must be returned on or before my move-out date
- [ ] My security deposit will be returned (or itemized deductions provided) within 30 days of move-out, contingent on providing a forwarding address

**Tenant Signature:** _________________________ Date: __________

*Received by (Stanton Management):* _________________________ Date: __________
*30-day notice period ends:* __________`,
  },
  {
    id: 6,
    title: 'Forwarding Address Submission',
    department: 'property_management',
    description: 'Required for security deposit return',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> Your security deposit cannot be returned without a forwarding address on file.

---

**Tenant Name(s):** _______________________________________________

**Former Unit Address:** __________________________________________

**Move-Out Date:** _______________________________________________

---

## Forwarding Information

**New Mailing Address:** __________________________________________

**City / State / ZIP:** _____________________________________________

**New Phone Number:** ___________________________________________

**Email Address:** _______________________________________________

---

**Tenant Signature:** _________________________ Date: __________

*Received by (Stanton Management):* _________________________ Date: __________
*Deposit return deadline:* __________ (30 days from move-out)`,
  },
  {
    id: 7,
    title: 'Lease Renewal / Non-Renewal Notice',
    department: 'property_management',
    description: 'Tenant intent to renew or vacate at lease end',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Current Lease End Date:** _______________________________________

**Date of Notice:** _______________________________________________

---

## Section A -- For Tenant Use

**I intend to:**

- [ ] **Renew my lease** for another term. I understand new lease terms will be provided by the office.
- [ ] **Not renew my lease.** I will vacate on or before: __________________________
  *(This also serves as my 30-day written notice if submitted at least 30 days prior to lease end)*

**Forwarding Address (if not renewing):** ___________________________

---

## Section B -- For Management Use (Renewal Offer)

**New Lease Term:** _____________________________________________ to _________________

**New Monthly Rent:** $__________________________________________

**Rent Change:** [ ] No change [ ] Increase [ ] Decrease

**New Terms / Notes:**

_______________________________________________

**Offer Expiration Date:** _________________________________________

---

**Tenant Signature:** _________________________ Date: __________

**Stanton Management Representative:** _________________________ Date: __________`,
  },

  // MAINTENANCE FORMS
  {
    id: 8,
    title: 'Maintenance Request (Paper Backup)',
    department: 'maintenance',
    description: 'Paper form for maintenance requests when app/portal unavailable',
    path: '/maintenance-request',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> **Preferred submission:** AppFolio app/portal or call (860) 993-3401 -> Press 2
> Use this paper form only if you cannot access those channels.

---

**Tenant Name:** _________________________________________________

**Unit Address:** _________________________________________________

**Date Submitted:** ______________________________________________

**Best Phone / Contact:** _________________________________________

---

## Issue Description

**Location in unit (e.g., kitchen, bathroom 1):** _____________________

**Description of issue:**

_______________________________________________
_______________________________________________
_______________________________________________

**Is this an emergency?** [ ] Yes -- I have also called (860) 993-3401 -> Press 2 [ ] No

**Photos attached?** [ ] Yes [ ] No

---

## Entry Authorization

- [ ] You have permission to enter my unit if I am not home during standard hours (Mon-Fri, 8 AM-6 PM)
- [ ] I require advance notice and must be present -- please call me first at: __________________
- [ ] I have a pet in the unit -- please be aware: _______________________________________________

---

**Tenant Signature:** _________________________ Date: __________

*For office use:*
Work order created: __________ By: __________ Date: __________`,
  },
  {
    id: 9,
    title: 'Lock / Key Replacement Authorization',
    department: 'maintenance',
    description: 'Request and authorize charges for lost keys or lock changes',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date:** ________________________________________________________

---

## Reason for Request

- [ ] Lost key(s)
- [ ] Lost key fob(s)
- [ ] Damaged key(s)
- [ ] Lock change requested (security concern -- describe below)
- [ ] Other: ___________________________________________________

**Details:** _______________________________________________

---

## Items Needing Replacement

| Item | Quantity | Estimated Cost | Approved |
|---|---|---|---|
| Unit key | | | |
| Mailbox key | | | |
| Key fob / access card | | | |
| Lock re-key / change | | | |

**Total estimated cost to tenant:** $________________________________

---

## Authorization

I authorize Stanton Management to charge the cost of replacement to my account.

**Tenant Signature:** _________________________ Date: __________

**Stanton Management Representative:** _________________________ Date: __________`,
  },
  {
    id: 10,
    title: 'After-Hours Lockout Acknowledgment',
    department: 'maintenance',
    description: 'Acknowledge tenant responsibility for after-hours lockouts',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name:** _________________________________________________

**Unit Address:** _________________________________________________

**Date / Time of Lockout:** _______________________________________

---

## Acknowledgment

I understand the following:

- [ ] After-hours lockouts are my responsibility to resolve
- [ ] I must hire a licensed locksmith at my own expense
- [ ] Stanton Management is not responsible for after-hours lockout costs
- [ ] If I lose my key, I must report it to the office on the next business day
- [ ] If a security concern exists, a lock change may be required at my expense

**Locksmith used (if known):** _____________________________________

**Estimated cost:** $______________________________________________

---

**Tenant Signature:** _________________________ Date: __________

*Acknowledged by (office, if during hours):* _________________________ Date: __________`,
  },
  {
    id: 11,
    title: 'Bulk Item Disposal Request',
    department: 'maintenance',
    description: 'Request approval before disposing furniture or large items',
    path: '/bulk-disposal',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> Do not leave furniture, appliances, or large items curbside or near dumpsters without prior approval. Doing so may result in a fine and removal fee.

---

**Tenant Name:** _________________________________________________

**Unit Address:** _________________________________________________

**Date of Request:** ______________________________________________

---

## Items for Disposal

| Item Description | Quantity | Notes |
|---|---|---|
| | | |
| | | |
| | | |
| | | |

**Requested disposal date:** _______________________________________

---

*For office use:*
Approved: [ ] Yes [ ] No -- Reason: _______________________________
Scheduled pickup: __________ Notes: _____________________________
Staff initials: __________`,
  },

  // COMPLIANCE FORMS
  {
    id: 12,
    title: 'Pet Approval Request / Pet Addendum',
    department: 'compliance',
    description: 'Request approval to keep a pet in the unit',
    path: '/pet-approval',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date of Request:** ______________________________________________

---

## Pet Information

| | Pet 1 | Pet 2 |
|---|---|---|
| Type of Animal | | |
| Breed | | |
| Name | | |
| Weight (lbs) | | |
| Age | | |
| Spayed / Neutered? | | |
| Up to date on vaccines? | | |

---

## Terms & Conditions

By signing below, the tenant agrees to the following:

- Pets must remain approved and on file -- adding a new pet requires a new request
- Tenant is fully responsible for any and all damage caused by their pet
- Tenant is responsible for ensuring their pet does not disturb neighbors
- Unauthorized pets are a lease violation and subject to immediate action
- A pet deposit of $____________ is required prior to the pet occupying the unit
- Monthly pet fee of $____________ applies (if applicable per lease addendum)

---

**Tenant Signature:** _________________________ Date: __________

**Stanton Management -- Approved / Denied:** _________________________ Date: __________

**Notes:** _______________________________________________`,
  },
  {
    id: 13,
    title: 'Extended Guest Disclosure',
    department: 'compliance',
    description: 'Disclose guests staying more than 14 consecutive days',
    path: '/guest-disclosure',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date of Submission:** ___________________________________________

---

## Guest Information

**Guest Name:** _________________________________________________

**Relationship to Tenant:** _______________________________________

**Expected Arrival Date:** ________________________________________

**Expected Departure Date:** ______________________________________

**Estimated Length of Stay:** _____________________________________

---

## Acknowledgment

- [ ] I understand that guests staying more than 14 consecutive days must be disclosed to the office
- [ ] I understand that guests may not use the unit as a permanent residence without being added to the lease
- [ ] I am responsible for my guest's behavior in the unit and all common areas at all times
- [ ] If this guest requires a lease amendment, I will contact the office to discuss

---

**Tenant Signature:** _________________________ Date: __________

**Received by (Stanton Management):** _________________________ Date: __________

**Notes:** _______________________________________________`,
  },
  {
    id: 14,
    title: 'Common Area Violation Warning',
    department: 'compliance',
    description: 'Notice of violation in common areas with fine details',
    path: '/common-area-violation',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Issued To (Tenant Name):** ______________________________________

**Unit Address:** _________________________________________________

**Date of Violation:** _____________________________________________

**Date of Notice:** _______________________________________________

---

## Violation Type

- [ ] Improper trash disposal -- Fine: Starting at $100
- [ ] Personal items left in hallway / stairwell -- Fine: Up to $300
- [ ] Cigarette butts outside designated containers -- Fine: Starting at $125
- [ ] Noise violation (common areas) -- Fine: Starting at $100
- [ ] Other: ___________________________________________________

---

## Description

_______________________________________________
_______________________________________________

**First offense** [ ] **Repeat offense** [ ] (Prior warning date: __________)

---

## Fine Issued

**Amount:** $___________________________________________________

**Added to account:** [ ] Yes Date: __________

---

## Required Action

_______________________________________________

**Compliance deadline:** _________________________________________

Failure to comply may result in escalating fines or lease action.

---

**Issued by (Stanton Management):** _________________________ Date: __________

*Tenant acknowledgment (optional):* _________________________ Date: __________
*Delivered by:* [ ] In person [ ] Posted on door [ ] Email Date: __________`,
  },
  {
    id: 15,
    title: 'Unauthorized Pet -- Cure Notice / Retroactive Approval',
    department: 'compliance',
    description: 'Notice for unauthorized pet with options to remove or apply for approval',
    path: '/unauthorized-pet',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Issued To (Tenant Name):** ______________________________________

**Unit Address:** _________________________________________________

**Date of Notice:** _______________________________________________

---

## Notice

It has come to our attention that you may have an unauthorized pet in your unit. Having a pet without prior written approval from Stanton Management is a lease violation.

**You have the following options:**

### Option A -- Remove the Pet

Remove the pet from the unit by: **__________________________ (date)**

Confirm removal in writing to the office.

### Option B -- Apply for Retroactive Approval

Complete and submit a Pet Approval Request (Form 4) within **5 business days** of this notice. Approval is not guaranteed. If approved, a pet deposit and any applicable fees will apply immediately.

---

**Tenant Response:**

- [ ] I will remove the pet by the date above
- [ ] I am applying for retroactive approval (Form 4 attached)
- [ ] I dispute that an unauthorized pet is present -- explanation: _____________________

---

**Tenant Signature:** _________________________ Date: __________

**Stanton Management Representative:** _________________________ Date: __________

*Outcome:* ___________________________________________________`,
  },
  {
    id: 16,
    title: 'Section 8 Recertification Checklist',
    department: 'compliance',
    description: 'Annual recertification requirements for Section 8 tenants',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Housing Authority:** ____________________________________________

**Housing Authority Case Worker:** _________________________________

**Housing Authority Phone:** ______________________________________

**Annual Recertification Due Date:** ________________________________

---

## Tenant Checklist

Complete and submit these items to your housing authority by your recertification deadline. Keep copies of everything.

**Income Verification**
- [ ] Current pay stubs (last 4-8 weeks, per housing authority requirement)
- [ ] Employer verification letter (if requested)
- [ ] Social Security / disability award letters (if applicable)
- [ ] Self-employment income documentation (if applicable)
- [ ] Any other income sources disclosed

**Household Composition**
- [ ] Updated list of all household members
- [ ] Birth certificates or IDs for any new household members
- [ ] Documentation for any household members who have left

**Asset Documentation**
- [ ] Bank statements (per housing authority requirement)
- [ ] Other asset documentation as requested

**Other**
- [ ] Signed recertification forms from housing authority
- [ ] Any additional forms requested by your case worker

---

## Changes to Report

You are required to report the following changes to your housing authority promptly:

- [ ] Change in income (new job, job loss, raise, benefits change)
- [ ] Change in household members (new person, someone leaving)
- [ ] Change in assets
- [ ] Any other change that may affect your eligibility or rent calculation

---

## Annual Inspection

Your unit will be inspected annually by the housing authority. Stanton Management will coordinate access.

**Last inspection date:** _________________________________________

**Next scheduled inspection:** ____________________________________

**Notes / Items to address before inspection:**

_______________________________________________
_______________________________________________

---

**Tenant Signature:** _________________________ Date: __________

**Stanton Management Representative:** _________________________ Date: __________

*Copy provided to tenant:* [ ] Yes Date: __________`,
  },

  // FINANCE FORMS
  {
    id: 17,
    title: 'Cash Payment Appointment Request',
    department: 'finance',
    description: 'Schedule appointment for cash rent payment (no walk-ins)',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> We do not accept walk-in cash payments. Cash is accepted by appointment only.

---

**Tenant Name:** _________________________________________________

**Unit Address:** _________________________________________________

**Date of Request:** ______________________________________________

**Payment Amount:** $____________________________________________

**Payment For (month/period):** ___________________________________

**Requested Appointment Date(s):** ________________________________

**Best Contact Number:** _________________________________________

---

*For office use:*
Appointment confirmed: __________ Time: __________ Staff: __________
Receipt issued: [ ] Yes Receipt #: __________`,
  },
  {
    id: 18,
    title: 'PaySlip Request',
    department: 'finance',
    description: 'Request PaySlip barcode to pay rent at retail locations',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> PaySlip lets you pay rent with cash at CVS, Walmart, 7-Eleven, and other participating stores.
> The office generates your barcode -- you take it to the store and pay.

---

**Tenant Name:** _________________________________________________

**Unit Address:** _________________________________________________

**Date of Request:** ______________________________________________

**Payment Amount Needed:** $_____________________________________

**Payment For (month/period):** ___________________________________

**Best Contact (for delivery of barcode):** ___________________________

---

*For office use:*
PaySlip generated: __________ By: __________ Date: __________
Delivered to tenant: [ ] Yes Method: __________ Date: __________`,
  },
  {
    id: 19,
    title: 'Tenant Billing Dispute Form',
    department: 'finance',
    description: 'Formally dispute charges or security deposit deductions',
    path: '/billing-dispute',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

> Use this form to formally dispute a charge on your account, including security deposit deductions or service call billings. Submit within 15 days of receiving the charge or deposit statement.

---

**Tenant Name(s):** _______________________________________________

**Unit Address (or former address):** _______________________________

**Date of Dispute:** ______________________________________________

**Date Charge Was Received:** ____________________________________

---

## Charge Being Disputed

**Charge Description:** ___________________________________________

**Amount Disputed:** $___________________________________________

**Charge Date:** _________________________________________________

---

## Basis for Dispute

- [ ] The damage was pre-existing and documented on my move-in inspection form
- [ ] The charge does not reflect normal wear and tear
- [ ] I was not given proper notice before entry / repair
- [ ] The amount charged is incorrect -- I believe the correct amount is $__________
- [ ] Other: ___________________________________________________

**Supporting Documentation Attached:**
- [ ] Move-in inspection form
- [ ] Photos
- [ ] Receipts
- [ ] Other: ___________________________________________________

**Explanation:**

_______________________________________________
_______________________________________________
_______________________________________________

---

**Tenant Signature:** _________________________ Date: __________

*Received by (Stanton Management):* _________________________ Date: __________
*Response due by:* __________
*Outcome:* ___________________________________________________`,
  },
  {
    id: 20,
    title: 'Reimbursement Request',
    department: 'finance',
    description: 'Submit reimbursement details and supporting documentation',
    path: '/reimbursement',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name:** _________________________________________________

**Unit Address:** _________________________________________________

**Date of Request:** ______________________________________________

---

## Reimbursement Details

**Amount Requested:** $____________________________________________

**Reason for Reimbursement:** _____________________________________

**Description / Notes:**

_______________________________________________
_______________________________________________

**Receipts Attached:** [ ] Yes [ ] No

---

**Tenant Signature:** _________________________ Date: __________

*For office use:* Approved [ ] Denied [ ] Amount: $__________ Date: __________`,
  },
  {
    id: 21,
    title: 'Tenant Assessment',
    department: 'property_management',
    description: 'Hartford market quick assessment for prospective tenants',
    path: '/tenant-assessment',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Assessment**

Use the live form for full submission workflow and voice notes.

Route: /tenant-assessment

---

**Summary Fields**
- Basic Information
- Quick Observations / Red Flags
- Housing, Kids/Pets, Employment, Local Connections
- Agent Assessment + Recommendation
`,
  },
  {
    id: 22,
    title: 'Vehicle & Parking Addendum',
    department: 'compliance',
    description: 'Register vehicle and parking permit',
    path: '/vehicle-addendum',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date:** ______________________________________________

---

VEHICLE & PARKING ADDENDUM TO RENTAL AGREEMENT

You understand that parking is not included with this Lease and that we may or may NOT allow you to park your vehicles on the property. We reserve the right to restrict, condition, or revoke any prior authorization given at any time.

You also acknowledge that if we allow you to park on the property, you must register your vehicle with us and pay parking fees as follows:

PARKING FEES: $50 per vehicle per month

PERMIT LIMIT: Each tenant is limited to one (1) parking permit. Additional permits may be available on a first-come, first-served basis after all tenants in the building have had the opportunity to obtain their first permit. Not all buildings allow a second permit. Contact the office for availability.

TERMS AND CONDITIONS

All authorized vehicles shall be parked in a designated parking spot, and you will not block or impede us or any other tenants' access to the parking lot or driveways. We may, in our discretion, designate parking areas specific to mopeds, motorcycles and motorized scooters.

If we authorize your vehicle and you elect to park on the property you agree that we are not liable for any damage, theft, or accident suffered or caused by your vehicle. You agree to indemnify and hold us harmless for any injury to person or property caused by your vehicle.

If your vehicle damages any property or damages the parking lot, you will be responsible for all costs we incur in correcting said damage.

DAMAGE FEES:
- Parking lot damage: Cost of repair + $250 administrative fee
- Property damage: Full cost of repair

You understand and agree that you will not park any disabled, significantly damaged, or other defective vehicles on the Property. You agree and acknowledge that you will provide us with proof of insurance and registration for any vehicles we authorize you to park on the property.

WE RESERVE THE RIGHT TO TOW ANY VEHICLES ON THE PROPERTY AT YOUR COST WITH OR WITHOUT PRIOR NOTICE IN OUR SOLE AND ABSOLUTE DISCRETION.

The parking permit must be displayed on the upper driver's side of the windshield at all times.

---

**Vehicle Information:**
Make: ______________ Model: ______________ Year: __________
Color: __________ License Plate: _________________________

---

**Tenant Signature:** _________________________ Date: __________

**Stanton Management -- Approved / Denied:** _________________________ Date: __________

**Notes:** _______________________________________________`,
  },
  {
    id: 23,
    title: 'Renters Insurance Information',
    department: 'compliance',
    description: 'Insurance requirements and Additional Insured details',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**RENTERS INSURANCE REQUIREMENT**

---

**Tenant Name(s):** _______________________________________________

**Unit Address:** _________________________________________________

**Date:** ________________________________________________________

---

## Why Renters Insurance is Required

Renters insurance protects your personal belongings and provides liability coverage for unexpected events such as:
- Theft or damage to your personal property
- Fire or water damage to your belongings
- Liability if a guest is injured in your unit
- Liability if your pet causes injury

---

## Insurance Requirements

Your policy must include:
- **Minimum Liability Coverage:** $100,000 ($300,000 if you have pets)
- **Your unit address** listed on the policy
- **Additional Insured:** See your building's LLC below

---

## Your Building's Additional Insured Information

**Additional Insured Name:**
{{llc_name}}

**Additional Insured Address:**
{{llc_address}}

---

## Two Options

### Option 1: Get Your Own Insurance
Purchase from any insurance provider (Lemonade, GEICO, State Farm, etc.)
- Cost: Typically $10-25 per month
- You manage it directly
- Must provide proof of coverage showing requirements above

### Option 2: Stanton Management Partnership
We can enroll you through our partnership with Appfolio Renters Insurance
- Cost: $10-25 per month (added to rent)
- Managed automatically
- No separate bills to track

---

**Tenant Signature:** _________________________ Date: __________

**Received by (Stanton Management):** _________________________ Date: __________`,
  },
  {
    id: 24,
    title: 'How to Add Additional Insured (Step-by-Step)',
    department: 'compliance',
    description: 'Simple instructions for adding LLC to insurance policy',
    content: `**Stanton Management LLC**
421 Park Street, Hartford, CT 06106 | (860) 993-3401

---

**HOW TO ADD ADDITIONAL INSURED TO YOUR RENTERS INSURANCE**

**Step-by-Step Instructions**

---

**What You Need:**

The information below (already filled in for your building):
- Additional Insured Name: **{{llc_name}}**
- Additional Insured Address: **{{llc_address}}**

---

## STEP 1: Log Into Your Insurance Account

Go to your insurance company's website or app:
- **Lemonade**: lemonade.com -> Log in
- **GEICO**: geico.com -> Log in
- **State Farm**: statefarm.com -> Log in
- **Allstate**: allstate.com -> Log in
- **Other companies**: Use their website or app

---

## STEP 2: Find the Right Section

Look for one of these options in your account:
- "Edit Policy"
- "Additional Insured"
- "Add Interest" or "Interested Party"
- "Policy Details" or "Manage Policy"

**Can't find it?** Call your insurance company and say: *"I need to add an Additional Insured to my renters policy"*

---

## STEP 3: Enter This Information

When the form asks for Additional Insured details, enter **EXACTLY**:

**Name/Company:**
{{llc_name}}

**Address:**
{{llc_address}}

**Relationship:** Landlord

---

## STEP 4: Confirm & Get Proof

After you add it:
1. **Download** or **screenshot** your updated policy showing the Additional Insured
2. **Bring it to the office** OR **email to**: info@stantonmgmt.com

---

## YOUR BUILDING'S ADDITIONAL INSURED INFORMATION

**Copy this information exactly:**

**Additional Insured Name:**
{{llc_name}}

**Additional Insured Address:**
{{llc_address}}

---

## STILL STUCK? WE CAN HELP

**Option 1:** Bring your phone/laptop to the office during pickup hours and we'll walk you through it

**Option 2:** Call your insurance company and tell them:
"I need to add an Additional Insured. The name is {{llc_name}} and the address is {{llc_address}}"

**Option 3:** Choose our partnership insurance (we handle everything) - ask at the office

---

**Questions?** Call (860) 993-3401 or visit the office Mon-Fri 9 AM - 5 PM`,
  },
];

export function getFormsByDepartment(department: Department): TenantForm[] {
  return tenantForms.filter(form => form.department === department);
}

export function getFormById(id: number): TenantForm | undefined {
  return tenantForms.find(form => form.id === id);
}

export function searchForms(query: string): TenantForm[] {
  const lowerQuery = query.toLowerCase();
  return tenantForms.filter(
    form =>
      form.title.toLowerCase().includes(lowerQuery) ||
      form.description.toLowerCase().includes(lowerQuery)
  );
}

export function getLLCForAddress(address: string): string {
  const entry = llcTable.find(([building]) => 
    address.toLowerCase().includes(building.toLowerCase())
  );
  return entry ? entry[1] : 'Contact office for Additional Insured information';
}
