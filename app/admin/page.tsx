import { redirect } from 'next/navigation';

// Legacy admin page — all functionality has been merged into the root page (/).
// This file only exists to redirect old /admin bookmarks.
export default function AdminRedirect() {
  redirect('/');
}
