import { redirect } from 'next/navigation';

export default function MyWorkRedirect() {
  // Preserve deep links by passing query params
  redirect('/admin/pbv/work');
}

