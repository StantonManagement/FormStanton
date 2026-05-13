// Shared utilities for review components

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

export function getEffectiveStatus(doc: any): string {
  const la = doc.latest_action;
  if (!la) return doc.status ?? 'pending';
  if (la.action === 'approved') return 'approved';
  if (la.action === 'rejected') return 'rejected';
  if (la.action === 'waived') return 'waived';
  return doc.status ?? 'pending';
}

export function inferFileType(fileName: string | null): 'pdf' | 'image' | 'unknown' {
  if (!fileName) return 'unknown';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  return 'unknown';
}
