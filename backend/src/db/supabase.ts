import WebSocket from 'ws';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

// Load .env relative to the project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️  Supabase credentials not configured in backend/.env. Using local persistent database in data/lumina_db.json'
  );
}
