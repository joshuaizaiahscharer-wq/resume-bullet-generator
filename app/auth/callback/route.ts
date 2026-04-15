import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.auth.exchangeCodeForSession(code);
  }

  const next = url.searchParams.get("next") || "/";
  return NextResponse.redirect(new URL(next, url.origin));
}
