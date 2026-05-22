# Autonomous / Batch Build — Failure Modes & Prevention

**A reusable retrospective.** Worked example: the PBV Full-App pipeline (2026-05), where ~84 PRDs were built in autonomous batches that passed every static gate, yet six after-the-fact audits surfaced 50+ defects. The *patterns* here are not PBV-specific — they are how AI-driven, gate-on-green, don't-stop-to-ask build pipelines fail in general. Keep this file portable; bring it to the next project.

**How to reuse this:** read Layer 3 (reasoning failures) and "What to change" first — those transfer directly. Layers 1–2 are the evidence that makes the lessons credible; swap in your own project's defects when you adapt it.

---

## The one sentence

Every gate the pipeline ran was a *compile / bundle / unit* gate, so it could only ever catch compile/bundle/unit defects — and the defects that piled up were precisely the ones no such gate can see: cross-file invariants, adversarial inputs, integration seams, and whole non-functional categories (accessibility, security headers, resilience, mobile viewport) that were never in anyone's definition of "done."

The sharpest evidence (PBV): summary signing was **broken for every user** (an endpoint returned HTTP 200 with body `{}` from a double idempotency wrap) while the unit suite was 47/47 green and the build was clean. Green gates, broken product. That gap is the whole story in miniature, and it generalizes: **a passing gate certifies only what it measures, never the product.**

---

## Layer 1 — Defect taxonomy: bugs cluster into a few repeating shapes

Across the PBV audits the findings were not 50 unrelated bugs — they were eight recurring shapes. Counting *by shape* is what makes a root cause visible. (Your project will have its own shapes; the move is to cluster, not list.)

| # | Defect shape | PBV example |
|---|---|---|
| 1 | **Systemic invariant fixed one instance at a time** (a property of *every* X, patched per-X) | storage-write-before-DB-guard race cloned across 5 write paths |
| 2 | **Fail-open defaults** (unknown input → the *more dangerous* action) | unknown form rule → generate the form anyway; unknown resolver → generic stamp |
| 3 | **Spec/implementation drift** (a property the design *asserted* was never enforced in code) | "shared signing logic," "I signed bytes with hash X" — neither true in code |
| 4 | **Duplicated logic that silently diverged** | two implementations of one signing flow drifted on attribution + naming |
| 5 | **Trusted client input** (header/body believed without verification) | auth header checked for existence only; MIME trusted over magic-bytes; no UUID/enum validation |
| 6 | **Whole non-functional categories with zero coverage** | accessibility, CSP/rate-limiting/security-headers, resilience/offline, mobile viewport |
| 7 | **Clock / timezone correctness** | server-local `new Date()` for expiry + idempotency windows |
| 8 | **Integration-seam defects invisible to unit tests** | double idempotency wrap → 200 `{}`; `Promise.all` fails-all-on-one in a dashboard |

Two facts matter more than the table:

**Shapes 1, 2, 5, 7 are *systemic invariants*, not local bugs.** "Storage and DB must commit consistently" is a property of *every* write path, but it was fixed one route at a time — which is exactly why the same race lived in five places. The pipeline kept treating a class of bug as a series of instances.

**Shape 6 is the largest by count and qualitatively different.** Those categories weren't *deprioritized* — they were *invisible*. No step ever named them, so they were never in scope. **You cannot defer what you never thought of.**

---

## Layer 2 — Process failures: what let these through

1. **Gates only saw a fraction of the risk surface.** `tsc` + `build` + *targeted* unit tests prove code compiles, bundles, and that the one file you touched behaves. They say nothing about races, fail-open logic, adversarial input, accessibility, or the wiring *between* files. The categories with the most findings were exactly the categories with no gate. The gate defined the scope of worry, instead of the scope of *risk* defining the gate.

2. **"Never block the chain" let errors compound.** Batches ran 5–6 units autonomously with review deferred to *after* the batch. A wrong default or a cloned bug at unit 1 propagated through all six before anyone looked. Optimizing for *not stopping* is blind to the thing most worth stopping for: a mistake that will repeat.

3. **Per-unit test isolation prevented pattern-sweeping.** Each unit tested only its own files (good for parallelism), so fixing a race in one route never triggered a search for the same shape elsewhere. The isolation that made batches safe also blinded them to clones.

4. **Runtime verification was deferred with no owner and no date.** "Manual walk later" with nothing scheduling or gating it means the only check that would catch integration-seam breaks runs days late, if at all. Deferred-with-no-owner is *never* until something breaks in front of a human.

5. **The most expensive gate was also the least informative.** Running a full production build after *every* unit was the dominant time cost *and* falsely reassuring — a clean build *feels* like proof, so it crowded out "but does it actually work end-to-end?" An expensive, low-signal gate is the worst of both worlds.

6. **The audit lens was an afterthought, not an in-loop step.** The audits — the first time anyone looked *across* files for patterns — were excellent and external. The pipeline had no in-loop equivalent of "stop and look across files for this shape."

---

## Layer 3 — Reasoning failures: how the thinking went wrong *(this is the transferable part)*

Each defect cluster came from a *specific reasoning move* that felt right and was wrong for the domain.

- **Fail-open defaults came from optimizing the wrong safety property.** "If unknown, don't lose data" is right when *missing* output is the worst case. In a compliance/document domain the worst case is *wrong* output. A data-loss-aversion heuristic was imported from a different problem without checking whether the safety property transferred. **Lesson: name the actual worst-case failure for *this* domain before choosing a default.**

- **Cloned bugs came from reasoning per-instance instead of per-invariant.** Each unit asked "is *this* endpoint correct?" and never "what invariant must *every* endpoint hold, and does it hold everywhere?" **Lesson: when a bug is really a violated invariant, fix the class and add a test that asserts the invariant, not the instance.**

- **Spec/impl drift came from confusing the document with the system.** Writing "shared logic" / "hash enforced" in a design made it *feel* true; nothing compared the assertion to the code. **Lesson: any claimed property needs a step that verifies the claim against the implementation.**

- **Duplicated logic came from "ship now, unify later" — and "later" has no owner.** Two copies of an intent are two sources of truth, and they always drift. **Lesson: deferred unification is a defect with a delay, not a clean-up task — treat it as debt with a due date.**

- **Trusted input came from never adopting the adversarial frame.** Every step imagined the *cooperative* caller. "Any client can send any header / body / file" was never a question asked. **Lesson: threat-modeling is a *mode of thinking* that must be a required step for any public surface — it won't surface on its own.**

- **Non-functional blindness came from an implicit definition of done: "it works for me, on the happy path."** Accessibility, security headers, offline behavior, and device quirks were never rejected — never *raised*. An unwritten definition of done defaults to the narrowest one. **Lesson: write "done" down, including the categories that are invisible by default.**

- **Green-gate overconfidence tied it together.** "Tests pass, build clean" was read as "it works." It meant "the things we chose to test pass." **Lesson: a gate's *coverage* is invisible, so its *green* is over-trusted — state explicitly what each gate does and does not certify.**

**The through-line:** the pipeline reasoned from what it was *looking at* (this file, this route, this happy path, this passing test) and almost never from what it *wasn't* looking at (every other route, the hostile caller, the disabled user, the untested seam). Clear thinking here means making the unlooked-at things explicit *as steps* — they will not appear on their own.

---

## What to change (portable checklist)

1. **Write the definition of "done" down — including the invisible categories.** A launch DoD that explicitly names accessibility, security headers + rate limiting, resilience/offline, mobile viewport, and an adversarial-input review. You can't skip what's on the list.

2. **Fix invariants at the class level, with a class-level test.** When a finding is a systemic invariant (races, fail-open, trusted input, clock), the unit must (a) grep for every clone, (b) fix them together, (c) test the invariant, not the instance.

3. **Add an adversarial-input section to every public-surface spec.** "What can a hostile client send, and what stops it?" — a required heading, not an optional thought.

4. **Verify assertions against code.** When a spec claims a property, a gate must prove it (a test that reads the code or exercises the path).

5. **Run a thin integration/runtime smoke at the *batch boundary*, with an owner and a date.** Even a 10-minute scripted walk of the critical path before a batch is "done." Unit-green ≠ working.

6. **Pattern-sweep checkpoint between batches (or use smaller batches).** One pass that looks *across* the touched files for cloned shapes before the next batch builds on top. Move the audit lens inside the loop.

7. **Right-size the build gate.** Per-unit gate = type-check + targeted tests (fast). Full production build = a *batch-boundary* gate, run once, alongside the smoke. This cuts cost *and* removes the false confidence of a green-build-per-unit.

8. **State what each gate certifies — and what it doesn't.** Make coverage visible so green isn't over-trusted.

---

## On tooling timing (the specific PBV symptom, generalizable)

The PBV batches ran ~50 minutes each. Diagnosis (grounded in the build reports; timing is *[inference]*, not wall-clock-measured):

- **Primary:** a full production build ran as a gate after *every* unit (6× in one batch, 5× in another). At a 300s build budget plus type-check plus tests, that's 30–45 min of *gate* time per batch before any implementation thinking. The most expensive operation was run the most times.
- **Secondary:** test runs went through `npx`, while the type-checker had already been switched to call the binary directly (`node ./node_modules/<bin>`) *specifically because* `npx` on Windows adds cold-start overhead (binary resolution, AV scanning, postinstall interference) that "frequently appears as a hang." The test invocations inherited the exact failure mode the protocol already knew about.
- **Tertiary:** a "kill and retry once on hang" rule means a single flaky build adds another build cycle.

**Fix (= change #7):** build once per batch; run targeted tests per unit, bypassing `npx`. This is both the timing fix and a confidence fix. *[Inference: Windows shell behavior is environment-dependent; this removes a known-risk pattern rather than guaranteeing a runtime.]*

---

## Scope & honesty notes

- The defect *shapes* and process facts are grounded in the PBV audits and build reports.
- The *reasoning-failure* layer is interpretive — the best reconstruction of the thinking that produced each cluster, not a recovered record. Treat it as analysis, not fact.
- Timing causes are inferences from the build reports + shell protocol, not reproduced under measurement.
- Many individual PBV instances are already fixed; this document is about the *pattern* that produced them, which is what transfers.
