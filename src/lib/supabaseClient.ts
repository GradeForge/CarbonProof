import { createClient } from '@supabase/supabase-js';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined)
  ?? (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined) as string | undefined;
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY as string | undefined)
  ?? (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined) as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are missing. This project is pre-provisioned.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});
