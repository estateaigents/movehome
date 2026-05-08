// Service-role Supabase client — bypasses RLS. Use only in API routes that
// need to write to RLS-locked tables (e.g. /api/enquire inserting into
// tbl_enquiries). NEVER import this from a client component or expose the
// key to the browser.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let admin: SupabaseClient<Database> | null = null;

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'createSupabaseAdminClient: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.'
    );
  }
  admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return admin;
}
