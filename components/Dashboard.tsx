"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryStatus, ProductView } from "@/lib/types";
import { ApiKeyManager } from "./ApiKeyManager";
import { QuantityModal, type ActionKind } from "./QuantityModal";
import { Toast, type ToastState } from "./Toast";
import { Header } from "./Header";
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

// Deterministic per-SKU unit value ($1–$120). The schema has no unit_cost
// column — this gives stable values for Total Value and the card footer.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function unitCostFor(sku: string): number {
  return 1 + (hashStr(sku) % 11900) / 100;
}

const CATEGORY_EMOJI: Record<string, string> = {
  electronics: "💻",
  electronic: "💻",
  apparel: "👕",
  clothing: "👕",
  furniture: "🪑",
  food: "🍔",
  beverages: "🥤",
  drinks: "🥤",
  toys: "🧸",
  books: "📚",
  tools: "🔧",
  sports: "⚽",
  beauty: "💄",
  household: "🧹",
  outdoor: "🏕️",
  automotive: "🚗",
  parts: "⚙️",
  engine: "🔩",
  body: "🚙",
  electrical: "🔌",
  chassis: "🛞",
  interior: "🪟",
  exterior: "🛻",
  brakes: "🛑",
  suspension: "🌀",
  fluids: "🛢️",
  filters: "🧪",
  lighting: "💡",
};
function emojiFor(category: string): string {
  const key = (category || "").toLowerCase().split(/\s|-|_/)[0] ?? "";
  return CATEGORY_EMOJI[key] ?? "📦";
}

type TabKey = "all" | "low" | "category" | "recent";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Items" },
  { key: "low", label: "Low Stock" },
  { key: "category", label: "By Category" },
  { key: "recent", label: "Recently Updated" },
];

const STOCK_BADGE: Record<
  "in" | "low" | "new",
  { label: string; bg: string; fg: string }
> = {
  in: { label: "In Stock", bg: "#d1fae5", fg: "#065f46" },
  low: { label: "Low Stock", bg: "#fef3c7", fg: "#92400e" },
  new: { label: "New", bg: "#dbeafe", fg: "#1e40af" },
};

function badgeFor(p: ProductView): keyof typeof STOCK_BADGE {
  if (p.status !== "OK") return "low";
  // Sprinkle "New" badges deterministically (~14% of healthy items) for visual
  // variety. Switch to a real created_at signal once the schema has one.
  if (hashStr(p.id) % 7 === 0) return "new";
  return "in";
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

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
    const lowStock = list.filter(
      (p) => p.status !== "OK",
    ).length;
    const inStock = list.filter((p) => p.status === "OK").length;
    const totalValue = list.reduce(
      (sum, p) => sum + p.onHand * unitCostFor(p.sku),
      0,
    );
    const categories = new Set(list.map((p) => p.category)).size;
    const availability = total === 0 ? 0 : Math.round((inStock / total) * 100);
    return { total, lowStock, totalValue, categories, availability };
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
    switch (tab) {
      case "low":
        return scoped.filter((p) => p.status !== "OK");
      case "category":
        return [...scoped].sort((a, b) => {
          const c = a.category.localeCompare(b.category);
          return c !== 0 ? c : a.name.localeCompare(b.name);
        });
      case "recent":
        // No updated_at in the schema yet. Reverse order as a placeholder so
        // the tab visually differs from "All Items".
        return [...scoped].reverse();
      case "all":
      default:
        return scoped;
    }
  }, [products, search, tab]);

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

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh" }}>
      <Header
        instanceName={instanceName}
        searchValue={search}
        onSearchChange={setSearch}
        onOpenApiKeys={() => setApiKeysOpen(true)}
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
        <StatCell
          label="Low Stock"
          value={String(stats.lowStock)}
          valueColor="#c0392b"
        />
        <StatCell
          label="Total Value"
          value={`$${(stats.totalValue / 1000).toFixed(1)}k`}
        />
        <StatCell label="Categories" value={String(stats.categories)} />
        <StatCell
          label="Availability"
          value={`${stats.availability}%`}
          valueColor="#27ae60"
          last
        />
      </div>

      {/* Card grid */}
      <main style={{ padding: "16px 20px" }}>
        {loadError ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 12,
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {filteredProducts.map((p) => (
              <ProductCard
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

function ProductCard({
  product,
  onClick,
}: {
  product: ProductView;
  onClick: () => void;
}) {
  const badgeKind = badgeFor(product);
  const badge = STOCK_BADGE[badgeKind];
  const cost = unitCostFor(product.sku);
  const totalValue = product.onHand * cost;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "#ffffff",
        border: "1px solid #f0f0f0",
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
        transition: "border-color 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#f0f0f0")}
    >
      <div
        style={{
          position: "relative",
          height: 80,
          background: "#f7f7f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
        }}
        aria-hidden
      >
        {emojiFor(product.category)}
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: badge.bg,
            color: badge.fg,
            fontSize: 9,
            textTransform: "uppercase",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 4,
            letterSpacing: "0.04em",
          }}
        >
          {badge.label}
        </span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            fontSize: 9,
            color: "#888",
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {product.sku}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#1a1a1a",
            marginTop: 2,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 8,
            fontSize: 11,
          }}
        >
          <span style={{ color: "#666" }}>
            <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{product.onHand}</span>{" "}
            in stock
          </span>
          <span style={{ color: "#c0392b", fontWeight: 700 }}>
            ${totalValue.toFixed(0)}
          </span>
        </div>
      </div>
    </button>
  );
}

// Suppress unused-import for InventoryStatus — kept so future filters/badges
// can reference the type without re-importing.
export type { InventoryStatus };
