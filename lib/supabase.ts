import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Server-side: prefer the service role key (bypasses RLS). Fall back to anon
  // only when service role isn't set — that path requires RLS to be disabled
  // or to have a policy permitting `anon` to read/write.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getInstanceName(): string {
  const raw = process.env.INSTANCE_NAME;
  const name = raw?.trim() ?? "";
  if (name === "") {
    throw new Error("INSTANCE_NAME env var is not set.");
  }
  return name;
}

export const PRODUCT_INVENTORY_TABLE = "product_inventory";
