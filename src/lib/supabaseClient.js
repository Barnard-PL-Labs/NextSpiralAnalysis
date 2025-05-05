import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Mock client for local development
const mockSupabaseClient = {
  from: (table) => ({
    select: async () => ({ data: [], error: null }),
    insert: async () => ({ data: {}, error: null }),
    update: async () => ({ data: {}, error: null }),
    delete: async () => ({ data: null, error: null }),
  }),
  auth: {
    signIn: async () => ({ user: null, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: null, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
  },
};

// Create the Supabase client
export const supabase = !supabaseUrl || !supabaseAnonKey
  ? mockSupabaseClient
  : createClient(supabaseUrl, supabaseAnonKey);
