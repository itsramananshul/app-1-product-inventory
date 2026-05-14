import {
  PRODUCT_INVENTORY_TABLE,
  getInstanceName,
  getSupabase,
} from "./supabase";
import type { InventoryStatus, ProductView } from "./types";

interface DbRow {
  id: string;
  instance_name: string;
  sku: string;
  product_name: string;
  category: string;
  on_hand: number;
  reserved: number;
  reorder_threshold: number;
  created_at: string;
  updated_at: string;
}

function computeStatus(available: number, threshold: number): InventoryStatus {
  if (available <= 0) return "OUT OF STOCK";
  if (available <= threshold) return "LOW STOCK";
  return "OK";
}

function toView(row: DbRow): ProductView {
  const available = row.on_hand - row.reserved;
  return {
    id: row.id,
    sku: row.sku,
    name: row.product_name,
    category: row.category,
    onHand: row.on_hand,
    reserved: row.reserved,
    reorderThreshold: row.reorder_threshold,
    available,
    status: computeStatus(available, row.reorder_threshold),
  };
}

export type StoreError =
  | { kind: "not_found" }
  | { kind: "invalid_quantity" }
  | { kind: "reserve_exceeds_on_hand" }
  | { kind: "release_below_zero" }
  | { kind: "adjust_below_reserved" }
  | { kind: "db_error"; message: string };

export type MutationResult =
  | { ok: true; product: ProductView }
  | { ok: false; error: StoreError };

export async function listProducts(): Promise<ProductView[]> {
  const supabase = getSupabase();
  const instance = getInstanceName();
  // TEMPORARY DIAGNOSTIC — remove once empty-results bug is verified fixed.
  console.log(
    `[inventory-store] listProducts instance_name=${JSON.stringify(instance)} (len=${instance.length})`,
  );
  const { data, error } = await supabase
    .from(PRODUCT_INVENTORY_TABLE)
    .select("*")
    .eq("instance_name", instance)
    .order("sku", { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data as DbRow[] | null) ?? [];
  console.log(`[inventory-store] listProducts returned ${rows.length} row(s)`);
  return rows.map(toView);
}

export async function getProduct(id: string): Promise<ProductView | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(PRODUCT_INVENTORY_TABLE)
    .select("*")
    .eq("instance_name", getInstanceName())
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toView(data as DbRow) : null;
}

export async function productCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from(PRODUCT_INVENTORY_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("instance_name", getInstanceName());

  if (error) throw new Error(error.message);
  return count ?? 0;
}

function validateQuantity(quantity: unknown): number | null {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) return null;
  if (!Number.isInteger(quantity)) return null;
  if (quantity <= 0) return null;
  return quantity;
}

async function readRow(id: string): Promise<DbRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(PRODUCT_INVENTORY_TABLE)
    .select("*")
    .eq("instance_name", getInstanceName())
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DbRow | null) ?? null;
}

async function writeRow(
  id: string,
  patch: Partial<Pick<DbRow, "on_hand" | "reserved">>,
): Promise<DbRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(PRODUCT_INVENTORY_TABLE)
    .update(patch)
    .eq("instance_name", getInstanceName())
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DbRow | null) ?? null;
}

async function applyMutation(
  id: string,
  quantity: unknown,
  validate: (row: DbRow, qty: number) => StoreError | null,
  buildPatch: (
    row: DbRow,
    qty: number,
  ) => Partial<Pick<DbRow, "on_hand" | "reserved">>,
): Promise<MutationResult> {
  const qty = validateQuantity(quantity);
  if (qty === null) return { ok: false, error: { kind: "invalid_quantity" } };

  try {
    const row = await readRow(id);
    if (!row) return { ok: false, error: { kind: "not_found" } };

    const err = validate(row, qty);
    if (err) return { ok: false, error: err };

    const updated = await writeRow(id, buildPatch(row, qty));
    if (!updated) return { ok: false, error: { kind: "not_found" } };

    return { ok: true, product: toView(updated) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return { ok: false, error: { kind: "db_error", message } };
  }
}

export function reserve(
  id: string,
  quantity: unknown,
): Promise<MutationResult> {
  return applyMutation(
    id,
    quantity,
    (row, qty) =>
      row.reserved + qty > row.on_hand
        ? { kind: "reserve_exceeds_on_hand" }
        : null,
    (row, qty) => ({ reserved: row.reserved + qty }),
  );
}

export function release(
  id: string,
  quantity: unknown,
): Promise<MutationResult> {
  return applyMutation(
    id,
    quantity,
    (row, qty) =>
      row.reserved - qty < 0 ? { kind: "release_below_zero" } : null,
    (row, qty) => ({ reserved: row.reserved - qty }),
  );
}

export function restock(
  id: string,
  quantity: unknown,
): Promise<MutationResult> {
  return applyMutation(
    id,
    quantity,
    () => null,
    (row, qty) => ({ on_hand: row.on_hand + qty }),
  );
}

function validateNonNegativeInt(quantity: unknown): number | null {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) return null;
  if (!Number.isInteger(quantity)) return null;
  if (quantity < 0) return null;
  return quantity;
}

export async function adjust(
  id: string,
  quantity: unknown,
): Promise<MutationResult> {
  const qty = validateNonNegativeInt(quantity);
  if (qty === null) return { ok: false, error: { kind: "invalid_quantity" } };

  try {
    const row = await readRow(id);
    if (!row) return { ok: false, error: { kind: "not_found" } };

    if (qty < row.reserved) {
      return { ok: false, error: { kind: "adjust_below_reserved" } };
    }

    const updated = await writeRow(id, { on_hand: qty });
    if (!updated) return { ok: false, error: { kind: "not_found" } };

    return { ok: true, product: toView(updated) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return { ok: false, error: { kind: "db_error", message } };
  }
}
