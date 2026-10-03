import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env relative to the project root (works regardless of cwd)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.\n' +
    'Make sure backend/.env is filled in with values from Supabase Dashboard → Settings → API.\n' +
    `SUPABASE_URL present: ${!!supabaseUrl}, SUPABASE_SERVICE_KEY present: ${!!supabaseKey}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
