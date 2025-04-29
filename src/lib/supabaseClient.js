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
  },
};

// Use mock client in development, real client in production
export const supabase = process.env.NODE_ENV === 'development' 
  ? mockSupabaseClient 
  : createClient(supabaseUrl, supabaseAnonKey);

