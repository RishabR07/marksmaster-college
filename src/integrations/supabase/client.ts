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

// Prevent accidental writes to the example Lovable-hosted Supabase projects during development.
if (import.meta.env.DEV) {
  const exampleProjectIds = [
    "jeveqaovbpeinabanqut"
  ];

  try {
    const urlLower = (supabaseUrl || "").toLowerCase();
    for (const id of exampleProjectIds) {
      if (urlLower.includes(id)) {
        throw new Error(
          `[supabase] Detected example project (${id}). To use your own Supabase, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your local .env to your project's values and restart the dev server.`
        );
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    // Re-throw so app fails fast in dev and prevents accidental writes.
    throw e;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);