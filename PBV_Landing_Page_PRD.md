# PBV Pre-Application Landing Page — PRD

## What this is

A mobile-first landing page at `/pbv-preapp` that replaces the current form-only view with a two-section experience: (1) an informational letter explaining the PBV opportunity, and (2) the pre-application form. The page must work for elderly tenants on phones who arrived via SMS link.

## Why

Tenants are receiving an SMS with a link to this page. Most haven't read the email or paper letter. This page is the first (and possibly only) thing they'll read about the program. The visual hierarchy and tone must do the heavy lifting — communicate that this is a valuable opportunity being extended to good tenants, not an entitlement. Previous PBV rounds had issues with tenants who didn't treat the benefit seriously. The language and design must set expectations from the start.

## Audience

- Current tenants at Stanton-managed properties in Hartford, CT
- Primarily Spanish, Portuguese, and English speakers
- Many are elderly; many are on phones with small screens
- Low tech literacy is common — the page must be dead simple

## User flow

1. Tenant receives SMS with tinyurl
2. Taps link → lands on `/pbv-preapp`
3. Sees the letter content first (language auto-detected or toggled)
4. Scrolls through the opportunity explanation, the "treat your apartment as a home" message, and the 8-step timeline
5. Reaches the pre-application form below
6. Completes and submits

## Page structure

### Section A: Language selector
- Three buttons/tabs at the top: English | Español | Português
- Sticky or prominent — must be findable immediately
- Default to English; persist selection if returning

### Section B: Letter content
This is the designed informational section. It mirrors the PDF letter but is native HTML, not an embedded document. Key visual elements:

**Title block**
- "Opportunity for Current Tenants to Receive Housing Assistance" (or translated equivalent)
- Large, navy (#2B2D6E), prominent

**Opening paragraphs**
- Brief explanation of PBVs and what they mean for the tenant
- Standard body text, readable at 16px+ on mobile

**Green callout box**
- "If your household qualifies, your rent drops to approximately 30–40% of your household income."
- Light green background (#E6F5EC), green text (#1B7340)
- Centered text, rounded corners
- This is the hook — it should be visually prominent

**"Not a waitlist" paragraph**
- Standard body text
- Emphasize "as early as August 1, 2026"

**Amber callout box (CRITICAL)**
- "This opportunity will be reserved for tenants who have demonstrated that they truly treat their apartment as a home — those with a strong payment history, a well-maintained unit, and a cooperative relationship with management."
- Amber/gold background (#FFF8ED), gold left border (#E8B44A), amber text (#7A5C1F)
- This is the most important paragraph on the page. It sets the tone for the entire program. It must be visually distinct and impossible to scroll past without reading.

**Timeline: "Application Process"**
- 8 steps with numbered circles, titles, descriptions, and date pills
- Vertical line connecting the circles
- Step 1 (Pre-Application): coral circle (#E8734A), coral date pill — this is the current step
- Step 8 (Assistance Begins): green circle, green date pill — this is the destination
- Steps 2-7: navy circles, blue date pills
- Each step has a 2-3 line description

Updated dates:
| Step | Title | Date |
|------|-------|------|
| 1 | Pre-Application | Due 5/19/26 |
| 2 | Eligibility Notification | By 5/22/26 |
| 3 | Full Application | Due 6/2/26 |
| 4 | Pre-Inspection | 5/25–6/12/26 |
| 5 | Section 8 Inspection | By early July |
| 6 | Program Onboarding | July 2026 |
| 7 | HAP Contract Execution | July 2026 |
| 8 | Assistance Begins | Target 8/1/26 |

**Coral CTA box**
- "Complete the Pre-Application below. It takes about 10 minutes."
- Coral background (#E8734A), white text
- Points them to the form section immediately below

**Sign-off**
- "If you have questions, call or stop by. We're here to help."
- "Stanton Management" in navy bold
- Contact info in muted gray

### Section C: Pre-application form
- The existing form component, unchanged
- Visually separated from the letter by spacing or a subtle divider
- Should feel like a natural continuation, not a separate page

## Design constraints

- **Mobile-first**: 100% of traffic will be phones. Design at 375px width, scale up.
- **Font size minimum 16px** for body text (prevents iOS zoom on input focus and is readable for elderly)
- **Touch targets minimum 44px** for all interactive elements
- **No PDF embedding, no downloads, no external links** (except the form submission)
- **No images required** — the design should work with pure HTML/CSS (the Stanton logo can be text-only or a small inline image)
- **Fast load** — these are people on phone data plans. Minimize JS bundle impact.
- **Scroll depth indicator or progress** is optional but nice — the page is long

## Color palette

| Name | Hex | Usage |
|------|-----|-------|
| Navy | #2B2D6E | Titles, headings, timeline circles |
| Coral | #E8734A | CTA, step 1 accent, accent stripe |
| Green BG | #E6F5EC | Rent reduction callout |
| Green Text | #1B7340 | Rent reduction callout text |
| Amber BG | #FFF8ED | "Apartment as a home" callout |
| Amber Border | #E8B44A | Left accent bar on amber callout |
| Amber Text | #7A5C1F | "Apartment as a home" text |
| Blue Light | #EEF2F9 | Timeline date pills (steps 2-7) |
| Body | #333344 | Body text |
| Light | #6B6B80 | Secondary text, descriptions |
| Border | #D8D8E0 | Dividers, timeline connector |

## Tone (see VOICE_AND_VALUES.md in repo)

Authority through courtesy. This is an invitation, not a directive. The language should leave the reader feeling respected and informed — and clear that this is something valuable being offered, not owed. The "apartment as a home" message is the centerpiece.

## What success looks like

A tenant opens this on their phone, reads it in under 2 minutes, understands what's being offered and what's expected, and scrolls down to complete the form. No confusion, no questions, no second visit needed.
