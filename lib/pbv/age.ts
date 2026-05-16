/**
 * lib/pbv/age.ts
 *
 * Shared age calculation utility.
 * Used by the bootstrap API route and useSectionVisibility hook.
 */

export function computeAge(dob: string): number | null {
  if (!dob) return null;
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
    age--;
  }
  return age;
}
