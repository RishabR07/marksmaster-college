import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Log configured Supabase project during development to help debugging
if (import.meta.env.DEV) {
  try {
    // mask key for safety
    const maskedKey = supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...${supabaseAnonKey.slice(-4)}` : "(none)";
    // eslint-disable-next-line no-console
    console.info("[supabase] configured url:", supabaseUrl, "publishableKey:", maskedKey);
  } catch (e) {
    // ignore logging errors
  }
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);