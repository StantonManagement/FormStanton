/**
 * Edit Window Helper
 *
 * Messages are append-only after a 5-minute edit grace window.
 * Only the author can edit within the window.
 */

export const EDIT_WINDOW_MINUTES = 5;

/**
 * Check if the edit window is still open for a message.
 * @param createdAt — ISO timestamp or Date object from the message's created_at
 * @returns true if within 5 minutes of creation, false otherwise
 */
export function isEditWindowOpen(createdAt: string | Date): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const ageMs = Date.now() - created.getTime();
  return ageMs <= EDIT_WINDOW_MINUTES * 60 * 1000;
}
