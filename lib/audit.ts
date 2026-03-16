import { supabaseAdmin } from '@/lib/supabase';
import { SessionUser } from '@/lib/auth';

export async function logAudit(
  session: SessionUser | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: session?.userId || null,
      username: session?.username || session?.displayName || 'unknown',
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: details || {},
      ip_address: ipAddress || null,
    });
  } catch (error) {
    // Fire-and-forget: don't break the request if audit logging fails
    console.error('Audit log insert failed:', error);
  }
}

export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
