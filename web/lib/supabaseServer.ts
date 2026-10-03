import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only client. The service role key bypasses RLS, so it must never be
// exposed through a NEXT_PUBLIC_ variable.
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseServer: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
