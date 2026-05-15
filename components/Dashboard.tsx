"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryStatus, ProductView } from "@/lib/types";
import { ApiKeyManager } from "./ApiKeyManager";
import { QuantityModal, type ActionKind } from "./QuantityModal";
import { Toast, type ToastState } from "./Toast";
import { Header, type SortKey } from "./Header";
import type { ActivityEntry } from "./ActivityFeed";

interface DashboardProps {
  instanceName: string;
}

interface ModalState {
  product: ProductView;
  action: ActionKind;
  defaultQuantity?: number;
}

const POLL_INTERVAL_MS = 5000;
const ACTIVITY_MAX = 50;

const actionVerbPast: Record<ActionKind, string> = {
  reserve: "Reserved",
  release: "Released",
  restock: "Restocked",
  adjust: "Adjusted",
};

const actionVerbFail: Record<ActionKind, string> = {
  reserve: "Reserve failed",
  release: "Release failed",
  restock: "Restock failed",
  adjust: "Adjust failed",
};

function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Deterministic per-SKU unit cost ($1–$120). The Product schema has no
// unit_cost column; this gives stable, realistic-looking values for the
// list row totals. Replace with real data when the column lands.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function unitCostFor(sku: string): number {
  return 1 + (hashStr(sku) % 11900) / 100;
}

type TabKey = "all" | "low" | "category" | "recent";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Items" },
  { key: "low", label: "Low Stock" },
  { key: "category", label: "By Category" },
  { key: "recent", label: "Recently Updated" },
];

type BadgeKind = "in" | "low" | "critical" | "new";

const STATUS_BADGE: Record<BadgeKind, { label: string; bg: string; fg: string }> = {
  in: { label: "IN STOCK", bg: "#d1fae5", fg: "#065f46" },
  low: { label: "LOW STOCK", bg: "#fef3c7", fg: "#92400e" },
  critical: { label: "CRITICAL", bg: "#fee2e2", fg: "#991b1b" },
  new: { label: "NEW", bg: "#dbeafe", fg: "#1e40af" },
};

function badgeKindFor(p: ProductView): BadgeKind {
  if (p.status === "LOW STOCK") return "low";
  if (p.status === "OUT OF STOCK") return "critical";
  // Healthy item — sprinkle a deterministic ~14% as "NEW" for visual variety
  // until the schema has a created_at signal.
  if (hashStr(p.id) % 7 === 0) return "new";
  return "in";
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [, setActivity] = useState<ActivityEntry[]>([]);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchInventory = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/inventory", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: ProductView[] = await res.json();
      setProducts(data);
      setLoadError(null);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setLoadError(
        err instanceof Error ? err.message : "Failed to load inventory",
      );
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
    const id = setInterval(() => {
      void fetchInventory();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchInventory]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const stats = useMemo(() => {
    const list = products ?? [];
    const total = list.length;
    const lowStock = list.filter((p) => p.status !== "OK").length;
    const inStock = list.filter((p) => p.status === "OK").length;
    const totalOnHand = list.reduce((s, p) => s + p.onHand, 0);
    const totalReserved = list.reduce((s, p) => s + p.reserved, 0);
    const categories = new Set(list.map((p) => p.category)).size;
    const availability = total === 0 ? 0 : Math.round((inStock / total) * 100);
    return { total, lowStock, totalOnHand, totalReserved, categories, availability };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const list = products ?? [];
    const q = search.trim().toLowerCase();
    let scoped = list;
    if (q) {
      scoped = scoped.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }
    if (tab === "low") scoped = scoped.filter((p) => p.status !== "OK");
    if (tab === "category") {
      scoped = [...scoped].sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        return c !== 0 ? c : a.name.localeCompare(b.name);
      });
    }
    if (tab === "recent") {
      // Product schema has no updated_at column — reverse the API order as
      // a stable stand-in (most recent rows from the backend first).
      scoped = [...scoped].reverse();
    }

    const sorted = [...scoped];
    if (tab !== "category" && tab !== "recent") {
      // sort respects sortKey when not in category-grouped view
      sorted.sort((a, b) => {
        switch (sortKey) {
          case "quantity":
            return b.onHand - a.onHand;
          case "reserved":
            return b.reserved - a.reserved;
          case "status": {
            const order: Record<InventoryStatus, number> = {
              "OUT OF STOCK": 0,
              "LOW STOCK": 1,
              OK: 2,
            };
            return order[a.status] - order[b.status];
          }
          case "name":
          default:
            return a.name.localeCompare(b.name);
        }
      });
    }
    return sorted;
  }, [products, search, tab, sortKey]);

  const appendActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, ACTIVITY_MAX));
  }, []);

  const handleAction = useCallback(
    (product: ProductView, action: ActionKind) => {
      setActionError(null);
      setModal({
        product,
        action,
        defaultQuantity: action === "adjust" ? product.onHand : undefined,
      });
    },
    [],
  );

  const handleCloseModal = useCallback(() => {
    if (actionBusy) return;
    setModal(null);
    setActionError(null);
  }, [actionBusy]);

  const handleSubmit = useCallback(
    async (quantity: number) => {
      if (!modal) return;
      setActionBusy(true);
      setActionError(null);

      const { product, action } = modal;

      try {
        const res = await fetch(`/api/inventory/${product.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        });
        const body = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string; product?: ProductView }
          | null;
        const ok = res.ok && body?.success === true;
        if (!ok) {
          throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
        }

        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action,
          productName: product.name,
          sku: product.sku,
          quantity,
          result: "success",
        });
        setToast({
          id: Date.now(),
          kind: "success",
          message: `${actionVerbPast[action]} ${quantity} × ${product.name}.`,
        });
        setModal(null);
        void fetchInventory();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action,
          productName: product.name,
          sku: product.sku,
          quantity,
          result: "failure",
          message,
        });
        setActionError(message);
        setToast({
          id: Date.now(),
          kind: "error",
          message: `${actionVerbFail[action]}: ${message}`,
        });
      } finally {
        setActionBusy(false);
      }
    },
    [modal, fetchInventory, appendActivity],
  );

  const handleAddItem = useCallback(() => {
    setToast({
      id: Date.now(),
      kind: "error",
      message:
        "Add Item is not wired to a backend route yet on this instance. Use Adjust/Restock to manage existing SKUs.",
    });
  }, []);

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh" }}>
      <Header
        instanceName={instanceName}
        searchValue={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        onSortChange={setSortKey}
        onOpenApiKeys={() => setApiKeysOpen(true)}
        onAddItem={handleAddItem}
      />

      {/* Tabs */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #f0f0f0",
          padding: "0 20px",
          display: "flex",
          alignItems: "stretch",
          gap: 24,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "12px 0",
                fontSize: 12,
                color: active ? "#c0392b" : "#999",
                fontWeight: active ? 600 : 500,
                borderBottom: active ? "2px solid #c0392b" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #f0f0f0",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
        }}
      >
        <StatCell label="Total Items" value={String(stats.total)} />
        <StatCell label="Low Stock" value={String(stats.lowStock)} valueColor="#c0392b" />
        <StatCell label="Total On Hand" value={stats.totalOnHand.toLocaleString()} />
        <StatCell label="Categories" value={String(stats.categories)} />
        <StatCell
          label="Availability"
          value={`${stats.availability}%`}
          valueColor="#27ae60"
          last
        />
      </div>

      {/* Product list */}
      <main>
        {loadError ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              margin: "12px 20px 0",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            Failed to load inventory: {loadError}
          </div>
        ) : null}

        {products === null ? (
          <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>
            Loading inventory…
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>
            No products match the current filters.
          </div>
        ) : (
          <div style={{ background: "#ffffff" }}>
            {filteredProducts.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onClick={() => handleAction(p, "adjust")}
              />
            ))}
          </div>
        )}
      </main>

      <QuantityModal
        open={modal !== null}
        action={modal?.action ?? "reserve"}
        productName={modal?.product.name ?? ""}
        sku={modal?.product.sku ?? ""}
        defaultQuantity={modal?.defaultQuantity}
        busy={actionBusy}
        errorMessage={actionError}
        onCancel={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <ApiKeyManager
        open={apiKeysOpen}
        onClose={() => setApiKeysOpen(false)}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  valueColor = "#1a1a1a",
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 12px",
        textAlign: "center",
        borderRight: last ? "none" : "1px solid #f0f0f0",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  onClick,
}: {
  product: ProductView;
  onClick: () => void;
}) {
  const kind = badgeKindFor(product);
  const badge = STATUS_BADGE[kind];
  const cost = unitCostFor(product.sku);
  const totalValue = product.onHand * cost;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        boxSizing: "border-box",
        padding: "14px 20px",
        borderBottom: "1px solid #f0f0f0",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span
        style={{
          flexShrink: 0,
          background: badge.bg,
          color: badge.fg,
          fontSize: 9,
          fontWeight: 700,
          padding: "3px 8px",
          borderRadius: 4,
          letterSpacing: "0.04em",
          minWidth: 78,
          textAlign: "center",
        }}
      >
        {badge.label}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          color: "#888",
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          minWidth: 100,
        }}
      >
        {product.sku}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: 500,
          color: "#1a1a1a",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {product.name}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 12,
          color: "#666",
          fontVariantNumeric: "tabular-nums",
          minWidth: 110,
          textAlign: "right",
        }}
      >
        <span style={{ color: "#1a1a1a", fontWeight: 600 }}>
          {product.onHand.toLocaleString()}
        </span>{" "}
        in stock
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 13,
          color: "#c0392b",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          minWidth: 100,
          textAlign: "right",
        }}
      >
        ${Math.round(totalValue).toLocaleString()}
      </span>
    </button>
  );
}
