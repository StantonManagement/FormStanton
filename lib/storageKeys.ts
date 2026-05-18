/**
 * Sanitize a string for use as a Supabase Storage object key segment.
 *
 * Supabase Storage rejects object keys containing characters outside a
 * conservative set with the error:
 *   "The string did not match the expected pattern."
 *
 * Mobile uploads commonly produce filenames like
 *   "Photo Jul 1, 2024 at 3:45 PM.jpg" or "IMG (1).HEIC"
 * which trip this validation. Use this helper any time a user-supplied
 * filename is interpolated into a storage path.
 */
export function sanitizeStorageSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}
