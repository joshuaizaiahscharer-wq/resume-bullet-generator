let cachedClient = null;

export async function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  if (!window.supabase?.createClient) {
    throw new Error("Supabase client library is not loaded.");
  }

  const response = await fetch("/api/public-auth-config");
  const config = await response.json();

  const supabaseUrl = config?.supabaseUrl || "";
  const supabaseAnonKey = config?.supabaseAnonKey || config?.supabasePublishableKey || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase URL or anon key.");
  }

  cachedClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}
