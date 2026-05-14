import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const instanceName = process.env.INSTANCE_NAME;

function describe(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  return {
    length: value.length,
    json: JSON.stringify(value),
    codes: [...value].map((c) => c.charCodeAt(0)),
  };
}

console.log("INSTANCE_NAME:", describe(instanceName));
console.log("NEXT_PUBLIC_INSTANCE_NAME:", describe(process.env.NEXT_PUBLIC_INSTANCE_NAME));
console.log("SUPABASE_URL set:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY set:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("SUPABASE_ANON_KEY set:", !!process.env.SUPABASE_ANON_KEY);

const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

// Decode role from JWT (middle segment, base64url)
function decodeRole(jwt) {
  try {
    const mid = jwt.split(".")[1];
    const b64 = mid.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json).role ?? "(no role)";
  } catch {
    return "(unparseable)";
  }
}
console.log("Using key with role:", decodeRole(key));

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

console.log("\n--- 1. Distinct instance_name values in product_inventory ---");
{
  const { data, error } = await supabase
    .from("product_inventory")
    .select("instance_name");
  if (error) {
    console.log("error:", error);
  } else {
    const counts = {};
    for (const r of data ?? []) {
      counts[r.instance_name] = (counts[r.instance_name] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(counts)) {
      console.log(`  ${JSON.stringify(k)} (len=${k.length}): ${v} rows`);
    }
  }
}

console.log("\n--- 2. Query with INSTANCE_NAME env value verbatim ---");
{
  const { data, error, count } = await supabase
    .from("product_inventory")
    .select("sku,product_name", { count: "exact" })
    .eq("instance_name", instanceName);
  if (error) console.log("error:", error);
  console.log(`  count = ${count}`);
  console.log(`  first row =`, (data ?? [])[0] ?? null);
}

console.log("\n--- 3. Query with .trim()'d value (sanity) ---");
{
  const trimmed = (instanceName ?? "").trim();
  const { count, error } = await supabase
    .from("product_inventory")
    .select("*", { count: "exact", head: true })
    .eq("instance_name", trimmed);
  if (error) console.log("error:", error);
  console.log(`  trimmed=${JSON.stringify(trimmed)} count=${count}`);
}
