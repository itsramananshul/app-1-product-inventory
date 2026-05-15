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

type TabKey = "all" | "low" | "category";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Items" },
  { key: "low", label: "Low Stock" },
  { key: "category", label: "By Category" },
];

const STATUS_BADGE: Record<
  InventoryStatus,
  { label: string; bg: string; fg: string }
> = {
  OK: { label: "In Stock", bg: "#d1fae5", fg: "#065f46" },
  "LOW STOCK": { label: "Low Stock", bg: "#fef3c7", fg: "#92400e" },
  "OUT OF STOCK": { label: "Critical", bg: "#fee2e2", fg: "#991b1b" },
};

export function Dashboard({ instanceName }: DashboardProps) {
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  // Close dropdown menu when clicking outside
  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpenId]);

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

    const sorted = [...scoped];
    if (tab !== "category") {
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

  const handleMenuOption = useCallback(
    (p: ProductView, option: "edit" | "adjust" | "history" | "archive") => {
      setMenuOpenId(null);
      if (option === "edit" || option === "adjust") {
        handleAction(p, "adjust");
        return;
      }
      if (option === "history") {
        setToast({
          id: Date.now(),
          kind: "error",
          message: `No history endpoint available for ${p.sku}.`,
        });
        return;
      }
      if (option === "archive") {
        setToast({
          id: Date.now(),
          kind: "error",
          message: `Archive isn't supported by the inventory API on this instance.`,
        });
      }
    },
    [handleAction],
  );

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
              transition: "all 0.2s ease",
            }}
          >
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                menuOpen={menuOpenId === p.id}
                onToggleMenu={(e) => {
                  e.stopPropagation();
                  setMenuOpenId((cur) => (cur === p.id ? null : p.id));
                }}
                onMenuOption={(opt) => handleMenuOption(p, opt)}
                onCardClick={() => handleAction(p, "adjust")}
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
  menuOpen,
  onToggleMenu,
  onMenuOption,
  onCardClick,
}: {
  product: ProductView;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onMenuOption: (opt: "edit" | "adjust" | "history" | "archive") => void;
  onCardClick: () => void;
}) {
  const badge = STATUS_BADGE[product.status];
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #f0f0f0",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#f0f0f0")}
    >
      <button
        type="button"
        onClick={onCardClick}
        style={{
          all: "unset",
          display: "block",
          width: "100%",
          cursor: "pointer",
        }}
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
              on hand
            </span>
            <span style={{ color: "#888" }}>
              {product.reserved} reserved
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleMenu}
        aria-label="More actions"
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "rgba(255,255,255,0.9)",
          border: "1px solid #f0f0f0",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          color: "#666",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ⋯
      </button>

      {menuOpen ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 32,
            right: 6,
            background: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 4,
            zIndex: 10,
            minWidth: 160,
          }}
        >
          <MenuItem onClick={() => onMenuOption("edit")}>Edit</MenuItem>
          <MenuItem onClick={() => onMenuOption("adjust")}>Adjust Quantity</MenuItem>
          <MenuItem onClick={() => onMenuOption("history")}>View History</MenuItem>
          <MenuItem onClick={() => onMenuOption("archive")} danger>
            Archive
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        display: "block",
        width: "100%",
        padding: "8px 10px",
        fontSize: 12,
        color: danger ? "#c0392b" : "#1a1a1a",
        cursor: "pointer",
        borderRadius: 4,
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f7f7")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
