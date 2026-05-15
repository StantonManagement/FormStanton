# Dan & HACH Decision Log — PBV Form Execution

**Date:** May 14, 2026
**For:** Dan Dvoskin (legal/operational decisions), HACH contact (program decisions)
**From:** Alex
**Reads with:** `form-execution-plan_2026-05-14.md`, `05-pbv-form-execution_prd_2026-05-14.md`

---

## How To Use This Document

Everything below is something I need an answer on. They're sorted by what they block. Read the **Blocking** section first — those three items are what's standing between us and going live. The rest can wait or come up later.

For each item: what the decision is, what I think the answer probably is, what the consequence is if I'm wrong. Where I have a default, the system will be built that way unless you tell me otherwise.

Goal of this document: one conversation, 30 minutes, get answers on the blocking items. Everything else we resolve as it comes up.

---

## Blocking Production

These three need answers before we go live with real tenants. None blocks engineering work — we can build on the defaults and adjust if needed — but they all block the moment we send the first real package to HACH.

### Decision 1 — HACH acceptance of stamped-PDF output

**The question:** Does HACH accept submission packages where the federal forms are HACH's source PDFs with tenant data digitally stamped on top? Or do they require traditionally-filled-in (handwritten, typed, or AcroForm-field) PDFs?

**Why it matters:** Our entire architecture stamps data onto unmodified source PDFs via pdf-lib. The output is the federal form with the tenant's data on top, signed digitally. If HACH wants a different output format, we have a rebuild on our hands.

**What I think:** [Inference] HACH will accept this. The output PDF is the federal form, byte-perfect for the static content, with data and signatures stamped at field positions. This is how DocuSeal, DocuSign, and every e-signature tool works. Federal ESIGN law treats these as equivalent to wet-ink signatures. [Unverified] HACH has not been formally asked.

**If I'm wrong:** Two fallbacks. (a) Use AcroForm fields if HACH wants "fillable" PDFs — pdf-lib supports this, modest rework. (b) Adopt DocuSeal (~$800/year) if HACH wants a specific e-signature platform's audit trail. Either way the rebuild is bounded; no architecture change needed.

**What I need from HACH (via Dan or direct):** A short conversation, or even an email: *"If we submit PBV application packages as the HACH source PDFs with tenant data and signatures stamped onto them digitally, with an audit trail showing signer identity, IP, timestamp, and document hash, will you accept this format?"*

**Recommended owner:** Dan to broker the conversation with HACH contact.

---

### Decision 2 — Portuguese-UI with Spanish-output flow

**The question:** Is HACH comfortable with the model where a Portuguese-speaking tenant interacts with the application in Portuguese (Portuguese UI, Portuguese summary document) but the submitted federal forms are in Spanish (HACH's officially translated federal forms)?

**Why it matters:** HACH doesn't have Portuguese-translated federal forms. Neither does DC Housing, neither does HUD federally. Hartford has a meaningful Portuguese-speaking population (Brazilian + Cape Verdean). The choice is: skip Portuguese entirely (bad for our tenants), commission Portuguese translations of every federal form (expensive, slow, may not be accepted), or do the dual-language approach where comprehension happens in Portuguese and the legal artifact is in Spanish.

**What I think:** [Inference] HACH will accept this with the safeguards in place. Our model has three: (a) Portuguese UI throughout intake and review — comprehension in the tenant's actual language; (b) a Stanton-authored Portuguese summary document the tenant signs, demonstrating informed consent in Portuguese; (c) a clear language flag on the package telling HACH reviewers to use Spanish-speaking staff for follow-up. The federal forms themselves are HACH's own Spanish translations — same instrument, same content as English, accepted federally.

**If I'm wrong:** We commission professional Portuguese translations of every federal form ($1,500–3,000 estimated) and have HACH approve them. Slower but doable.

**What I need:** A conversation about this specific structure with HACH. Specifically: *"For Portuguese-speaking households, we propose using your Spanish-translated federal forms as the legal artifact, with a Portuguese-language tenant UI and a Portuguese summary document signed by the tenant demonstrating informed consent. Is this acceptable, and is there anything we should adjust about the Portuguese summary document for it to do the work we need it to?"*

**Recommended owner:** Dan to raise. Could be combined with Decision 1 conversation.

---

### Decision 3 — Bulk-sign vs per-form-sign

**The question:** When the tenant signs in Phase 2, can they sign once and have that signature applied to all forms they're authorized to sign? Or does HACH require visible per-form signing (one signature ceremony per form)?

**Why it matters:** A typical PBV submission has the tenant as HOH signing 6–10 forms. Per-form signing means 6–10 separate signature events on the tenant's screen. Bulk-sign means 1. The legal weight is identical under ESIGN — both ceremonies establish intent to be bound to each document. The question is whether HACH's audit standards require visible per-form ceremonies.

**What I think:** [Inference] HACH will accept bulk-sign. ESIGN doesn't require visible separation. The audit trail records: "Tenant signed at 8:01:23am, this signature was stamped on documents X, Y, Z" — each document has its own signature event row, even if the tenant did one ceremony. That's the audit standard. [Unverified] HACH-specific.

**If I'm wrong:** Per-form signing is a config flag, not a rebuild. We'd show the tenant a "next document" flow instead of "sign all." Adds tenant friction (more taps on small screen) but no engineering risk.

**Default for build:** Bulk-sign. We'll add the per-form flag as a fallback so it's a one-line change if HACH wants it.

**What I need:** Same HACH conversation. *"For tenant-side digital signing of federal forms, is a single signature ceremony where the signature is applied to all forms the tenant is authorized to sign acceptable? Or do you require separate signature events per form for your audit standards?"*

**Recommended owner:** Dan, same conversation.

---

## Open But Not Blocking

These need answers eventually but don't block the build. Defaults are in place.

### Decision 4 — Identity verification standard for non-HOH signers

**The question:** When the husband or adult son signs on Maria's phone (same-device flow), what counts as sufficient identity verification?

**Default in build:** Typed full name + drawn signature + IP + timestamp + user agent + a flag indicating "signed on HOH's device."

**Other options if Dan wants more:** Phone OTP (SMS code to that adult's phone before signing), photo ID upload, or video signature ceremony.

**My read:** The default is probably enough. ESIGN cares about intent, not technological theater. But if Dan has a specific concern (e.g., disputed signatures from prior tenants), we add what's needed.

**Owner:** Dan.

---

### Decision 5 — Summary document content

**The question:** What exactly does the Portuguese/Spanish/English summary document say?

**Default in build:** Placeholder template that Cascade can stamp into. The system pipeline is built; the content is empty.

**What I need from Dan:** Time to draft the English version together. The document should: lead with what's being applied for, explain PBV plainly, list the documents in the package with one-line descriptions, note the language-of-record (Spanish for PT-speakers), state preferred language for HACH follow-up, end with a signature attestation that the tenant understands what they're applying for.

**Translation:** Once Dan and I lock the English content, we commission professional PT and ES translations. Estimate $300–500 each.

**Owner:** Alex + Dan to author. Translator for PT and ES.

---

### Decision 6 — Whether summary doc needs HACH review

**The question:** Does HACH want to review the Stanton-authored summary document before we use it?

**My read:** Probably yes, as a courtesy. It strengthens the document's defensive value. HACH reviewing means HACH has implicitly endorsed the framing.

**Default:** We'll show it to HACH alongside the conversation about Decisions 1–3.

**Owner:** Alex to share once drafted.

---

### Decision 7 — Magic-link-per-adult expiration window

**The question:** When we send an adult household member a magic link to sign on their own device, how long should that link work?

**Default in build:** 30 days from generation, matching the existing magic-link convention from compliance campaigns.

**Considerations:** Too short and we lose tenants who travel or are busy. Too long and the link becomes a security risk if forwarded. 30 days feels right.

**Owner:** Alex to decide unless Dan has a specific opinion.

---

## FYI / Context (No Decision Needed)

Things Dan should know but don't need to act on.

### Architecture is locked.
PDF-overlay (stamp tenant data onto HACH's source PDFs). Pilot passed May 14. Status memo at `docs/project-knowledge/pdf-overlay-validated_2026-05-14.md`.

### Cost.
$0/year ongoing for the form execution system itself. We avoid DocuSeal ($800/year) and we don't need any new SaaS dependencies. One-time cost: ~$1,000 for professional translations of the summary document (PT + ES).

### Timeline.
~4 weeks engineering once Decisions 1–3 are confirmed. Summary document content is the long pole — we can build in parallel while you and I draft.

### Hostile tenancy reality is baked in.
Same-device signing as default, save-and-resume that survives Maria's phone dying, staff-assisted mode for the 30% of cases that need Will at the lobby. The system doesn't fight reality.

### Stage 6 (post-approval signing) reuses this architecture.
Same stamping mechanism, same signature ceremony, same data model. Once this system is built, the post-approval signing packet PRD (`docs/04-post-approval-execution_prd_2026-05-13.md`) is mostly a matter of adding the lease, tenancy addendum, HAP contract, and move-in inspection to the form set. No new architecture.

---

## Decisions Already Made (for reference)

So you know where the defaults came from:

- **Architecture:** PDF overlay via pdf-lib (pilot validated)
- **Default signing flow:** Same-device with one-tap-sign-all, magic-link-per-adult as fallback
- **Language model:** `preferred_language` (UI) and `submission_language` (forms) as separate fields; PT-speakers default to ES submission
- **Audit trail:** Per-signature-event row in `pbv_signature_events` with timestamp, IP, user agent, document hash, device owner flag
- **Save-and-resume:** SMS magic link, 30-day expiration, drops tenant exactly where they left off
- **Phase 2 ordering:** Summary document signed first, then federal forms

If any of these need to change, tell me.

---

## What I Need From You

In order of priority:

1. **30-minute conversation with HACH on Decisions 1, 2, 3.** Can be one combined conversation. Could be a call or an email with the specific questions above. I can ghostwrite the email if helpful.
2. **2-hour session with me to draft the summary document.** I'll bring a first draft. We refine together.
3. **5-minute call on Decision 4** if you have an opinion on identity verification standards. If not, we go with the default.

Everything else can wait until it comes up.
