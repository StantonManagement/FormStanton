# Document Scanner Component — PRD

**Status:** Ready for build
**Date:** April 23, 2026
**Author:** Alex / Stanton Management
**Stack:** Next.js (App Router) + Supabase + Vercel

---

## Problem Statement

Tenants submit bad document photos. The PBV document tracker already shows the failure modes:

- **Blurry:** SS award letter rejected because the photo was unreadable
- **Incomplete:** Paystubs rejected because 2 weekly stubs were uploaded when 4 were required
- **Stale:** Same paystub submission had dates from January instead of current

Each rejected doc means a round trip: Tess/Christine reviews, rejects with a reason, tenant resubmits, staff reviews again. With 20–40% hostile tenancy, every extra round trip is an opportunity for the tenant to disengage.

The current upload flow is a raw `<input type="file">`. It gives tenants no guidance, no feedback, and no quality enforcement. Whatever they send, we store and review.

**Goal:** Build a reusable document capture component that catches the common failure modes *before* the file reaches Supabase, and makes the "take a good photo" experience easy enough that even hostile users take the path of least resistance.

---

## Users & Roles

| User | Context |
|---|---|
| **Tenant** | On phone (iOS Safari or Android Chrome). Often not technical. Often not English-first. Possibly hostile or disengaged. Completing tasks via magic link at `/t/[token]`. |
| **Staff (Tess, Christine)** | Reviewing uploaded docs against the checklist. Currently the bottleneck — every rejection costs them review time twice. |

Not in scope for this component:
- Lobby staff (they use the lobby intake form, different workflow)
- Field staff (Dean uses the field evaluator tool)

---

## Core Features

### 1. Camera-first capture
- Component opens the rear camera directly via `capture="environment"` on mobile
- Desktop fallback: file picker (for staff testing, office uploads)
- No generic photo library picker on mobile unless user explicitly opts in

### 2. Auto edge detection + crop
- Live rectangle overlay finds document edges in real time
- Perspective correction on capture (tilted photos become rectangular)
- [Inference] jscanify (OpenCV.js-based) handles this in-browser on iOS Safari and Android Chrome
- Tenant sees visual confirmation that the document was detected before they tap capture

### 3. Client-side quality gate
Before the file is accepted, run three checks:

| Check | Method | Threshold | Failure UX |
|---|---|---|---|
| Blur | Variance of Laplacian | Tuned against sample docs — start at 100, adjust | "This looks blurry — retake?" with retake button |
| Resolution | Width × height after crop | Min 1000px on long edge | "Image is too small — move closer?" |
| Darkness | Mean pixel brightness | Min ~50/255 | "Too dark — try better lighting?" |

Quality gate is a **warning with override**, not a hard block. Tenants can force-accept a flagged photo. Rationale: we'd rather have a flagged-but-submitted doc than a tenant who rage-quits. Staff sees the quality flag in the review UI.

### 4. Multi-page support
- "Add another page" button after each capture
- Running thumbnail strip shows pages so far
- Reorder via drag (desktop) or long-press (mobile) — nice-to-have, defer if complex
- Remove individual pages before submit

### 5. Output format
- Single-page docs → JPEG
- Multi-page docs → combined PDF via pdf-lib client-side
- HEIC input (iPhone default) → converted to JPEG via heic2any before processing

### 6. Preview + explicit submit
- After capture and processing, tenant sees the final result
- "Retake" and "Use this" buttons, equal visual weight
- No auto-upload — tenant must tap "Use this" to proceed

### 7. Language support
- All UI strings externalized for EN/ES/PT
- Uses the same translation pattern as the existing tenant form
- Language auto-loaded from `project_units.preferred_language` via token context

### 8. Guidance before capture
- Short, context-aware instruction displayed above camera viewfinder
- Text passed in as prop so each task can customize (e.g. "Take a photo of your most recent paystub — make sure dates are visible")
- Optional: example image overlay showing "what a good photo looks like"

---

## Data Model

No schema changes. Component integrates with existing tables.

### Existing (from multi-project compliance PRP)

```sql
task_completions (
  evidence_url text,           -- Supabase storage path of uploaded file
  status text,
  completed_by text,
  completed_at timestamp,
  ...
)
```

### New metadata to attach (stored in existing `notes` or a new `evidence_metadata` JSONB column — **decision needed**)

```json
{
  "capture_method": "scanner" | "file_upload",
  "page_count": 3,
  "quality_flags": ["blurry"],
  "quality_scores": { "blur": 78, "brightness": 142, "resolution": 1840 },
  "format": "pdf" | "jpeg",
  "heic_converted": false
}
```

**Recommendation:** Add `evidence_metadata JSONB` to `task_completions`. JSONB is already the pattern used elsewhere in the stack for forward-compatibility. Lets staff see quality flags in the review UI without a schema migration every time we add a new check.

### Storage structure

Follows the existing pattern:

```
/uploads/{project_unit_id}/{task_id}/
  {timestamp}_{page_1}.jpg
  {timestamp}_{page_2}.jpg
  {timestamp}_combined.pdf        ← the canonical file, evidence_url points here
```

Keep individual page images for 30 days in case of processing issues, then cleanup. Final PDF is the source of truth.

---

## Integration Points

| System | How it connects |
|---|---|
| **Tenant portal (`/t/[token]`)** | Component rendered inline when `task.evidence_type === 'file_upload'` |
| **`file_upload` task type** | This component replaces the raw file input currently used |
| **Supabase Storage** | Writes final file (+ page images) to `/uploads/{project_unit_id}/{task_id}/` |
| **Supabase DB** | Updates `task_completions` row with `evidence_url`, `status`, `completed_at`, `evidence_metadata` |
| **Language context** | Reads `preferred_language` from the token's `project_units` row (already in portal context) |
| **Lobby intake form** | Future integration — same component should work for Will's in-person ID uploads. Phase 2. |

### Component API

```tsx
<DocumentScanner
  taskId={string}
  projectUnitId={string}
  instructions={string}              // "Take a photo of your most recent paystub..."
  exampleImageUrl={string?}          // optional "good example" overlay
  multiPage={boolean}                // default true
  maxPages={number}                  // default 10
  acceptedFormats={['pdf', 'jpeg']}
  language={'en' | 'es' | 'pt'}
  onComplete={(url: string, metadata: Metadata) => void}
  onCancel={() => void}
/>
```

No external state. Component handles capture, quality, upload, and DB write internally. Caller gets a callback when the task is marked complete.

---

## Implementation Phases

### Phase 1 — MVP (scope for first build)

**Deliverables:**
- `<DocumentScanner>` React component, drops into any page
- Camera capture via `capture="environment"` with desktop file-picker fallback
- jscanify integration for auto edge detection + perspective correction
- Client-side quality gate (blur, resolution, darkness) with override
- HEIC → JPEG conversion via heic2any
- Multi-page capture + pdf-lib client-side combining
- Preview screen with retake / use-this
- EN/ES/PT translations for all UI strings
- Supabase upload + `task_completions` write
- Instruction text prop

**Out of scope for MVP:**
- Example image overlay
- Page reordering
- Enhancement filters (B&W, contrast boost)
- Server-side re-validation of quality
- Commercial SDK swap

**Blockers:** None. All dependencies are open-source and work in the existing stack.

### Phase 2 — Hardening & Staff UX

**Deliverables:**
- `evidence_metadata` JSONB column added to `task_completions` (if not in Phase 1)
- Staff review UI shows quality flags and page count
- Example image overlay for task types that have known-good reference photos
- Page reordering (drag desktop, long-press mobile)
- Enhancement filter pass (auto contrast/brightness after crop)
- Telemetry: track quality gate trigger rate, override rate, rejection rate post-upload

**Open question:** Should we log the *pre-override* quality scores even when tenant bypasses the gate? [Inference] yes — it lets staff prioritize review of flagged submissions.

### Phase 3 — Commercial SDK Evaluation (conditional)

Only if Phase 1 + 2 don't cut rejection rates meaningfully.

**Deliverables:**
- Evaluate Scanbot Web SDK against real rejection data [unverified pricing]
- A/B test in production: subset of units get Scanbot, rest stay on jscanify
- Decision: swap or stay

### Phase 4 — Lobby Intake Integration

**Deliverables:**
- Same component used by Will at the lobby desk for ID captures, insurance proof, etc.
- Desktop webcam mode (not just file picker) for the lobby iPad/tablet
- Tie-in with the in-progress lobby intake hardening work

---

## Technical Decisions (with Tradeoffs)

### Decision 1: jscanify vs Scanbot vs DIY
| Option | Pros | Cons |
|---|---|---|
| **jscanify (recommended for MVP)** | Free, open source, ~no recurring cost | Bundle size (~5–10MB OpenCV.js), quality ceiling unknown until tested |
| **Scanbot Web SDK** | Best-in-class UX, support, enhancement | [Unverified] licensing cost; vendor lock |
| **DIY (guidance rectangle, no detection)** | Minimal code | Marginal improvement over raw camera — probably not worth the build |

**Recommendation:** jscanify for Phase 1. Re-evaluate after real-world data.

### Decision 2: Quality gate — hard block vs override
Override. Hostile tenancy means a hard block = rage quit = zero document. A flagged submission beats no submission, and staff can prioritize review.

### Decision 3: Multi-page PDF vs separate files
Combined PDF. Staff reviewers in the document tracker already have one `fileName` field per doc. Keeping it to one file per task matches the existing review workflow.

### Decision 4: Where to run quality checks
Client-side only for MVP. Fast feedback loop, no server round trip. Server-side re-validation is Phase 2 — only matters if we start seeing client-bypass abuse.

### Decision 5: `evidence_metadata` storage
New JSONB column on `task_completions`. Forward-compatible with new quality checks, new capture methods, future metadata. Matches existing JSONB pattern in the stack.

---

## Open Questions

| Question | Owner | Blocker? |
|---|---|---|
| Are we OK with ~5–10MB OpenCV.js bundle on the tenant portal? | Alex | No — can lazy-load only when a `file_upload` task is active |
| Confirm HEIC is actually hitting us (check recent rejected uploads for `.heic` / `.HEIF`) | Alex | No |
| Should staff review UI show the pre-override quality scores? | Alex | No — Phase 2 decision |
| Is there a task type where PDF upload should be allowed directly (no camera)? Pre-existing PDFs of bank statements, etc. | Alex | No — MVP can include a "choose file" fallback for desktop and optionally mobile |

---

## Success Metrics

Post-launch, track:

- **Primary:** Document rejection rate (rejections per submitted doc). Baseline from PBV tracker data. Target: 50% reduction.
- **Secondary:** Round trips per approved doc (currently: blurry SS award = 2+ round trips). Target: <1.3 on average.
- **Guardrail:** Submission completion rate. If tenants start abandoning the flow more because of the extra UX, we over-tuned the quality gate.

---

## Dependencies

| Dep | Purpose | Bundle cost |
|---|---|---|
| `jscanify` | Edge detection + perspective | Includes OpenCV.js (~5–10MB) — lazy-load |
| `heic2any` | HEIC → JPEG conversion | ~200KB |
| `pdf-lib` | Multi-page PDF combining | ~500KB |

All client-side. No new server dependencies. No new Supabase tables (one column addition).
