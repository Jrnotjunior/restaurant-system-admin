import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
}

let supabaseClient: SupabaseClient;

supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token ?? null;
  },
});

export const supabase = supabaseClient;
