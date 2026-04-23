Team,

This is the updated walkthrough of the tenant onboarding and compliance operations system - written from a business and execution standpoint.

The goal of this version is to explain what changed since the prior walkthrough, what we added, what edge cases are now covered, and how this system now supports both day-to-day office execution and portfolio-level project completion.


---------------------------------------
THE SHORT VERSION
---------------------------------------

We moved from a "single onboarding workflow" to a full operational platform for tenant intake, verification, document handling, AppFolio handoff tracking, and project-based completion management.

The seven business-level points worth knowing:
- The system now supports both legacy onboarding flow and project-mode tracking (dynamic task columns by project)
- AppFolio handoff is now fully trackable: document uploads, fee posting, notes, timestamps, and staff attribution
- Lobby operations are materially faster: modal document viewing, better keyboard workflows, and complete pet/insurance/vehicle evidence visibility
- Form operations are stronger end-to-end: unified queue, status lifecycle, assignment, priority, and automatic PDF generation on multiple form routes
- Forms Library is now editable via persisted admin overrides (without losing default catalog coverage)
- Permit lock logic is stricter and clearer: prerequisites are enforced with specific blocking reasons, not guesswork
- The platform is no longer just "did tenant submit a form" - it is now "did the office complete the operational task"

If you want the full detail, keep reading.


---------------------------------------
WHAT CHANGED SINCE THE LAST VERSION
---------------------------------------

1) Compliance moved from static review to dual-mode operations.

We now run in two views:
- Legacy mode: existing onboarding/compliance behavior remains intact
- Project mode: selected project drives dynamic columns, row-level completion states, and building/portfolio rollups

Business impact:
- We can run campaigns beyond initial onboarding (for example, annual document refresh, fee cleanup, or portfolio-wide task drives)
- Teams can measure completion by task and building, not just by individual tenant card review


2) AppFolio workflow moved from "manual memory" to auditable process.

The system now tracks, per tenant submission:
- Whether each required document was uploaded to AppFolio
- Who uploaded it and when
- Optional upload notes (including physical-document scenarios)
- Whether pet fee and permit fee were added
- Exact fee amount, staff attribution, and timestamp

Business impact:
- Back office can prove operational completion, not just "we think this was done"
- Managers can identify partial completion instantly
- Financial and compliance risk from missed fee posting is reduced


3) Document visibility is now consistent across interfaces.

Document viewing has been standardized so lobby and admin users can review signatures, addendums, insurance files, pet photos, and vaccination records without opening new tabs.

Business impact:
- Faster tenant handling at the counter
- Less context switching for staff
- Fewer misses during verification due to fragmented document access


4) Submission processing is now stronger for both online and lobby intake.

Across multiple form endpoints, submission-to-PDF generation is now automatic and stored in Supabase storage.

Business impact:
- Lobby-submitted forms are printable and complete immediately
- Team can retrieve branded records later without manual reconstruction
- Reduced "data captured but not reflected in printable output" failure mode


5) Forms Library became editable and operationally maintainable.

Static defaults remain available, while admin overrides now persist in database.

Business impact:
- Office can update wording and operational instructions without waiting for a full code redeploy
- No cold-start risk: defaults still load even before overrides are configured


---------------------------------------
WHAT TENANTS SEE (CURRENT STATE)
---------------------------------------

Tenants still experience the same stable front-end expectations:
- Trilingual experience (English, Spanish, Portuguese)
- Mobile-friendly online completion
- Structured onboarding sections (identity, parking/vehicle, pets, insurance)
- Signature and upload collection where required

What improved behind the scenes for tenant-facing reliability:
- Better document persistence and generated records
- Stronger submission storage patterns for unified form handling
- Continued support for both fully digital and staff-assisted completion scenarios


---------------------------------------
WHAT THE OFFICE HAS (CURRENT STATE)
---------------------------------------

The office still has the original core toolset, now with stronger business execution controls.


-----------------------------
1. SEND FORM LINKS
-----------------------------

Still the fastest way to route the right tenant to the right form.

Operational update:
- Works as entry point into a now more mature form processing pipeline (status lifecycle + generated records + queue operations)


-----------------------------
2. FORM SUBMISSIONS (UNIFIED QUEUE)
-----------------------------

Still the centralized inbox for tenant forms across departments.

Operational updates:
- Better downstream consistency with generated PDFs on multiple form routes
- Improved lobby compatibility (staff-completed forms align with queue processing)
- Stronger handling of assignment/priority/status operations for execution teams


-----------------------------
3. ONBOARDING + COMPLIANCE OPERATIONS
-----------------------------

This area had the biggest upgrade.

Legacy mode remains available for existing onboarding review workflows.

New project mode adds:
- Project selector via URL-backed context (`?project=legacy` or project id)
- Dynamic task columns derived from project task configuration
- Building-level task matrix with row-by-row completion visibility
- Portfolio-level rollups by task completion
- Mode-aware filters tied to task columns
- Staff completion actions for staff-check tasks

Business effect:
- We can run operations as projects with explicit completion criteria
- Leadership can measure progress by campaign, not just by submission count


-----------------------------
4. LOBBY TOOL (HIGH-VELOCITY INTAKE)
-----------------------------

The lobby tool remains counter-optimized, but usability is materially improved.

Operational updates:
- Document views standardized in modal (no disruptive tab hopping)
- Keyboard shortcuts improve throughput
- Pet photo and vaccination document review is now directly available for verification
- Verification gating remains explicit and conditional (pet/insurance/vehicle logic enforced)

Business effect:
- Faster processing per walk-in
- Better first-contact completion quality
- Reduced rework from incomplete checks


-----------------------------
5. APPFOLIO HANDOFF TRACKING
-----------------------------

Now a first-class operational workflow rather than a side process.

Current capabilities:
- Mark each required document as uploaded
- Add upload notes (including physical-document workflows)
- Track fee posting with exact amounts
- Filter by AppFolio status (ready / partial / complete)
- Batch-download required docs as ZIP to accelerate back-office handoff

Business effect:
- Cleaner division of labor between lobby verification and back-office system-of-record posting
- Better accountability when reconciling tenant files vs AppFolio entries


-----------------------------
6. FORMS LIBRARY (ADMIN-MANAGED CONTENT)
-----------------------------

Library remains organized for office use, and now supports persisted admin edits.

Business effect:
- Form text and operational content can evolve without risking loss of baseline catalog coverage
- Better governance for content updates over time


---------------------------------------
EDGE CASES - UPDATED BUSINESS COVERAGE
---------------------------------------

Below are the scenarios that now matter most in operations, and how the current system handles them.


LOBBY + DOCUMENT HANDLING

Tenant arrives without a prior digital submission:
- Staff can still process intake in person and continue workflow without dead-end blocking.

Tenant has documents, but digital files are incomplete:
- Staff can still mark AppFolio upload completion with explanatory notes for physical-file handling.

Staff needs proof quickly during interaction:
- Standardized modal viewer supports key document types directly in workflow context.


INSURANCE OPERATIONS

Uploaded file is not renters insurance:
- Classification rules prevent false verification on incorrect insurance type.

Tenant opts for insurance added to rent:
- Verification flow accounts for this path without requiring conventional renters-policy document gating.

Policy handling with pet risk mismatch:
- Pet-aware insurance checks continue to block invalid verification when business rules are not met.


PET OPERATIONS

Pets include exempt/non-counted categories:
- Verification logic focuses on dogs/cats for fee/registration controls and avoids over-blocking for exempt small/caged animals.

Pet documentation exists but details are incomplete:
- Verification remains blocked with explicit reasoning until required details are complete.

Exemption cases:
- Exemption status can prevent inappropriate permit blocking when exemption is approved.


PERMIT OPERATIONS

Permit attempted before prerequisites:
- System calculates blocking requirements and returns exact missing items.

Permit issued but fulfillment still pending:
- Issuance and pickup remain distinct states for operational clarity and accountability.


APPFOLIO + FEE POSTING

Document uploaded manually outside digital pipeline:
- Allowed with note capture so completion is auditable.

Fee posted but amount unknown:
- Flow requires explicit amount capture for reliable ledger trail.

Manager needs to focus only on unfinished records:
- AppFolio status filtering isolates ready/partial/incomplete work quickly.


PROJECT-MODE OPERATIONS (NEW)

Need to run a campaign that is not onboarding:
- Project mode supports dynamic task definitions and completion tracking by unit/building.

Need portfolio-level visibility for one campaign:
- Rollups now expose completion by building and by task column.

Need to preserve existing onboarding behavior while rolling out project workflows:
- Legacy mode remains default-compatible when no project is selected.


DATA QUALITY + EXECUTION RESILIENCE

Submission data can arrive from online flow, lobby flow, or mixed source:
- Shared queue and normalized review workflows keep processing consistent.

Field naming inconsistencies across old/new routes:
- PDF generation layer supports field-name variations to prevent missing tenant identity in outputs.

Storage/process dependencies in Supabase:
- Workflow expectations explicitly include required tables/buckets for successful save and retrieval.


---------------------------------------
BUSINESS OUTCOMES - WHAT THIS ENABLES NOW
---------------------------------------

Operationally, this system now supports four levels of control:

1) Intake control
- Tenants can submit digitally; staff can complete assisted intake when needed

2) Verification control
- Rules-based verification with explicit blockers and auditable staff actions

3) Handoff control
- AppFolio document/fee completion is measurable, attributable, and filterable

4) Project control
- Teams can execute portfolio-wide campaigns with dynamic tasks and completion rollups

This is the practical shift:
- Before: "Did we collect submissions?"
- Now: "Did we complete the actual business work end-to-end?"


---------------------------------------
UNDER THE HOOD (CURRENT OPERATING MODEL)
---------------------------------------

- Trilingual tenant experience remains foundational
- Unified submissions architecture supports cross-form intake and queue management
- Compliance now runs as dual-mode (legacy + project-aware)
- AppFolio tracking is built into the workflow rather than externalized to notes/spreadsheets
- Document handling is consistent across lobby and back-office contexts
- PDF generation is available across a wider set of form routes for durable records
- Forms Library supports persisted admin content overrides
- Audit-oriented metadata (who/when/what) is captured for high-impact actions


---------------------------------------
RECOMMENDED TEAM TALK TRACK
---------------------------------------

When presenting this internally, frame it in this order:

1) We preserved what worked (tenant experience and legacy onboarding flow)
2) We fixed where operations were fragile (document visibility, AppFolio handoff, lobby speed)
3) We added what management needed (project-mode tracking and campaign-level completion)
4) We now have operational proof, not just submission counts


---

Happy to run this as a live walkthrough with role-specific examples (Lobby Staff, Back Office, PM leadership) so each team sees exactly what changed for their day-to-day.
