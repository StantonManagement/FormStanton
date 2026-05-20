import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public, anon-keyed client. Safe to use from browser bundles.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service-role-keyed admin client.
 *
 * Constructed *lazily* so this module can be safely transitively imported by
 * client components without crashing the entire page. Eager construction of
 * createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!) at module top
 * level throws "supabaseKey is required" in the browser, because non-
 * `NEXT_PUBLIC_` env vars are inlined as `undefined` in client bundles.
 *
 * In the browser, accessing any property on this client throws — surfaces
 * the misuse immediately at the offending callsite instead of breaking an
 * unrelated tenant page on mount.
 */
export const supabaseAdmin: SupabaseClient = (() => {
  if (typeof window !== 'undefined') {
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error(
          'supabaseAdmin cannot be used in the browser. Move the call to a server route handler or server component.'
        );
      },
    });
  }
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
})();
