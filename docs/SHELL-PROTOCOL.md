# Shell Protocol for Build Agents

Canonical rules for running shell commands in this codebase. Every build prompt should reference this file rather than duplicating shell rules. Update here once; all prompts inherit.

---

## Core principles

1. **Explicit timeouts, single retry, then stop and report.** No infinite retries, no silent workarounds.
2. **No `yarn` / `pnpm`.** This is an npm repo. If npm hangs, debug npm; don't switch package managers.
3. **No `npm run dev` from agent commands.** It's a long-running process, looks like a hang, never exits.
4. **Distinguish LLM-thinking from shell-hung.** Sonnet can pause up to ~30s. A shell command with no output for 60+ seconds is a real hang.

---

## TypeScript type-checking

**Do not run `npx tsc --noEmit`.** On Windows, `npx` adds cold-start overhead (binary resolution, anti-virus scanning, occasional Husky postinstall interference) that frequently appears as a hang. Use one of these instead:

**Preferred — bypass npx, run the binary directly:**
```sh
node ./node_modules/typescript/bin/tsc --noEmit
```

**Alternative — use the project's npm script** if `package.json` has one (`typecheck`, `type-check`, or `tsc`):
```sh
npm run typecheck
```

**Timeout:** ~60-90s for a clean type-check of this codebase (200+ routes, large dependency graph). If no output for 90s, kill and retry once.

**Verbose mode** to investigate slowness or hangs (rare):
```sh
node ./node_modules/typescript/bin/tsc --noEmit --extendedDiagnostics
```

---

## npm

- **Timeout:** `npm install` ~120s, `npm run build` ~300s, `npm ci` ~120s.
- **Prefer `npm ci --no-audit --no-fund --prefer-offline`** over `npm install` when `package-lock.json` is current — faster, deterministic, less likely to hang.
- **Postinstall / Husky hangs:** retry once with `HUSKY=0 npm ci --ignore-scripts --no-audit --no-fund`. Note the workaround in the build report.
- **One install per PRD.** Don't run `npm install <pkg>` multiple times in a single build session.
- **Dependency changes:** add `scanic` (or whatever) once. Lock the version in `package-lock.json`. Don't loop.

---

## Next.js build

```sh
npm run build
```

- Timeout: 300s.
- On hang: kill, retry once with the same command.
- If the second attempt also hangs, capture the last output and stop. Do NOT try `next build` directly or change the build script — the failure mode is the signal.

---

## Git

- No timeout concerns; git is fast.
- `git push` and `git fetch` can hit network — if they hang >30s, network is the problem, not git. Retry once.

---

## Migration / database commands

- This codebase uses Supabase migrations checked into `supabase/migrations/`.
- Migrations are applied via the Supabase dashboard or CLI on deploy, NOT by build agents directly.
- If a PRD requires a migration, the build agent creates the `.sql` file and adds it to the repo. It does not execute the migration.

---

## When to stop and report

After 2 retries on the same command:
- Stop.
- Capture the exact command, the exact output (or lack thereof), and the wall-clock time elapsed.
- Report to Alex with that data.
- Do NOT invent workarounds (e.g., switching package managers, disabling parts of the build, mocking out failing checks).

The "stuck" report itself is valuable signal. Silent workarounds aren't.

---

## How prompts should reference this file

In a PRD build prompt, the shell-protocol section can be reduced to:

> **Shell protocol:** see `docs/SHELL-PROTOCOL.md`. PRD-specific deviations (if any) listed here:
> - [deviation 1, if needed]
> - [deviation 2, if needed]

If there are no PRD-specific deviations, the section is one line. If a PRD genuinely needs different rules (e.g., a longer timeout because it involves a heavy data migration), call those out specifically; don't restate the full protocol.
