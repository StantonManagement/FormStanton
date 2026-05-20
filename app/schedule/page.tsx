import { redirect } from 'next/navigation';

export default function ScheduleRedirect() {
  // Redirect to admin if no token provided
  redirect('/admin/scheduling/today');
}
