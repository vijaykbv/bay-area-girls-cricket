import { createClient } from "@supabase/supabase-js";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder";

function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.startsWith("https://") && !url.includes("your_supabase");
}

export const supabase = createClient(
  isConfigured() ? process.env.NEXT_PUBLIC_SUPABASE_URL! : PLACEHOLDER_URL,
  isConfigured() ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! : PLACEHOLDER_KEY
);

// Server-side client with service role key (bypasses RLS)
export function createServerClient() {
  if (!isConfigured()) {
    // Return a dummy client that always returns empty results
    return createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY);
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
