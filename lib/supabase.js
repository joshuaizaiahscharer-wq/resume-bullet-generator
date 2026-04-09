// Supabase client — server-side only.
// Uses the SERVICE_ROLE_KEY which bypasses Row Level Security.
// Never import this file in frontend/browser code.
const { createClient } = require("@supabase/supabase-js");

let _client = null;

/**
 * Returns a singleton Supabase client.
 * Lazily initialized so the server boots even when env vars are not yet set
 * (e.g. during local development without a .env file).
 */
function getSupabaseClient() {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "[supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set " +
        "before making database calls. Add them to your Vercel environment variables."
    );
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      // Disable automatic session persistence — not needed for server-side usage.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

// Export the getter so callers treat it like the client directly via Proxy,
// or use the named export for explicit calls.
//
// Usage:  const supabase = require('../lib/supabase');
//         const { data } = await supabase.from('purchases').select('*');
//
// The Proxy forwards property accesses to the lazily-created client,
// which means env vars are only required when a DB call is made — not at startup.
const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return getSupabaseClient()[prop];
    },
  }
);

module.exports = supabase;

// ─── Example: record a purchase ───────────────────────────────────────────────
// Call this from any server-side event to log a purchase.
//
// async function recordPurchase(email, product) {
//   const { error } = await supabase
//     .from("purchases")
//     .insert([{ email, product }]);
//
//   if (error) {
//     console.error("[supabase] recordPurchase error:", error.message);
//     throw error;
//   }
// }
//
// Schema for the `purchases` table:
//   id          uuid  default gen_random_uuid() primary key
//   email       text  not null
//   product     text  not null
//   created_at  timestamptz default now()
