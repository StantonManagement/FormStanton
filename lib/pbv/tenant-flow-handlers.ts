/**
 * PRD-70: pure decision helpers for two tenant-flow UX gaps.
 *
 * Extracted from the page components so the navigate-vs-error and
 * refetch-vs-reload decisions can be unit-tested without a DOM / Next router.
 *
 * Gap A (intake landing) — attemptUnitSaveAndDecide:
 *   The unit PATCH used to console.error a failure and navigate anyway.
 *   This helper returns whether navigation should proceed AND whether to
 *   surface an inline error. The page handler calls router.push only when
 *   navigate=true, and sets an error state when error is set.
 *
 * Gap B (documents error fallback) — chooseDocumentsRetryAction:
 *   The "Try again" button used to always window.location.reload(). PRD-67
 *   intentionally kept reload() for bootstrap errors ("intentional retry,
 *   not navigation"). This helper splits by error source: data-fetch errors
 *   recover via targeted refetch (no full reload, SPA state preserved);
 *   bootstrap and pageView errors keep PRD-67's reload().
 */

// ── Gap A ────────────────────────────────────────────────────────────────────

export type UnitSaveOutcome =
  | { navigate: true; error: null }
  | { navigate: false; error: 'unit_save_failed' };

export async function attemptUnitSaveAndDecide(args: {
  selectedUnit: string;
  initialUnit: string;
  patch: () => Promise<{ ok: boolean }>;
}): Promise<UnitSaveOutcome> {
  if (!args.selectedUnit || args.selectedUnit === args.initialUnit) {
    return { navigate: true, error: null };
  }
  try {
    const res = await args.patch();
    if (!res.ok) {
      return { navigate: false, error: 'unit_save_failed' };
    }
    return { navigate: true, error: null };
  } catch {
    return { navigate: false, error: 'unit_save_failed' };
  }
}

// ── Gap B ────────────────────────────────────────────────────────────────────

export type DocumentsRetryAction = 'refetch' | 'reload';

/**
 * The documents error block (`documents/page.tsx` ~`:232`) covers three error
 * sources: `state.status==='error'` (bootstrap), the local `error` string
 * (data-fetch), and `pageView.kind==='error'`.
 *
 * Bootstrap and pageView errors cannot be recovered by a docs refetch — they
 * need a full page reload (PRD-67's intentional behavior). A data-fetch-only
 * error CAN be recovered by `fetchDocuments(language)`, which clears `error`
 * before re-running.
 */
export function chooseDocumentsRetryAction(args: {
  hasBootstrapError: boolean;
  hasDataFetchError: boolean;
  hasPageViewError: boolean;
}): DocumentsRetryAction {
  if (args.hasBootstrapError || args.hasPageViewError) return 'reload';
  if (args.hasDataFetchError) return 'refetch';
  return 'reload';
}
