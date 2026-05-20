# Tenant Requirements — Plain Language

_Last updated: 2026-05-14_

> The 33 things a tenant has to produce or do to complete a PBV application, written for the tenant — not for an engineer.
>
> **Audience:** UX/copy work; the engineer who needs to design tenant-facing screens; staff onboarding a tenant.
> **Source of truth for the technical version:** `docs/document-inventory.md` and the seed migration `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`.

---

## The two kinds of work

Tenants do two different kinds of work in the application. The progress UI must show these separately.

| Kind | What it means | Where it happens | How the tenant fails |
|---|---|---|---|
| **Forms** (14) | Read a form, fill in a few fields, sign your name. | Inside the app. | Skipping a field. Not signing. One adult forgetting to sign their copy. |
| **Documents** (19) | Upload a paper/digital document you already have or can get. | Inside the app, but the document comes from real life. | Wrong document. Too old. Missing pages. Wrong member. |

The two failure modes are different and need different help.

---

## How many of each apply to a tenant

Numbers depend on household size and what kinds of income/situations the household has. Walking through what triggers what:

- **Forms** scale by number of adults (18+) in the household. A 1-adult household sees ~11 forms. A 2-adult household sees ~22. Plus 0–2 conditional forms (domestic violence, accommodation request).
- **Documents** scale by who earns what kind of income, who is non-citizen, and whether the household claims certain deductions. A simple 1-person household with one job and a checking account sees ~3–4 documents. A complex 4-adult household with mixed income and immigration paperwork might see 20+.

The tenant should never have to do this math. The system seeds the right slots based on the answers they give in intake.

---

# FORMS — Things the tenant fills and signs in the app

All forms below are "per adult" unless noted. **Every adult (18+) in the household signs their own copy.** Two forms toggle based on the answer ("yes child support" or "no child support" — they sign one, not both). Two forms are conditional and only appear if a flag is set.

## Required for every adult

### 1. Main Application and Attestation
**What it is:** The cover sheet of the PBV application. Confirms everything the household is telling HACH — who lives there, what they earn, what they own — is true.
**What the tenant does:** Reviews the summary of their intake answers, signs at the bottom.
**Adult-level:** Each adult signs their own.

### 2. HUD-9886-A — Permission for HUD to Verify Income
**What it is:** Federal form. Gives HUD and the housing authority permission to check the tenant's income with employers, banks, Social Security, etc. This is how HACH confirms what the tenant said about money.
**What the tenant does:** Enter their name and Social Security number, read the consent paragraph, sign.
**Adult-level:** Each adult.

### 3. HACH Release — Permission for HACH to Verify Information
**What it is:** Same idea as #2 but for HACH (the Hartford housing authority) specifically. Lets HACH contact landlords, employers, schools.
**What the tenant does:** Read, sign.
**Adult-level:** Each adult.

### 4. Criminal Background Release
**What it is:** Permission for HACH to run a criminal background check.
**What the tenant does:** Enter name and address, sign.
**Adult-level:** Each adult.

### 5. Citizenship Declaration
**What it is:** Tells HACH each person's citizenship status — citizen, eligible non-citizen, or not eligible. Non-citizens may need to upload immigration documents separately.
**What the tenant does:** Pick the right status for each household member, sign.
**Adult-level:** Each adult.

### 6. Child Support Affidavit (one of two)
**What it is:** A sworn statement about child support. The tenant signs either "I receive or pay child support" (and gives details) OR "no one in the household receives or pays child support."
**What the tenant does:** Answer the trigger question in intake; the system shows them the right one of the two affidavits.
**Adult-level:** Each adult.

### 7. Obligations of Family
**What it is:** Acknowledges the rules of being a voucher holder — keep the unit clean, allow inspections, report income changes, no unauthorized people living there, etc.
**What the tenant does:** Read, sign.
**Adult-level:** Each adult.

### 8. Family Certification of Briefing Documents Received
**What it is:** Confirms the tenant received the briefing packet from HACH (informational documents about the voucher program). This is a "yes I got this" form, not a fill-in form.
**What the tenant does:** Read, sign.
**Adult-level:** Each adult.

### 9. Debts Owed to PHAs (HUD-52675)
**What it is:** Federal form. Confirms whether the tenant owes money to any housing authority anywhere (unpaid rent, fraud repayments, etc.). HACH will not approve someone with unpaid debts to another PHA.
**What the tenant does:** Read, sign. The form itself is an acknowledgment that the housing authority can check.
**Adult-level:** Each adult.

### 10. EIV Guide Receipt
**What it is:** Confirms the tenant received HUD's privacy notice about its income verification database (EIV). Required by federal regulation.
**What the tenant does:** Read, sign.
**Adult-level:** Each adult.

### 11. HUD-92006 — Supplemental Contact Form
**What it is:** Federal form. Lets the tenant give HACH a backup contact person (family member, caseworker) for cases where HACH can't reach them. Filling it in is optional but signing is required.
**What the tenant does:** Optionally fill in a contact person's name and phone, sign.
**Adult-level:** Each adult.

## Conditional forms — only appear if triggered

### 12. VAWA Certification (HUD-5382)
**What it is:** A protected disclosure for survivors of domestic violence, dating violence, sexual assault, or stalking. Activates federal housing protections.
**When it appears:** Only if the tenant answered yes to the domestic violence question in intake.
**What the tenant does:** Read, fill in details if comfortable, sign.
**Adult-level:** The individual who answered yes.

### 13. Reasonable Accommodation Request
**What it is:** A request for the housing authority to adjust rules or processes to accommodate a disability (e.g., extra time, accessible format, support person at meetings).
**When it appears:** Only if the tenant requested an accommodation in intake.
**What the tenant does:** Describe the accommodation needed, sign.
**Adult-level:** The individual requesting.

---

# DOCUMENTS — Things the tenant uploads from real life

These come from outside the app. The tenant takes a photo or finds a PDF, then uploads. **Freshness matters.** Old documents get rejected.

## Income — per person who earns it

The tenant tells the system in intake what kinds of income each household member has. The system then asks for the matching documents.

### 14. Paystubs
**Plain language:** "Your last 4 weekly paystubs (or last 2 if you get paid every two weeks)."
**Freshness rule:** Recent — must cover the last month.
**Whose:** Every working household member, including minors with jobs.
**Common failures:** Uploading one paystub instead of 4. Uploading paystubs from 6 months ago.

### 15. Pension or Railroad Retirement Award Letter
**Plain language:** "The letter from your pension fund or Railroad Retirement showing how much you get each month."
**Freshness rule:** Current year.
**Whose:** Each person who gets pension or railroad retirement income.

### 16. SSI Award Letter
**Plain language:** "The letter from Social Security showing your SSI (Supplemental Security Income) amount."
**Freshness rule:** Current year. SSI updates yearly.
**Whose:** Each person who gets SSI.

### 17. Social Security Award Letter
**Plain language:** "The letter from Social Security showing your monthly Social Security amount (retirement or disability)."
**Freshness rule:** Current year.
**Whose:** Each person who gets Social Security.

### 18. Child Support Order or Payment History (last 12 months)
**Plain language:** "Either the court order showing how much child support you receive, or a printout showing the payments you got over the last 12 months."
**Freshness rule:** Last 12 months of payments.
**Whose:** Each person who receives child support.

### 19. TANF / Food Stamps / Public Assistance Award Letter
**Plain language:** "The letter showing your benefits — could be SNAP (food stamps), cash assistance, or another DSS program."
**Freshness rule:** Current.
**Whose:** Each person whose name is on the benefits.

### 20. Unemployment / Workers Comp Award Letter
**Plain language:** "The letter showing your weekly unemployment or workers compensation amount."
**Freshness rule:** Current — must still be active.
**Whose:** Each person currently collecting.

### 21. Self-Employment Contract and Earnings Statement
**Plain language:** "If you work for yourself: any contract you have, plus a record of what you earned. This can be a profit-and-loss statement, your tax return, or a written record."
**Freshness rule:** Current year's earnings.
**Whose:** Each self-employed person.

### 22. Training Program / Grant Letter — *optional*
**Plain language:** "If you're in a job training program or got a grant, the letter showing it."
**Whose:** Each person in a training/grant program.

### 23. Digital Payment Statements (Cash App / Zelle / Venmo / PayPal) — *optional*
**Plain language:** "If you get paid through Cash App, Zelle, Venmo, or PayPal: 2 months of statements from those apps."
**Freshness rule:** Most recent 2 months.
**Whose:** Each person receiving payments this way.

## Banking and assets — per adult

### 24. Savings Account Statement (most recent month)
**Plain language:** "Your most recent monthly statement from your savings account."
**Freshness rule:** **The most recent one** — usually the one mailed/emailed last month. Bring up all the statements, pick the newest.
**Whose:** Each adult.
**Common failures:** Uploading a statement from earlier in the year. Uploading a screenshot of the current balance instead of a statement.

### 25. Checking Account Statement (most recent month)
**Plain language:** "Your most recent monthly statement from your checking account."
**Freshness rule:** Most recent month.
**Whose:** Each adult.

### 26. Insurance Settlement Letter — *optional*
**Plain language:** "If you got money from an insurance settlement (car accident, injury, etc.), the letter showing how much."
**When it appears:** Only if the tenant said yes to "have you received an insurance settlement."

### 27. CD, Trust, or Bond Statements — *optional*
**Plain language:** "If you have a CD, trust fund, or bonds, the most recent statement."
**When it appears:** Only if the tenant said yes to having any of these.

### 28. Life Insurance Policy Showing Cash Value — *optional*
**Plain language:** "If you have a life insurance policy with a cash value (whole life, not term), the page showing the cash value."
**When it appears:** Only if the tenant said yes to having cash-value life insurance.

## Medical and childcare — only if claiming a deduction

### 29. Doctor Bills (last 12 months) — *optional*
**Plain language:** "If you're claiming a medical deduction: every doctor bill from the last 12 months."
**When it appears:** Only if the tenant said yes to claiming a medical deduction.
**Freshness rule:** Last 12 months.

### 30. Pharmacy Statements (last 12 months) — *optional*
**Plain language:** "If you're claiming a medical deduction: every pharmacy statement from the last 12 months."
**Freshness rule:** Last 12 months.

### 31. Care 4 Kids / Childcare Documentation — *optional*
**Plain language:** "If you pay for childcare: the Care 4 Kids certificate (if you have one) or other proof of childcare costs."
**When it appears:** Only if the tenant said yes to having a childcare expense.

## Immigration — for non-citizen household members

### 32. Immigration Documents (I-551, I-94, I-688, or I-688B)
**Plain language:** "Your green card (I-551), arrival/departure record (I-94), employment authorization (I-688), or temporary resident card (I-688B). Photos of both sides if applicable."
**Whose:** Each non-citizen household member.

### 33. Proof of Age — Non-Citizen 62+ — *optional*
**Plain language:** "If you're a non-citizen 62 or older: a document showing your date of birth (passport, foreign birth certificate, etc.)."
**When it appears:** Only for non-citizens 62 or older.

---

## What "the right one" generally means

Recurring tenant failure modes from past 1-hour intake meetings:

- **Too old.** Bank statements older than the most recent month. Award letters from last year. Paystubs from the previous job.
- **Wrong format.** Screenshot of an app balance instead of a downloaded PDF statement. Photo of a phone screen showing one paystub.
- **Wrong member.** Joint-account statement that has someone else's name first; intake only listed one adult.
- **Incomplete.** Page 2 of a 3-page statement. Front of an ID with no back.
- **Wrong type.** Tax return uploaded when the slot asked for a paystub.

The system needs to either validate these at upload or make them obvious enough in the slot's plain-language label that the tenant gets it right the first time.

---

## What "the right way to fill a form" generally means

Recurring tenant failures from past in-person form sessions:

- Skipped a field that looked optional but isn't.
- Signed in the wrong place.
- One adult signed all the forms instead of each adult signing their own.
- Wrote a child's name where an adult's name was required.
- Tried to fill the form in a language they don't read.

The in-app form fill needs to: pre-fill what we already know, hard-block submission of incomplete fields, route each adult to their own copy, and offer the form in the language they picked at the start.

---

## Pointers

- Technical inventory: `docs/document-inventory.md`
- Seed migration: `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`
- North star: `docs/NORTH_STAR.md`
- Bilingual source PDFs for 12 of the 14 forms: `uploads/Full Application Package (5-28-2025 bilingual).pdf`
