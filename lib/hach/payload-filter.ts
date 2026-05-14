/**
 * HACH Payload Filter
 *
 * Enforces the confidentiality wall between Stanton internal review data
 * and the HACH reviewer portal at the API layer.
 *
 * Usage: wrap every HACH endpoint's NextResponse.json() payload with safeHachJson().
 */

export const HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL: ReadonlySet<string> = new Set([
  'stanton_review_notes',
  'stanton_reviewer',
  'stanton_review_date',
  'internal_notes',
]);

/**
 * Keys that are only banned when they appear inside a document object.
 * A document object is identified by the presence of `doc_type` OR `document_id` on
 * the same object. This prevents false positives on other shapes that legitimately
 * use `notes`.
 */
export const HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED: ReadonlySet<string> = new Set([
  'notes',
  'reviewer',
  'reviewed_at',
  'uploaded_by_role',
  'uploaded_by_user_id',
  'uploaded_by_display_name',
  'staff_upload_note',
  'original_doc_type',
]);

export const HACH_PAYLOAD_BANNED_KEYS: ReadonlySet<string> = new Set([
  ...HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL,
  ...HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED,
]);

function isDocumentObject(obj: Record<string, unknown>): boolean {
  return 'doc_type' in obj;
}

function isBannedKey(key: string, parentObj: Record<string, unknown>): boolean {
  if (HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL.has(key)) return true;
  if (HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED.has(key) && isDocumentObject(parentObj)) return true;
  return false;
}

/**
 * Recursively walks `payload` and throws an Error if any banned key is found.
 * Only active in non-production environments.
 */
export function assertNoBannedKeys(payload: unknown, path = 'root'): void {
  if (process.env.NODE_ENV === 'production') return;

  if (Array.isArray(payload)) {
    payload.forEach((item, i) => assertNoBannedKeys(item, `${path}[${i}]`));
    return;
  }

  if (payload !== null && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (isBannedKey(key, obj)) {
        throw new Error(
          `[HACH payload violation] Banned key "${key}" found at path "${path}.${key}". ` +
          `Remove this field from the SELECT or wrap the response with safeHachJson().`
        );
      }
      assertNoBannedKeys(obj[key], `${path}.${key}`);
    }
  }
}

/**
 * Recursively walks a deep clone of `payload` and removes all banned keys.
 * Used in production — silent removal + console.warn.
 */
export function stripBannedKeys<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => stripBannedKeys(item)) as unknown as T;
  }

  if (payload !== null && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (isBannedKey(key, obj)) {
        console.warn(
          `[HACH payload filter] Stripped banned key "${key}" from response payload in production. ` +
          `This key should have been removed from the SELECT.`
        );
        continue;
      }
      result[key] = stripBannedKeys(obj[key]);
    }
    return result as unknown as T;
  }

  return payload;
}

/**
 * In development: calls assertNoBannedKeys (throws loudly on violation).
 * In production: calls stripBannedKeys (silent removal + warn).
 *
 * Wrap every HACH endpoint's data payload with this before NextResponse.json().
 */
export function safeHachJson<T>(data: T): T {
  if (process.env.NODE_ENV !== 'production') {
    assertNoBannedKeys(data);
    return data;
  }
  return stripBannedKeys(data);
}
