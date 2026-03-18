# Multi-Project Compliance — Phase 3: Tenant Portal
# Windsurf Implementation Prompt

---

## Before you write a single line of code

1. Read `multi-project-compliance-prp.md` in full.
2. Audit the existing tenant-facing form at `app/page.tsx` (the original onboarding form). This is your primary UI reference — the portal must feel like the same product.
3. Audit `app/api/t/[token]/route.ts` (Phase 1) to understand exactly what the token resolution endpoint returns.
4. Audit `types/compliance.ts` for all Phase 1 types — use them, do not redefine.
5. Audit the forms library to understand how a form is rendered when `evidence_type = 'form'` — you will need to embed or link to it.
6. Read `lib/buildings.ts` and any existing translation/i18n patterns in the original form. Language handling here must match what already exists.
7. Do not guess. Read first.

---

## Objective

Build the tenant-facing portal at `/t/[token]`. This is the page tenants land on when they click the link in their SMS. They see their task list, complete each task, and leave.

This is the most user-facing thing in the entire system. The audience is 20–40% hostile — they do not want to be here, they will look for any excuse to abandon. Design accordingly:
- No friction
- No confusion about what is required
- No exits that look like they complete the form
- Two taps where possible
- Mobile first, always

---

## Route

`/t/[token]` — public, no authentication required.

---

## Step 1 — Token Resolution

On page load:
1. Call GET `/api/t/[token]`
2. Handle responses:
   - **404** — show "This link is not valid." No other explanation.
   - **410** — show "This link has expired. Contact your property manager for a new one."
   - **200** — render the portal

The 200 response contains:
- `project.name`, `project.deadline`
- `preferred_language` — load the portal in this language immediately, no selector shown
- `tasks[]` — ordered list of tasks with their current `completion.status`

---

## Step 2 — Portal Shell

**Header:**
- Stanton Management logo/name (match the original form header)
- Project name
- Deadline — displayed prominently: "Complete by [date]"
- Language: auto-set from `preferred_language`. If unknown/fallback, show language selector (EN/ES/PT) — same behavior as original form.

**Task list:**
- All tasks shown regardless of sequential mode
- Each task shows: task name, status indicator (complete/pending/locked), instructions if present
- Sequential mode: tasks after the first incomplete one are visually locked — shown but not interactive
- Parallel mode: all tasks interactive
- Completed tasks show a green checkmark and are not re-submittable

**Progress indicator:**
- "2 of 4 tasks complete" — simple, visible, updates in real time as tasks complete

**Completion screen:**
- When all tasks are complete, replace task list with: "You're done. Thank you." + summary of what was submitted
- No confetti, no marketing. Institutional tone.

---

## Step 3 — Task UI by Evidence Type

Each task type renders a different input UI. All task submissions POST to a new endpoint (see Step 4).

### `acknowledgment`
- Checkbox: "[instructions text]" or default "I acknowledge receipt of this document."
- Submit button
- One tap to complete

### `signature`
- Instructions text
- Signature canvas (use `react-signature-canvas` — already in the project)
- "Clear" and "Submit" buttons
- Must not be submittable with empty canvas

### `file_upload`
- Instructions text
- File picker — accepts PDF, JPG, PNG
- Upload progress indicator
- Submit button — disabled until file selected

### `photo`
- Instructions text (e.g. "Take a photo holding today's newspaper")
- File picker with camera capture hint (`accept="image/*" capture="environment"` on mobile)
- Preview of selected image before submit
- Submit button

### `form`
- Instructions text
- Embedded form from the forms library OR a "Open Form" button that opens the form in context
- On form submission, the task completion is linked via `form_submission_id`
- If embedding is complex, a full-page redirect to the form with a return token is acceptable — but keep the tenant in the flow

### `staff_check`
- Not shown to tenants
- Render as: "[Task name] — Will be verified by staff" with a gray pending indicator
- Not interactive

---

## Step 4 — Task Completion API

Create a new endpoint:

```
POST /api/t/[token]/tasks/[taskId]/complete
```

No auth — validated by token only.

**For non-file evidence types:**
Body: `{ notes?: string, signature_data?: string (base64) }`

**For file evidence types (file_upload, photo):**
- Accept multipart form data
- Upload file to Supabase Storage under `project-evidence/[project_unit_id]/[task_id]/[filename]`
- Store the resulting URL as `evidence_url` on the `task_completions` row

**Logic:**
1. Resolve token → `project_units` row
2. Verify `task_completions` row exists for this `project_task_id` and `project_unit_id`
3. Verify task is not already complete
4. If sequential: verify all prior tasks are complete — return 403 if not
5. Update `task_completions`: status = 'complete', completed_by = 'tenant', completed_at = now(), evidence_url if applicable
6. Recompute `project_units.overall_status`:
   - all required tasks complete → 'complete'
   - any complete → 'in_progress'
   - none complete → 'not_started'
7. Return updated task list

---

## Step 5 — Translations

The portal must be fully translated in EN/ES/PT. Add portal-specific strings to whatever translation system the original form uses. Strings needed:

| Key | EN | ES | PT |
|---|---|---|---|
| deadline_label | Complete by | Completar antes del | Concluir até |
| progress_label | {n} of {total} tasks complete | {n} de {total} tareas completadas | {n} de {total} tarefas concluídas |
| link_invalid | This link is not valid. | Este enlace no es válido. | Este link não é válido. |
| link_expired | This link has expired. Contact your property manager for a new one. | Este enlace ha expirado. Contacte a su administrador. | Este link expirou. Entre em contato com seu gerente. |
| task_locked | Complete previous tasks first. | Complete las tareas anteriores primero. | Conclua as tarefas anteriores primeiro. |
| staff_check_label | Will be verified by staff. | Será verificado por el personal. | Será verificado pela equipe. |
| submit | Submit | Enviar | Enviar |
| clear | Clear | Limpiar | Limpar |
| all_complete_title | You're done. | Listo. | Concluído. |
| all_complete_body | Thank you for completing your tasks. | Gracias por completar sus tareas. | Obrigado por concluir suas tarefas. |
| acknowledgment_default | I acknowledge receipt of this document. | Reconozco haber recibido este documento. | Reconheço o recebimento deste documento. |

---

## Step 6 — Verify

- `tsc --noEmit` must pass with zero errors
- `next build` must pass clean
- Test the full flow manually:
  1. Activate a test project via the Phase 2 UI
  2. Copy a tenant link from the Send Links tab
  3. Open it — portal loads in correct language with task list
  4. Complete each task type — each updates to green in real time
  5. All tasks complete — completion screen shows
  6. In the admin Units tab, the unit shows `overall_status = complete`
- 404 and 410 error states render correctly
- No existing pages, components, hooks, or API routes modified

---

## Explicitly out of scope for this phase

- Twilio SMS delivery
- Admin matrix integration (Phase 4)
- Push notifications
- Any changes to existing compliance, forms, or submission flows
