# Permit, Insurance & Pet System
### What We Built and How It Works

---

## The Big Picture

We built a complete digital system that handles the entire lifecycle of tenant onboarding compliance — pets, insurance, and parking permits — across all 41 buildings. It replaces the old process of paper forms, phone calls with no paper trail, and manually tracking who still owes what. Now, tenants can submit everything online in English, Spanish, or Portuguese. Staff can verify, track, and issue permits from any computer. Every action is logged with who did it and when.

---

## How Tenants Use It

A tenant receives a link (via text or email) that opens the onboarding form on their phone or computer. The first thing they see is a language selection screen — English, Spanish, or Portuguese — and the entire form adjusts to their choice.

The form walks them through four sections:

1. **Personal Info** — Name, phone, building, unit. The system validates the phone number format and checks the email. Tenants can also flag if the phone number they're providing is new or different from what's on file — this helps staff identify numbers that need to be updated in Appfolio.
2. **Parking & Vehicle** — If their building has parking, they register their vehicle (make, model, year, color, plate) and sign the vehicle addendum digitally on screen. Buildings that allow multiple vehicles let them request additional spots.
3. **Pet Registration** — They declare whether they have pets. If yes, they enter details for each dog or cat (breed, weight, color, spayed/neutered, vaccinations), upload a photo and vaccination record, and sign the pet addendum. If no, **they still must sign confirming they have no pets** — this dated signature creates a legal record so that if an unregistered dog or cat is found after the signature date, a $500 fine plus all back-owed pet rent can be enforced.
4. **Insurance** — They either upload proof of renters insurance, or choose to have Stanton enroll them through Appfolio (added to rent). If they choose the Appfolio option, **they must sign a digital authorization** giving Stanton permission to enroll them and add the premium to their monthly rent. If they already have a policy, they enter their provider and policy number.

When they hit submit, they get a confirmation screen. The system records their IP address, browser, and timestamp for the audit trail.

**There is also a separate Pet Fee Exemption form** for tenants with emotional support animals or service animals. They select their reason, describe the animal, upload supporting documentation (like an ESA letter), and sign. This goes into a separate review queue.

---

## How the Office Uses It

The admin portal has four main tools, each designed for a different part of the workflow.

### 1. Compliance Dashboard

This is the command center. It shows every building in the portfolio, organized by portfolio group, with real-time stats:

- **How many units are occupied** vs. total units
- **How many tenants have submitted** vs. how many are still missing
- **Which specific tenants haven't submitted yet** (by name and unit)
- **Completion percentages** for each building

When you click into a building, you see every submission for that building. Each tenant row shows their pet status, insurance status, vehicle status, and whether each item has been verified. You can filter by:

- Has vehicle / Has pets / Has insurance
- Needs review (something unverified)
- Export status (exported to CSV or not)
- Fee exemption status

**Quick Tenant Lookup** in the sidebar lets you search across all buildings by name, unit, phone, or email — no need to navigate building by building.

**Duplicate Detection** automatically flags tenants who may have submitted twice. It uses name similarity matching with an adjustable sensitivity threshold. When duplicates are found, you can compare them side by side, choose which to keep as the primary record, merge them, or dismiss false matches.

**Vehicle Export Center** lets you select buildings and export verified vehicle data as CSV files. It tracks which vehicles have already been exported and which are new since the last export, so you never accidentally double-export.

**Parking Management** shows real-time parking capacity for each building — total spots, permits issued, additional permits approved, and spots remaining. When a tenant requests an additional vehicle, it enters an approval queue. Staff can approve (if spots are available) or deny (with a reason).

### 2. Lobby Tool

This is what staff use when a tenant walks into the office. It's designed for speed — you search for the tenant, and their entire compliance status loads instantly.

**Session start:** Staff logs in, selects their name (Alex, Dean, Dan, or Tiff), and the system loads every tenant across all buildings.

**Tenant search** supports typing a name, unit number, building address, phone, or email. It also supports initials — typing "J S" will find "John Smith." If there's exactly one match, it auto-selects. If there are multiple, you pick from a list.

Once a tenant is selected, you see their full card:

- **Pet section** — pet details, photos, vaccination records, signature status, exemption status
- **Insurance section** — provider, policy number, uploaded documents, insurance type classification
- **Vehicle section** — vehicle details, signature status, addendum documents
- **Parking permit section** — issue permit, mark picked up

Each section has verification checkboxes that enforce rules (more on this below in edge cases). Documents can be uploaded right from this screen. Physical forms brought in person can be marked as "received" with the staff member's name and timestamp.

**Lobby Intake** is a panel that opens on top of the tenant card. It has four tabs:

- **Vehicle** — Register a vehicle in person, with fee display and a "Print Addendum" button that generates a professional printed form
- **Pet** — Register a pet with fee schedule (monthly rent + deposit by size), with a print button
- **Insurance** — Record an insurance policy or enroll through Appfolio, track whether proof has been received, check if the Additional Insured LLC has been added, print authorization forms and instruction sheets
- **History** — A timeline of every interaction with this tenant (vehicle registered, insurance recorded, forms printed, etc.), with who did it and when

### 3. Phone Vehicle Entry

When a tenant calls the office to give their vehicle information over the phone, staff uses this tool. You type the building and unit, and the system automatically looks up the tenant's name, phone, and email from the directory. If multiple tenants share the unit, you pick from a dropdown. Then enter the vehicle details and submit. The submission flows into the same compliance dashboard as online submissions, flagged as a phone entry.

### 4. Onboarding Submissions (Raw Data)

A filterable, sortable table of every submission in the system. You can filter by building, date range, pet status, and insurance status. Click any row to see the full detail modal with all their information, signatures, and uploaded documents. Export the filtered set to Excel at any time.

---

## Edge Cases — "What If...?"

This is where the real thought went in. Every one of these scenarios is handled.

### What if a tenant walks in and hasn't submitted the online form?

The lobby tool shows a yellow warning: "No Form Submission." Their basic contact info still appears (pulled from the tenant directory import). Staff can either contact them to complete it online, or use the **Lobby Intake** panel to register their vehicle, pet, and insurance information right there in person — and print the addendums for them to sign physically.

### What if a tenant submitted online AND brings a physical form?

Both are tracked separately. The system shows "Signed online" with date and signature viewer, AND has a "Mark Physical Form Received" button. You can have both on file. The verification checkbox accepts either one.

### What if a tenant uploads car insurance instead of renters insurance?

Staff classifies the uploaded document as "Renters," "Car," or "Other" using a dropdown in the lobby tool. If it's classified as **car insurance**, the system blocks verification and displays: *"Car insurance uploaded — renters insurance required."* Same for "Other." Only documents classified as "Renters" can be verified. This prevents accidentally approving the wrong type of coverage.

### What if a tenant chooses to add insurance to their rent instead?

If they selected the Appfolio option (insurance added to rent), they must first sign a digital authorization — either online when completing the form, or on a physical authorization form printed at the lobby desk. The lobby tool shows whether the authorization signature is on file, with a link to view it. If a tenant opts in at the office without having submitted online, staff is reminded that a physical authorization signature is needed before enrollment.

### What if a tenant has pets and only $100,000 coverage?

Pet owners are required to carry $300,000 in liability coverage, not the standard $100,000. The Lobby Intake insurance tab has a "Tenant has pets" checkbox. When checked, if the coverage amount is below $300,000, a red warning appears: *"Coverage is below $300,000 — pet owners must have at least $300,000 liability."* This ensures staff catches the discrepancy before verifying.

### What if a tenant has a pet fee exemption (ESA or service animal)?

There's a dedicated Pet Fee Exemption form that tenants fill out separately. They select the reason (Emotional Support Animal, Service Animal, medical necessity, financial hardship, or grandfathered/prior agreement), describe the animal, and upload supporting documents like an ESA letter.

The exemption enters a review queue visible in the compliance dashboard. Staff can **approve**, **deny**, or **request more info**. Every review action records who did it and when. The lobby tool shows an exemption status badge — green for approved, yellow for pending, red for denied, blue for "more info needed."

An approved exemption waives the pet fee and is displayed prominently as **"FEE EXEMPT"** on the tenant's card. Importantly, an approved exemption does not block the parking permit — the system knows to skip pet verification when an exemption is in place.

### What if a tenant only has fish, hamsters, or birds?

Only dogs and cats require registration and fees. The system filters pets by type — small animals kept in cages or tanks don't count toward pet verification requirements. So a tenant with only fish will show "No pets registered" in the system and won't need to go through the pet addendum process.

### What if a tenant has a vehicle but no pets?

The permit issuance still requires insurance verification and vehicle verification, but skips the pet check entirely. The system dynamically determines what "complete" means based on what the tenant actually has.

### What if a tenant has pets but no vehicle?

No parking permit is needed. Compliance is complete once pet registration and insurance are both verified. The system shows "Compliance complete (no vehicle)" when this is the case.

### What if a tenant has neither pets nor a vehicle?

Insurance verification alone marks them as complete.

### What if you try to issue a permit before everything is verified?

The "Issue Permit" button is disabled and shows exactly what's missing: *"Missing: Pet verification, Insurance verification"* (or whichever items remain). You physically cannot issue a permit until all prerequisites are green.

### What if the same tenant submitted the form twice?

The duplicate detection engine compares submissions within each building using fuzzy name matching (accounting for typos, name order, etc.). When it finds likely duplicates, it groups them with a similarity score. Staff can:

- **View both side by side** and compare the differences
- **Merge** them (keeping the most complete data from each)
- **Mark one as primary** and archive the other
- **Dismiss** the match if it's a false positive (different people, same name)

The similarity threshold is adjustable — tighten it to only catch near-exact matches, or loosen it to catch more creative typos.

### What if a tenant wants a second parking spot?

The online form (at buildings that allow it) lets tenants request additional vehicles. These requests go into a separate approval queue in the Parking Management panel. The panel shows:

- Total parking spots for the building
- How many primary permits have been issued
- How many additional permits have been approved
- How many spots are still available
- A visual capacity bar

If spots are available, staff can approve. If the lot is full, the approve button is disabled with a warning: *"No parking spots available. Cannot approve at this time."* Staff can also deny with a reason that gets recorded.

### What if a tenant's phone number is new or different?

The online form has a checkbox: "This is a new phone number." When a tenant checks it, the submission is flagged so staff knows the number needs to be manually updated in Appfolio. This prevents tenant contact info from going stale — any new or changed number gets caught during the onboarding process rather than discovered months later.

### What if a tenant's insurance is about to expire?

The Lobby Intake insurance tab shows a color-coded status for the current policy on file:

- **Green** — policy is active and current
- **Yellow** with "EXPIRING SOON" badge — expires within 30 days
- **Red** with "EXPIRED" badge — past expiration date

This gives staff a heads-up to ask the tenant about renewal when they come in.

### What if a tenant needs to add the LLC as Additional Insured on their policy?

The Lobby Intake has a dedicated button: "Print Additional Insured Instructions." It generates a professional instruction sheet that tells the tenant exactly what to tell their insurance company, including the correct LLC name for their building and the mailing address. The system records that the instructions were given, by whom, and when.

### What if a permit was issued but the tenant hasn't picked it up yet?

The system tracks this as a two-step process: "Permit Issued" and "Picked Up" are separate states. The lobby tool shows the issued date and staff member. Before a permit can be marked as picked up, **staff must photograph the tenant's ID** — the system requires an ID photo upload before the "Mark Picked Up" button becomes active. The photo is stored on file and can be viewed later from the tenant's card. This ensures we have a verified identity for every permit handoff.

### What if staff needs to edit a submission after the fact?

The compliance dashboard has an edit modal where staff can correct vehicle details (make, model, year, color, plate), update contact info, upload replacement documents for pet addendums or insurance, and add admin notes. Every edit records which staff member made the change.

---

## Under the Hood

For those who are curious about the technology — this is a custom-built web application, not an off-the-shelf product. A few highlights:

- **Trilingual from the ground up** — Every label, instruction, policy explanation, and error message exists in English, Spanish, and Portuguese. This isn't Google Translate — each translation was written to be natural and accurate.

- **Smart search** — The tenant search in the lobby tool uses debounced live search (results appear as you type, without hammering the server) and supports initials matching. Typing "J D" finds "Jane Doe" instantly.

- **Fuzzy duplicate detection** — Uses string similarity algorithms with a configurable confidence threshold to catch duplicate submissions even when names are misspelled or in different order.

- **Real-time parking capacity** — Tracks every permit issued and every additional vehicle approved against the known parking spots for each building, with a live availability counter.

- **Print-ready document generation** — The Lobby Intake can generate professionally formatted addendums (vehicle, pet, insurance authorization, Additional Insured instructions) styled with Stanton's branding, ready to print directly from the browser.

- **Complete audit trail** — Every verification, permit issuance, document upload, form receipt, and exemption review records who did it and exactly when. Nothing happens in the system without a name and timestamp attached.

- **Interaction history per tenant** — The lobby tool maintains a running log of every touchpoint with each tenant — what was discussed, what forms were given, what was registered — creating a CRM-like history for compliance tracking.

- **41 buildings, 3 portfolios, hundreds of tenants** — all in one system, with per-building stats, per-portfolio rollups, and portfolio-level vehicle counts visible at a glance from the compliance dashboard header.

This was purpose-built for how Stanton actually operates — not a generic form builder with workarounds, but a tool designed around the real workflows, real edge cases, and real conversations that happen in the office every day.
