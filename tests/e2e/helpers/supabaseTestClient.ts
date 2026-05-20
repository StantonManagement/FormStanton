import { createClient } from '@supabase/supabase-js';

const testSupabaseUrl = process.env.SUPABASE_TEST_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const testServiceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!testSupabaseUrl || !testServiceRoleKey) {
  throw new Error(
    'Missing Supabase test credentials. Set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY or use NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

export const supabaseTestClient = createClient(
  testSupabaseUrl,
  testServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
