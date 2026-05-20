# Form Execution Plan — From Pilot to HAP Executed

**Date:** May 14, 2026
**Author:** Alex
**Status:** Active plan — pilot validated, system build in progress
**Reads with:** `NORTH_STAR.md`, `docs/05-pbv-form-execution_prd_2026-05-14.md`

---

## What This Document Is

This is the strategic plan for how form execution actually works in FormsStanton, now that the architecture has been validated. It explains the system in terms of the tenant's experience, not the data model. It connects what we're building to the North Star pipeline.

If you want the build spec, read the PRD. If you want the evidence behind the architecture choice, read the status memo. This document is the *why* and the *how it feels*.

---

## The Bottleneck We Just Solved

The North Star pipeline has seven stages. Stages 1–5 are built. The gap was Stage 6: the post-approval signing packet. Inside Stage 4 (PBV full application) was a related sub-bottleneck — getting 33 documents filled, signed, and submitted to HACH without losing the tenant somewhere in the middle.

Both bottlenecks live in the same operational reality: a lot of federal paperwork, a tenant who has limited time and limited English, and a reviewer at HACH who needs documents that look like the federal forms they recognize. The legacy answer to that reality is in-person, hour-long meetings where staff hand-fills forms with the tenant. That's how the prior owners did it. It doesn't scale, it loses paperwork, and it's the largest single drag on getting to `hap_executed`.

We tried solving this with HTML rendering — recreating each form as HTML and CSS so we could control the fill experience. That approach failed for reasons documented in the status memo. The short version: recreating federal forms is a typography arms race we can't win, and we'd spend 80% of our effort recreating the part of each form that never changes.

The architecture that works is PDF overlay. We keep HACH's authoritative form as the canvas, unmodified, and stamp only the tenant's variable data on top — name, date, signature image, checkbox marks. The output PDF *is* HACH's form, with the tenant's data on it. Perfect fidelity by definition, because we never recreated anything.

The pilot proved this works for the simplest form in the packet. The architecture and the toolchain that produced it generalize to the other forms.

---

## How The System Works Now

Three phases, from the tenant's perspective. Not 33 documents. Not 14 forms. Three phases.

**Phase 1 — Information gathering.** The tenant fills one continuous intake organized into sections (household, income, assets, criminal history, etc.). They never see form names. They never type anything twice. Their answers map invisibly to every form that needs them.

**Phase 2 — Review and sign.** When intake is complete, the system generates all the forms the tenant needs to sign as Head of Household, with their data already stamped on. They review what's in their package and sign once. That signature is applied to every form they're authorized to sign.

**Phase 3 — Other adults sign.** For any other adult in the household (spouse, adult children), the system generates their portion of the package and they sign. Default: same device, handed across the kitchen table. Magic-link-per-adult only for dispersed households.

That's it. Three phases, one device in most cases, one signing ceremony per signer.

The complexity of "33 documents, 14 forms, multi-signer scopes, mutually-exclusive child-support affidavits, conditional VAWA forms, federal vs HACH-specific forms" is real but lives entirely on the system side. The tenant doesn't see it.

---

## Maria's Journey

Let me make this concrete. Maria is 34, two kids, works two part-time jobs. Husband works construction. Adult son lives at home, works retail. Primary language Portuguese. She has a 4-year-old Android phone with a cracked screen, spotty data, and twenty minutes between her shifts.

**Day 1, 2pm — McDonald's parking lot.**
Maria gets a text from Stanton: link to start her PBV application. She taps it. The portal loads in Portuguese — she didn't choose, it just opened that way because her tenant profile is marked `preferred_language: pt`. A short intro explains what this is and what it could mean for her rent. She taps "Começar."

**2:01–2:14pm.**
She fills the household section. Names her husband and adult son. Adds her two younger kids. Birthdates, SSNs, relationships. The portal asks who works — she taps herself and her husband. Asks if anyone is in school full-time — no. Citizenship — yes for everyone. She gets through about a third of the intake. Her shift starts at 2:15. She closes the app.

The system has saved her progress automatically. Nothing lost.

**Day 1, 9pm — couch at home.**
Same SMS link, tapped again. Drops her exactly where she was — household section complete, income section open. She enters her two jobs (employer, weekly paystub amounts), her husband's job. Assets — small savings account, no real estate. Expenses, since the household has very limited income. About 25 minutes total. She's done.

The portal shows: "You've answered all our questions. Next, we'll prepare your documents for review."

**Day 2, 8am — kitchen table, before husband leaves for work.**
Maria opens the portal again. It shows: "Your application is ready to review. You will need to sign 11 documents. Most of them are routine federal forms. We've prepared a one-page Portuguese summary of what's in your package — please read it first."

She reads the Portuguese summary. One page, plain language, in her language. It says what PBV is, what she's agreeing to, what the package contains, and notes that the signed documents will be in Spanish because that's the language HACH accepts the federal forms in. The summary itself is the document she'll sign that proves she understood what she signed up for.

She taps "I have read this and I understand." Signs the summary with her finger.

The portal shows her a stack: 11 form previews, each with her data already filled in. She can tap any of them to see the full form. She skims a few. They're in Spanish but the data is hers and it's correct. The portal also shows, for each form, a one-line Portuguese summary of what it is.

She taps "Sign all of these." Draws her signature once. The system stamps that signature onto every form she's the required signer for. The signing ceremony took 90 seconds.

**8:05am.**
Portal says: "Your husband and adult son also need to sign some of these documents. They can sign on this phone now, or we can send them their own links."

She taps "Now, on this phone." Hands the phone to her husband, who's eating breakfast. He sees a short Portuguese summary: "You are signing as an adult household member of Maria's PBV application. Here are the documents you need to sign." He reviews. Draws his signature. The system identifies him as the signer via his typed name + the signature + a timestamp + the IP.

Maria takes the phone back, goes to her son's room, hands it to him. He signs. Done.

**8:08am.**
Portal: "Your application is complete. We've sent it to HACH for review. We'll keep you updated."

Total elapsed tenant time across two days: about 50 minutes. Three signing events. One device. No printer, no in-person meeting, no caseworker driving across town.

The submitted package, on the HACH reviewer's side: 11 Spanish-language federal forms with Maria's data stamped on, the Portuguese summary document Maria signed, the signature audit trail, and a note at the top of the package: **"Primary language: Portuguese. Spanish-speaking staff recommended for follow-up."**

The reviewer at HACH opens the package. The forms look like the forms they know. The data is in the right boxes. The signature blocks are signed. They can process this in twenty minutes.

---

## How This Gets Us To HAP Executed

Stage-by-stage, here's where this build moves the pipeline.

**Stage 4 (PBV full application) — accelerated from weeks to days.**
The legacy approach is in-person meetings, paper packets, recurring follow-ups for missing documents, multiple iterations to get the package right. Time-to-submission: routinely 4–8 weeks per household. With this system, time-to-submission is bounded by how fast the tenant fills the intake. For most households, that's 1–3 days of elapsed time, 45–90 minutes of actual tenant time.

The system also closes the "missing documents" failure mode at the source. The intake won't let a tenant submit without complete data because the next phase requires it. The summary doc and the pre-stamped forms force the tenant to confront any errors before submission, not after HACH rejects them.

**Stage 5 (HACH reviews) — accelerated from variable to predictable.**
HACH reviewers handle whatever PHAs send them. Stanton currently sends paper packages, often incomplete, sometimes in the wrong language combination, sometimes with handwritten data in fields they have to interpret. This system sends typed data on the federal forms HACH recognizes, in a language HACH accepts, with a Portuguese summary attached as defensive evidence, and a clear language flag for follow-up. Less reviewer friction = faster turnaround.

[Inference] We can't promise HACH approves faster — that's their process — but we can guarantee we're not the bottleneck.

**Stage 6 (post-approval signing packet) — designed in from day one.**
The PRD that's about to land specifies that the Phase 2 / Phase 3 signing mechanism is reusable. The forms that need to be signed at Stage 6 (lease, tenancy addendum, HAP contract, lead paint, move-in inspection) plug into the same system. Tenant fills any new information once; signatures route through the same ceremony. No new architecture, no new tenant learning curve.

**Stage 7 (HAP executed) — the system is the record.**
Every signature, every document, every timestamp, every IP, every language preference, every audit trail event lives in our database and in our PDF storage. When HACH asks for proof of consent, we hand it over. When a tenant disputes what they signed, we show them. When Stanton needs to demonstrate good-faith dealing in a fair-housing review, the Portuguese summary doc is the artifact that does that work.

There is no shoebox of paperwork. There is no "did we send that yet" email thread. The pipeline state is queryable.

---

## What's Still Ahead

The pilot solved one form, one language, one signer. The remaining build is mechanical execution against an architecture that's now known to work. Sequenced:

1. **Visual verification toolchain.** Install pymupdf into the dev environment so Cascade can render any stamped PDF to PNG and verify visually, not just analytically. Five-minute change, removes a manual review dependency per form.

2. **Coordinate maps for the remaining 13 forms × 2 languages.** ~28 field maps to produce, estimated 30–60 minutes per form via the pdfminer playbook. The complex forms (Citizenship Declaration with tabular per-row signatures, Obligations of Family with multi-field signature block) will take longer; the simple ones will take less.

3. **Phase 1 intake UI.** Sectioned, Portuguese/Spanish/English, save-and-resume, mobile-first. The interactive layer over the data model. This is where the tenant lives for most of the experience.

4. **Phase 2 review-and-sign UI.** The stack-of-forms-with-summaries view, signature capture, one-tap-sign-all. The legal moment.

5. **Phase 3 additional-adult signing.** Same-device default, magic-link-per-adult fallback. Identity-on-signer capture (typed name, signature, IP, timestamp).

6. **Portuguese / Spanish / English summary document content.** Authored by Alex + Dan, not Cascade. Three documents, ~1 page each. The content is the slowest piece because it has to land tonally.

7. **Reviewer-side language flag display.** Small UI addition to the HACH reviewer portal. Already designed; just needs build.

8. **End-to-end test with a sample household.** Before live, run a synthetic Maria-Garcia-Rodriguez through the entire flow. Confirm the package HACH sees is what we think it is.

This is roughly a 2–3 week build with the pilot architecture proven. Six weeks ago, with the HTML approach, this was a 2–3 month build with uncertain success.

---

## What This Is Not

Worth being honest about scope:

This system does not get a tenant *approved* by HACH. That's HACH's decision. We get them to a complete, professional-quality submission. What HACH does next is upstream of us.

This system does not eliminate staff involvement. Will at the lobby is still the right answer for households that can't or won't complete the digital flow alone. The system supports staff-assisted mode where Will is logged in but the signature is the tenant's. For the 30% of cases where the tenant needs hands-on help, the system makes that help cheaper and faster, but it doesn't remove the help.

This system does not solve the upstream Stage 3 problem (PBV pre-application screening). That's already built and out of scope here.

This system does not handle the long-tail of edge cases — VAWA-specific forms, Reasonable Accommodation requests, complex household compositions, contested signatures — without staff judgment. The system flags these cases and routes them to staff. It doesn't pretend to automate them.

---

## How To Read This Plan

If you are Dan: the next conversation is in `docs/project-knowledge/dan-hach-decision-log_2026-05-14.md`. Three decisions block production. We can have that conversation in 30 minutes.

If you are a future Cascade session: the next action is in `docs/project-knowledge/pdf-overlay-build-handoff_2026-05-14.md`. The PRD is your build spec.

If you are future-Alex: the path is clear, the architecture is proven, the bottleneck is content (summary docs) and coordination (Dan and HACH confirmations), not engineering. Don't lose momentum.
