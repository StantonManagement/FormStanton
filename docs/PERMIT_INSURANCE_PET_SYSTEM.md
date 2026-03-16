Team,

This is a full walkthrough of the tenant onboarding system — what it covers, how tenants and staff interact with it, and the specific scenarios it handles. The short version is at the top if that's all you need. The rest is here for reference.


---------------------------------------
THE SHORT VERSION
---------------------------------------

One system now handles pet registration, renters insurance, and parking permits across all 41 buildings and 3 portfolios. Tenants complete everything online in English, Spanish, or Portuguese. Staff can look up any tenant, verify their status, handle walk-ins, issue permits, print documents, and track AppFolio uploads — all from one place.

The four things worth knowing:
• Every tenant must address pets, insurance, and parking — the system won't let anything get skipped
• Staff can't issue a permit until every prerequisite is verified — this is enforced automatically, not manually
• Every action in the system is logged with who did it and when — full audit trail on everything
• AppFolio document tracking shows exactly which documents have been uploaded and which fees have been added to tenant accounts

If you want the detail, keep reading.


---------------------------------------
WHAT TENANTS SEE
---------------------------------------

Tenants receive a link via text or email. The form opens on their phone or computer and starts with a language selector — English, Spanish, or Portuguese. The entire form adjusts: every label, instruction, policy explanation, and error message switches to their language. These aren't machine translations — each version was written to read naturally. Legal addendums stay in English since they're legal documents.

The form has four sections:


PERSONAL INFO
Name, phone number, building (dropdown of all properties), and unit number. There's also a checkbox to flag a new or changed phone number — this tells staff the number needs to be updated in Appfolio, so stale contact info gets caught during onboarding instead of months later.


PARKING & VEHICLE
If their building has parking, they register their vehicle — make, model, year, color, and plate number. They see the fee schedule:
• Mopeds, motorcycles, ATVs, scooters — $20/month
• Sedans, SUVs, pickups (under 20 ft) — $50/month
• Oversized vehicles (over 20 ft) — $60/month
• Boats, trailers, equipment — $60+/month (approval required)

They read and digitally sign the vehicle addendum on screen. At buildings that allow multiple vehicles, they can request additional spots — those requests go into a staff approval queue.


PET REGISTRATION
Every tenant completes this section — not just pet owners.

If they have dogs or cats, they enter details for each animal: breed, weight, color, spayed/neutered status, and vaccination status. They upload a photo and vaccination records, then sign the pet addendum. The fee schedule is shown upfront:
• Cat — $25/month + $150 one-time fee
• Small dog (under 25 lbs) — $25/month + $200 one-time fee
• Medium dog (25–50 lbs) — $35/month + $250 one-time fee
• Large dog (50+ lbs) — $45/month + $300 one-time fee

If they don't have pets, they still sign a dated confirmation stating they have no animals. That signature is the legal basis for the $500 fine plus back-owed pet rent if an unregistered dog or cat is found after the signature date.

Fish, birds, hamsters, and anything kept in a cage or tank are exempt — no registration, no fees.


INSURANCE
Two options:

Option 1: They already have renters insurance. They upload proof and enter their provider name and policy number. The form shows them which LLC to list as Additional Insured based on their building (e.g., 31-33 Park St ? SREP Park 1 LLC c/o Stanton Management LLC).

Option 2: They want Stanton to enroll them through Appfolio ($10–25/month, added to rent). If they choose this, they must sign a digital authorization giving Stanton permission to enroll them and add the premium to their monthly rent.


AFTER SUBMISSION
The system records the tenant's IP address, browser, and timestamp for the audit trail. They see a confirmation screen summarizing everything they submitted.


PET FEE EXEMPTION (SEPARATE FORM)
Tenants with emotional support animals or service animals fill out a separate exemption form. They select their reason (ESA, service animal, medical necessity, financial hardship, or grandfathered agreement), describe the animal, upload supporting documentation, and sign. The request enters a staff review queue.


---------------------------------------
WHAT THE OFFICE HAS
---------------------------------------

Five tools, each built for a different part of the daily workflow.


-----------------------------
1. COMPLIANCE DASHBOARD
-----------------------------

The command center. Shows every building organized by portfolio group with real-time stats: occupied units vs. total, tenants submitted vs. still missing, specific names and units of who hasn't submitted yet, and completion percentages per building.

Click into any building and you see every submission — pet status, insurance status, vehicle status, and verification state for each tenant. Filter by: has vehicle, has pets, has insurance, needs review, export status, fee exemption status, or AppFolio status (ready to upload, partially uploaded, or complete).

Five built-in features:

Quick Tenant Lookup — Search across all buildings by name, unit, phone, or email from the sidebar. No need to navigate building by building.

Duplicate Detection — Automatically flags tenants who may have submitted twice. Uses fuzzy name matching that catches typos, reversed name order, and misspellings. When duplicates are found, staff can view both side by side, compare the differences, merge them (keeping the most complete data from each), mark one as primary and archive the other, or dismiss false matches. The sensitivity threshold is adjustable.

Vehicle Export Center — Select buildings and export verified vehicle data as CSV files. The system tracks which vehicles have already been exported vs. which are new since the last export, so nothing gets double-exported.

Parking Management — Real-time parking capacity per building: total spots, permits issued, additional permits approved, spots remaining, with a visual capacity bar. When a tenant requests an additional vehicle, the request enters an approval queue. Staff can approve if spots are available, or deny with a reason that gets recorded. If the lot is full, the approve button is disabled with a warning.

AppFolio Document Tracking — Once a permit is issued, property managers see an "AppFolio Documents" section showing which documents (pet addendum, vehicle addendum, insurance) have been uploaded to Appfolio and which fees (pet rent, permit fee) have been added to the tenant's account. Each document has a download button and a "Mark Uploaded" button. Staff can mark documents as uploaded even without a digital scan by adding a note like "Physical document uploaded directly to Appfolio." Fee tracking includes the actual dollar amount entered. Everything records who did it and when. A "Download All Documents (ZIP)" button lets property managers batch-download all three documents at once for faster processing.


-----------------------------
2. LOBBY TOOL
-----------------------------

Built for when tenants walk into the office. Designed around speed.

Staff logs in and selects their name (Alex, Dean, Dan, or Tiff). The system loads every tenant across all buildings. Search supports name, unit number, building address, phone, email, and even initials — typing "J S" finds "John Smith." If there's exactly one match, it auto-selects. Multiple matches show a list to pick from.

Once a tenant is selected, their full compliance card loads with four sections:
• Pet — details, photos, vaccination records, signature status, exemption status
• Insurance — provider, policy number, uploaded documents, insurance type classification
• Vehicle — details, signature status, addendum documents
• Parking permit — issue permit, mark picked up

Each section has verification checkboxes that enforce the business rules — for example, insurance classified as "car insurance" can't be verified as renters insurance.

Documents can be uploaded right from this screen. Physical forms brought in person can be marked as "received" with the staff member's name and timestamp.


LOBBY INTAKE PANEL

Opens on top of the tenant card. Four tabs:

Vehicle — Register a vehicle in person. Shows the fee schedule. "Print Addendum" button generates a professional Stanton-branded form ready for a physical signature.

Pet — Register a pet in person. Shows the full fee schedule (monthly rent + one-time fee by size). Print button for physical addendums.

Insurance — Record a policy or enroll through Appfolio. Tracks whether proof has been received and whether the Additional Insured LLC has been added to the policy. Shows color-coded policy status:
  • Green — active and current
  • Yellow with "EXPIRING SOON" badge — expires within 30 days
  • Red with "EXPIRED" badge — past expiration date

"Print Additional Insured Instructions" button generates a sheet with the exact LLC name for the tenant's building and the Stanton mailing address. The system records that instructions were given, by whom, and when.

Also has a "Tenant has pets" checkbox. When checked, if coverage is below $300,000, a red warning appears — pet owners must carry $300K liability, not the standard $100K. This catches the discrepancy before staff accidentally verifies an insufficient policy.

History — A complete timeline of every interaction with that tenant: vehicles registered, insurance recorded, forms printed, documents uploaded, permits issued — each entry showing who did it and when. This creates a CRM-like record for every tenant across all visits.


-----------------------------
3. PHONE VEHICLE ENTRY
-----------------------------

For when tenants call in their vehicle information. Staff enters the building and unit, and the system automatically looks up the tenant's name, phone, and email from the directory. If multiple tenants share the unit, a dropdown lets you pick the right one. Enter vehicle details and submit. The entry flows into the same compliance dashboard as online submissions, flagged as a phone entry so the source is clear.


-----------------------------
4. ONBOARDING SUBMISSIONS
-----------------------------

A filterable, sortable table of every submission in the system. Filter by building, date range, pet status, or insurance status. Click any row to open a detail modal showing all their information, signatures, and uploaded documents. Export the filtered set to Excel at any time.


-----------------------------
5. FORMS LIBRARY
-----------------------------

Printable forms organized by language. Staff can generate and print blank vehicle addendums, pet addendums, insurance authorization forms, and Additional Insured instruction sheets in English, Spanish, or Portuguese. Each form is professionally formatted with Stanton branding. The system tracks which forms were printed, by whom, and when.


---------------------------------------
EDGE CASES — EVERY SCENARIO WE HANDLE
---------------------------------------

This is where the real thought went in. Every one of these situations has been accounted for.


WALK-INS & FORM HANDLING

Tenant walks in without submitting online — The lobby tool shows a yellow "No Form Submission" warning. Their basic contact info still appears (from the tenant directory import). Staff can direct them to complete the form online, or use the Lobby Intake panel to register their vehicle, pet, and insurance information right there — and print the addendums for physical signatures.

Tenant submitted online AND brings a physical form — Both are tracked separately. The system shows "Signed online" with the date and a signature viewer, and also has a "Mark Physical Form Received" button. Either one satisfies verification. Both stay on file.

Staff needs to edit a submission after the fact — The compliance dashboard has an edit modal where staff can correct vehicle details, update contact info, upload replacement documents, and add admin notes. Every edit records which staff member made the change and when.


INSURANCE SCENARIOS

Tenant uploads car insurance instead of renters insurance — Staff classifies the uploaded document as "Renters," "Car," or "Other" using a dropdown. Car insurance and Other are blocked from being verified. Only documents classified as "Renters" can be approved. This prevents accidentally verifying the wrong type of coverage.

Tenant chooses Appfolio enrollment but hasn't signed the authorization — The lobby tool shows whether the authorization signature is on file, with a link to view it. If a tenant opts in at the office without having submitted online, staff is reminded that a physical authorization signature is needed before enrollment can proceed.

Pet owner only has $100K liability coverage — The insurance tab flags this automatically. When "Tenant has pets" is checked and coverage is below $300K, a red warning blocks verification until the coverage is corrected.

Insurance is about to expire — Color-coded status gives staff a heads-up during any interaction: green for active, yellow for expiring within 30 days, red for expired.

Tenant needs to add the LLC as Additional Insured — One click prints a professional instruction sheet with the exact LLC name for their building and the Stanton mailing address. The system logs that the instructions were provided, who gave them, and when.


PET SCENARIOS

Tenant has an ESA or service animal — The exemption enters a review queue visible in the compliance dashboard. Staff can approve, deny, or request more info. Every action records who did it and when. The lobby tool shows a status badge: green for approved, yellow for pending, red for denied, blue for "more info needed." An approved exemption waives the pet fee and displays "FEE EXEMPT" prominently on the tenant's card. Critically, an approved exemption does not block the parking permit — the system skips pet verification when an exemption is in place.

Tenant only has fish, birds, or hamsters — Only dogs and cats require registration and fees. Small animals in cages or tanks don't count toward pet verification. A tenant with only fish shows "No pets registered" and doesn't go through the addendum process.


PARKING SCENARIOS

Tenant wants a second parking spot — The request goes into the approval queue in Parking Management. Staff sees total spots, permits issued, additional permits approved, and spots remaining with a visual capacity bar. If spots are available, staff approves. If the lot is full, the approve button is disabled with a warning. Denials require a reason that gets recorded.

Trying to issue a permit before everything is verified — The "Issue Permit" button is disabled and shows exactly what's still missing: "Missing: Pet verification, Insurance verification" (or whichever items remain). You cannot issue a permit until all prerequisites are green.

Permit issued but tenant hasn't picked it up — Tracked as two separate states: "Permit Issued" and "Picked Up." Before a permit can be marked as picked up, staff must photograph the tenant's ID — the system requires the photo upload before the "Mark Picked Up" button becomes active. The photo is stored and viewable from the tenant's card. This gives us a verified identity for every permit handoff.


APPFOLIO SCENARIOS

Document uploaded to Appfolio without a digital scan — Property managers can mark any document as uploaded even if there's no PDF in the system by adding a note explaining why (e.g., "Physical addendum uploaded directly from tenant file"). The note is saved with the upload record.

Tracking which fees were added and for how much — Each fee (pet rent, permit fee) has an amount input field. When a property manager marks a fee as added, they enter the exact dollar amount. The system records the amount, who added it, and when. This creates a complete financial audit trail.

Filtering by AppFolio status — The compliance dashboard filter includes "AppFolio Status" with four options: All, Ready to Upload (permit issued but documents not uploaded yet), Partially Uploaded (some documents uploaded but not all), and Complete (all documents uploaded and all fees added). This lets property managers focus on what still needs attention.


COMPLIANCE LOGIC

The system dynamically determines what "complete" means based on each tenant's actual situation:
• Has vehicle, has pets — insurance + pet registration + vehicle verification all required before permit
• Has vehicle, no pets — insurance + vehicle verification required; pet check is skipped
• Has pets, no vehicle — pet registration + insurance required; no permit needed
• No pets, no vehicle — insurance verification alone marks them as complete


DATA QUALITY

Tenant submitted twice — Duplicate detection catches it using fuzzy name matching (handles typos, reversed names, misspellings). Staff can view both submissions side by side, merge the most complete data from each, mark one as primary and archive the other, or dismiss if it's a false match. The sensitivity threshold is adjustable.

Tenant's phone number is new or different — The "This is a new phone number" checkbox on the online form flags the submission so staff knows to update Appfolio. New or changed numbers get caught during onboarding instead of going stale.


---------------------------------------
UNDER THE HOOD
---------------------------------------

This is a custom-built web application, not an off-the-shelf product or a form builder with workarounds.

• Trilingual from the ground up — every label, instruction, policy explanation, and error message exists in all three languages, written to read naturally in each

• Smart search — the lobby tool uses debounced live search (results appear as you type without overloading the server) and supports initials matching

• Fuzzy duplicate detection — string similarity algorithms with a configurable confidence threshold, catching duplicates even with misspelled or reordered names

• Real-time parking capacity — tracks every permit issued and every additional vehicle approved against each building's total spots, with a live availability count

• Print-ready document generation — professionally formatted addendums, authorization forms, and instruction sheets styled with Stanton branding, printable directly from the browser

• Complete audit trail — every verification, permit issuance, document upload, form receipt, exemption review, and AppFolio upload is logged with who did it and when

• Per-tenant interaction history — a running log of every touchpoint, creating a CRM-like timeline for compliance tracking

• AppFolio integration workflow — property managers download documents, upload them to Appfolio, then mark them uploaded in our system with notes if needed. Fee tracking includes dollar amounts. ZIP download batches all three documents for faster processing.

• 41 buildings, 3 portfolios, hundreds of tenants — all in one system with per-building stats and per-portfolio rollups visible from the dashboard header

This was designed around the actual workflows, edge cases, and conversations that happen in the office every day.

---

Happy to walk through any of this live or answer questions.

Alex
