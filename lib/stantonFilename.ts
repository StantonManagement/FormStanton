/**
 * Builds the Stanton at-rest filename for per-document uploads.
 *
 * Submission-level (person_slot = 0):
 *   {AssetID}_{Unit} - {DocType} - {LastName} - {YYYYMMDD} - v{Revision}.{ext}
 *
 * Per-person (person_slot >= 1):
 *   {AssetID}_{Unit} - {DocType} - {LastName} - P{slot} - {YYYYMMDD} - v{Revision}.{ext}
 *
 * LastName is always the head-of-household surname.
 * DocType is the human-readable label, not the slug.
 * If the result exceeds 200 chars: truncate DocType first, then LastName.
 * P{slot} is never truncated.
 */
export function buildStantonFilename(params: {
  assetId: string;
  unit: string;
  docLabel: string;
  lastName: string;
  personSlot: number;
  revision: number;
  ext: string;
  date?: string; // YYYYMMDD — defaults to today (UTC)
}): string {
  const { assetId, unit, docLabel, lastName, personSlot, revision, ext } = params;
  const date =
    params.date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const segments: string[] = [`${assetId}_${unit}`, docLabel, lastName];
  if (personSlot >= 1) segments.push(`P${personSlot}`);
  segments.push(date, `v${revision}`);

  const filename = segments.join(' - ') + `.${ext}`;
  if (filename.length <= 200) return filename;

  // Fixed portions that cannot be truncated
  const head = `${assetId}_${unit}`;
  const tail =
    personSlot >= 1
      ? ` - P${personSlot} - ${date} - v${revision}.${ext}`
      : ` - ${date} - v${revision}.${ext}`;

  // Budget for " - {docLabel} - {lastName}" portion (6 = two separators ' - ')
  const budget = 200 - head.length - tail.length - 6;
  const docBudget = Math.max(3, Math.floor(budget * 0.6));
  const nameBudget = Math.max(3, budget - docBudget);

  const truncDoc = docLabel.slice(0, docBudget);
  const truncName = lastName.slice(0, nameBudget);

  const truncSegments: string[] = [head, truncDoc, truncName];
  if (personSlot >= 1) truncSegments.push(`P${personSlot}`);
  truncSegments.push(date, `v${revision}`);

  return truncSegments.join(' - ') + `.${ext}`;
}

/** Extracts the file extension (without dot) from a filename, lower-cased. */
export function getExtension(filename: string | undefined | null): string {
  if (!filename) return 'bin';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

/** Extracts the head-of-household last name from a full name string. */
export function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}
